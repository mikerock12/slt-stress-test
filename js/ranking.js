import { VERSAO_BENCHMARK, PRINCIPAL_RANKING, chaveGrupo } from './benchmark.js';
import { METRICAS, NOMES } from './avaliacao.js';
import { formatarNumero } from './metricas.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const marca = (s = '') => /intel/i.test(s) ? 'Intel' : /amd|radeon/i.test(s) ? 'AMD' : /nvidia|geforce/i.test(s) ? 'NVIDIA' : /qualcomm|snapdragon|adreno/i.test(s) ? 'Qualcomm' : /arm|mali/i.test(s) ? 'ARM' : /apple/i.test(s) ? 'Apple' : null;
const descreverConfig = (c) => [
  `Método: ${c.motor === 'navegador-v1' ? 'navegador' : c.motor === 'android-nativo-v1' ? 'Android nativo' : 'Windows sem cache'}`,
  `Carga: ${c.simultaneos}`, c.duracaoAlvoS ? `Duração: ${c.duracaoAlvoS} s` : 'Duração: indefinida',
  c.threads ? `${c.threads} threads` : null, c.largura ? `${c.largura} × ${c.altura}, intensidade ${c.intensidade}` : null,
  c.mib ? `Solicitado: ${c.mib} MiB` : null, c.alocadoMiB ? `Alocado: ${c.alocadoMiB} MiB` : null,
].filter(Boolean).map(esc).join(' · ');
function tabelaReferencia(id, valores, comCliente = false) {
  return `<details><summary>Médias de todas as métricas</summary><div class="tabela-rolagem"><table><thead><tr><th>Métrica</th>${comCliente ? '<th>Seu teste</th>' : ''}<th>Comunidade</th><th>Contribuintes</th></tr></thead><tbody>${METRICAS[id].filter((m)=>valores?.[m.chave]?.n || valores?.[m.chave]?.valor!==null && valores?.[m.chave]?.valor!==undefined).map((m)=>{const r=valores[m.chave];return `<tr><th>${esc(m.rotulo)}</th>${comCliente ? `<td>${formatarNumero(r.valor,m.casas)} ${esc(m.unidade)}</td>` : ''}<td>${r.n>=5 ? `${formatarNumero(r.media,m.casas)} ${esc(m.unidade)}` : 'Informação insuficiente'}</td><td>${r.n}</td></tr>`;}).join('')}</tbody></table></div></details>`;
}
let contribuinteMemoria = null;
function contribuinte() {
  try {
    let id = localStorage.getItem('slt-contribuinte');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('slt-contribuinte', id); }
    return id;
  } catch { return contribuinteMemoria ||= crypto.randomUUID(); }
}
export function prepararBenchmark(dados) {
  const p = dados.inventario || {};
  const a = dados.android || {};
  const s = dados.sistema;
  const pentes = p.memoria || [];
  const disco = (dados.saudeDiscos || []).find((d) => d.letras?.includes(dados.opcoes.disco.unidade));
  const cpuModelo = a.cpu?.modelo || p.cpuDetalhes?.modelo || p.cpu || null;
  const cpu = { marca: a.cpu?.marca || p.cpuDetalhes?.fabricante || marca(cpuModelo), modelo: cpuModelo, frequencia: a.cpu?.frequenciaMHz || p.cpuDetalhes?.frequenciaMHz || null, unidadeFrequencia: 'MHz', contexto: a.cpu?.nucleos ? JSON.stringify(a.cpu.nucleos) : null, fonte: a.cpu ? 'Android / Build e sysfs' : p.cpu ? 'Plugin Windows / WMI' : 'não disponível' };
  const memoria = { marca: pentes.length ? [...new Set(pentes.map((m) => m.fabricante).filter(Boolean))].sort().join(' + ') : a.memoria?.marca,
    modelo: pentes.length && pentes.every((m) => m.modelo) ? pentes.map((m) => m.modelo).sort().join(' + ') : a.memoria?.modelo,
    frequencia: pentes.length ? Math.min(...pentes.map((m) => m.configuradaMTs || m.velocidadeMTs || Infinity)) : a.memoria?.frequenciaMTs,
    unidadeFrequencia: 'MT/s', capacidadeGB: pentes.length ? pentes.reduce((n, m) => n + m.capacidadeGB, 0) : a.memoria?.totalGB,
    tipo: pentes.map((m) => m.tipo).filter(Boolean).sort().join(' + ') || a.memoria?.tipo,
    contexto: [cpuModelo, ...pentes.map((m) => `${m.capacidadeGB} GB ${m.modelo || '?'} ${m.configuradaMTs || m.velocidadeMTs || '?'}`)].join(' / '), fonte: pentes.length ? 'Plugin Windows / SMBIOS' : 'Android / ActivityManager' };
  const hardware = {
    cpu,
    gpu: { marca: marca(s.gpu), modelo: s.gpu && !/desconhecida|sem webgl/i.test(s.gpu) ? s.gpu : null, frequencia: a.gpu?.frequenciaMaxMHz || null, unidadeFrequencia: 'MHz', contexto: cpuModelo, fonte: 'WebGL renderer' },
    memoria,
    disco: disco ? { marca: disco.fabricante || null, modelo: disco.nome, tipo: disco.tipo, capacidadeGB: disco.tamanhoGB, contexto: disco.barramento, fonte: 'Plugin Windows / Storage' }
      : dados.componentes.disco?.info?.motor === 'android-nativo-v1' ? { ...a.disco, contexto: `${a.marca} ${a.modelo}`, fonte: 'Android / sysfs e StatFs' }
        : { modelo: null, tipo: 'OPFS', fonte: 'Armazenamento do navegador; hardware não identificado' },
  };
  const componentes = {};
  for (const id of dados.ids) {
    const c = dados.componentes[id]; const op = dados.opcoes[id];
    const configuracao = { motor: c.info?.motor || (id === 'disco' && c.info?.modo === 'nativo' ? 'windows-disco-v1' : 'navegador-v1'),
      simultaneos: [...dados.ids].sort().join('+'), duracaoAlvoS: dados.duracaoAlvoS,
      cpuContexto: JSON.stringify(dados.opcoes.cpu), gpuContexto: JSON.stringify({ resolucao: dados.opcoes.gpu.resolucao, intensidade: dados.opcoes.gpu.intensidade }), memoriaContexto: String(dados.opcoes.memoria.mib) };
    if (id === 'cpu') configuracao.threads = c.info?.threads || op.threads;
    if (id === 'gpu') Object.assign(configuracao, { largura: op.resolucao[0], altura: op.resolucao[1], intensidade: op.intensidade });
    if (id === 'memoria') Object.assign(configuracao, { mib: op.mib, alocadoMiB: c.info?.alocadoMiB || op.mib });
    if (id === 'disco') configuracao.mib = op.mib;
    componentes[id] = { hardware: hardware[id], configuracao, series: c.series, detalhes: c.info, falha: !!(c.falhaFatal || c.info?.falhaFatal) };
  }
  return { versao: VERSAO_BENCHMARK, id: crypto.randomUUID(), contribuinte: contribuinte(), ids: dados.ids,
    duracaoS: dados.duracaoS, concluido: dados.motivo === 'Tempo concluído' && !dados.protecao?.disparo && !dados.oculta && !dados.eventos?.some((e) => e.tipo === 'erro'),
    sistema: { tipo: s.dispositivo?.tipo, emulado: dados.android?.emulado === true, so: s.so, navegador: s.navegador, threads: s.threads,
      energia: s.bateria ? s.bateria.carregando ? 'tomada' : 'bateria' : 'não disponível', aparelho: a.modelo ? `${a.marca} ${a.modelo}` : null }, componentes };
}
async function pedir(url, corpo) {
  const r = await fetch(url, { method: corpo ? 'POST' : 'GET', headers: corpo ? { 'Content-Type': 'application/json' } : {}, body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(20000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Serviço de ranking indisponível.');
  return d;
}
export function integrarComparacao(container, dados) {
  const caixa = document.createElement('article'); caixa.className = 'cartao comparacao'; caixa.setAttribute('aria-live', 'polite');
  container.querySelector('.grade-relatorio').after(caixa);
  let pacote;
  try { pacote = prepararBenchmark(dados); } catch { caixa.textContent = 'Não foi possível preparar a comparação. O relatório local continua disponível.'; return; }
  let enviando = false;
  const enviar = async (salvar) => {
    if (enviando) return; enviando = true;
    caixa.innerHTML = '<h3>Comparação com hardware igual</h3><p>Consultando o banco da comunidade…</p>';
    try {
      const r = await pedir(salvar ? '/api/benchmarks' : '/api/comparar', pacote);
      dados.comunidade = r;
      caixa.innerHTML = `<h3>Comparação com hardware igual</h3><p>${r.salvo ? 'Benchmark salvo. Obrigado pela contribuição!' : 'Comparação sem guardar este teste.'}</p>` +
        Object.entries(r.comparacoes).map(([id, c]) => `<p><strong>${esc(NOMES[id])}:</strong> ${esc(c.mensagem)}${c.media ? ` Média: ${formatarNumero(c.media, 2)} ${esc(METRICAS[id].find((m) => m.chave === PRINCIPAL_RANKING[id]).unidade)} · diferença ${formatarNumero(c.diferencaPct, 1)}% · ${c.n} contribuintes.` : ''}</p>${c.metricas ? tabelaReferencia(id,c.metricas,true) : ''}`).join('') +
        `<p class="nota">Mínimo de 5 contribuintes, excluindo os seus resultados. Mesmos modelo, frequência informada, navegador, energia, modo, duração e configuração. “Não disponível” permanece separado de valores conhecidos. Testes interrompidos ou com a aba escondida não entram na média. Dados da comunidade sem certificação.</p>${r.salvo ? `<p>Identificador: <code>${esc(r.id)}</code></p>` : '<button type="button" class="botao" data-contribuir>Contribuir com este teste</button>'}`;
    } catch (e) {
      caixa.innerHTML = `<h3>Comparação com hardware igual</h3><p>${esc(e.message)} Seu relatório está disponível e nenhum resultado foi confirmado como salvo.</p><button type="button" class="botao" data-repetir>Tentar novamente</button>`;
      caixa.querySelector('[data-repetir]').onclick = () => enviar(salvar);
    } finally { enviando = false; }
    const botao = caixa.querySelector('[data-contribuir]');
    if (botao) botao.onclick = () => enviar(true);
  };
  enviar(dados.compartilhar === true);
}

export function iniciarRanking() {
  const form = document.querySelector('#ranking-filtros'); if (!form) return;
  let pagina = 0; let selecao = [];
  const saida = document.querySelector('#ranking-resultados');
  async function carregar() {
    saida.textContent = 'Carregando ranking…';
    const params = new URLSearchParams(new FormData(form)); params.set('pagina', pagina);
    try {
      const d = await pedir(`/api/ranking?${params}`);
      const unidade = METRICAS[d.componente].find((m) => m.chave === PRINCIPAL_RANKING[d.componente]).unidade;
      saida.innerHTML = `<p class="nota">${esc(d.aviso)} Cada linha representa uma configuração; linhas com métodos diferentes não formam uma classificação direta.</p>` +
        (d.resultados.length ? `<div class="tabela-rolagem"><table><thead><tr><th>Hardware</th><th>Frequência</th><th>Média / mín. / máx.</th><th>Contribuintes</th><th>Configuração</th></tr></thead><tbody>${d.resultados.map((r) => `<tr><td>${esc(r.hardware.marca || 'Marca não disponível')}<br><strong>${esc(r.hardware.modelo)}</strong><br>${esc(r.hardware.tipo)}</td><td>${r.hardware.frequencia ? `${formatarNumero(r.hardware.frequencia, 0)} ${esc(r.hardware.unidadeFrequencia)}` : 'não disponível'}</td><td>${[r.media, r.minimo, r.maximo].map((n) => formatarNumero(n, 2)).join(' / ')} ${esc(unidade)}</td><td>${r.contribuicoes}${r.suficiente ? '' : '<br>Informação insuficiente'}</td><td><details><summary>Ver configuração</summary><pre>${descreverConfig(r.configuracao)}</pre></details>${tabelaReferencia(d.componente,r.metricas)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Ainda não temos informação suficiente. Obrigado por ajudar a construir o banco de testes!</p>');
      document.querySelector('#ranking-anterior').disabled = pagina === 0;
      document.querySelector('#ranking-proximo').disabled = d.resultados.length < 50;
    } catch (e) { saida.textContent = e.message; }
  }
  form.onsubmit = (e) => { e.preventDefault(); pagina = 0; carregar(); };
  document.querySelector('#ranking-anterior').onclick = () => { pagina = Math.max(0, pagina - 1); carregar(); };
  document.querySelector('#ranking-proximo').onclick = () => { pagina++; carregar(); };
  document.querySelector('#comparar-ids').onsubmit = async (e) => {
    e.preventDefault(); const alvo = document.querySelector('#comparar-resultados');
    const ids = [...new FormData(e.target).values()];
    if (ids.some((id) => !/^[a-f0-9-]{36}$/i.test(id))) { alvo.textContent = 'Informe dois identificadores de benchmark válidos.'; return; }
    alvo.textContent = 'Carregando testes…';
    try {
      selecao = await Promise.all(ids.map((id) => pedir(`/api/benchmarks/${id}`)));
      const todos = [...new Set(selecao.flatMap((d) => d.ids))];
      alvo.innerHTML = `<p>Resultados completos dos testes. Compare métodos e configurações equivalentes.</p><div class="grade-dupla">${selecao.map((d) => `<article class="cartao"><h3>${esc(d.sistema.aparelho || d.sistema.so)}</h3><p>${esc(d.id)} · ${formatarNumero(d.duracaoS, 0)} s · ${esc(d.sistema.navegador)}</p>${d.ids.map((id) => { const c=d.componentes[id];return `<h4>${esc(NOMES[id])} · ${esc(c.hardware.modelo || 'não disponível')}</h4><p>${esc(c.hardware.marca || 'Marca não disponível')} · ${c.hardware.frequencia ? `${formatarNumero(c.hardware.frequencia,0)} ${esc(c.hardware.unidadeFrequencia)}` : 'Frequência não disponível'}</p><p class="nota">${descreverConfig(c.configuracao)}</p>`; }).join('')}</article>`).join('')}</div>` + todos.map((id) => {
        const igual=selecao.every((d)=>d.componentes[id]) && chaveGrupo(selecao[0],id)===chaveGrupo(selecao[1],id);
        return `<article class="cartao"><h3>${esc(NOMES[id])}</h3><p class="nota">${igual ? 'Hardware e configurações equivalentes.' : 'Hardware ou configurações diferentes; os números não são uma comparação direta de desempenho.'}</p><div class="tabela-rolagem"><table><thead><tr><th>Métrica</th><th>Primeiro teste</th><th>Segundo teste</th></tr></thead><tbody>${METRICAS[id].filter((m)=>selecao.some((d)=>d.componentes[id]?.resumo[m.chave]?.n || d.componentes[id]?.resumo[m.chave]?.total!==undefined)).map((m)=>`<tr><th>${esc(m.rotulo)}</th>${selecao.map((d)=>{const r=d.componentes[id]?.resumo[m.chave];return `<td>${r ? r.total!==undefined ? formatarNumero(r.total,0) : r.n ? `${formatarNumero(r.media,m.casas)} ${esc(m.unidade)}<br><small>mín. ${formatarNumero(r.min,m.casas)} · máx. ${formatarNumero(r.max,m.casas)} · ${r.n} amostras</small>` : 'não disponível' : 'não disponível'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><details><summary>Séries completas para auditoria</summary><pre>${esc(JSON.stringify(selecao.map((d)=>d.componentes[id]),null,2))}</pre></details></article>`;
      }).join('');
    } catch (err) { alvo.textContent = err.message; }
  };
  // Consulta inicial apenas ao abrir o ranking para evitar uma requisição desnecessária.
  document.querySelector('#ranking-abrir').onclick = () => carregar();
}
