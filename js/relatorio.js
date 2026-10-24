// Relatório final: veredito, médias por componente, gráficos e exportação (PDF/JSON/texto).
import { METRICAS, NOMES, avaliar, resumirComponente, vereditoGeral } from './avaliacao.js';
import { formatarDuracao, formatarNumero } from './metricas.js';
import { graficoRelatorio } from './graficos.js';
import { DOWNLOAD, descricaoMemoria } from './plugin.js';
import { integrarComparacao } from './ranking.js';

const ESTADOS_DISCO = { bom: 'Bom', cuidado: 'Cuidado', ruim: 'Ruim' };
const FASES_CDM = [
  ['seq1mq8Leitura', 'SEQ1M Q8', 'leitura'], ['seq1mq8Escrita', 'SEQ1M Q8', 'escrita'],
  ['seq1mq1Leitura', 'SEQ1M Q1', 'leitura'], ['seq1mq1Escrita', 'SEQ1M Q1', 'escrita'],
  ['rnd4kq32Leitura', 'RND4K Q32', 'leitura'], ['rnd4kq32Escrita', 'RND4K Q32', 'escrita'],
  ['rnd4kq1Leitura', 'RND4K Q1', 'leitura'], ['rnd4kq1Escrita', 'RND4K Q1', 'escrita'],
];

// Disco físico (SMART do plugin) que contém a unidade testada.
function discoDaUnidade(saude, unidade) {
  return (saude || []).find((d) => d.letras?.includes(unidade));
}

const PRINCIPAL = { cpu: 'gflops', gpu: 'fps', memoria: 'copiaGBs', disco: 'seqEscrita', pressao: 'estado' };

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function estabilidade(cv) {
  if (cv === null || cv === undefined) return '—';
  if (cv < 3) return `muito estável (${formatarNumero(cv, 1)}%)`;
  if (cv < 8) return `estável (${formatarNumero(cv, 1)}%)`;
  if (cv < 15) return `oscilando (${formatarNumero(cv, 1)}%)`;
  return `instável (${formatarNumero(cv, 1)}%)`;
}

// Calcula tudo o que o relatório mostra; separado do HTML para virar o JSON exportado.
export function analisar(dados) {
  const componentes = {};
  // A pressão só pesa no veredito quando a CPU também perdeu desempenho.
  const quedaCpu = dados.componentes.cpu ? resumirComponente('cpu', dados.componentes.cpu.series).gflops.queda : null;
  for (const [id, c] of Object.entries(dados.componentes)) {
    const resumo = resumirComponente(id, c.series);
    const avisos = [...(c.info?.avisos || [])];
    const fisico = id === 'disco' && c.info?.modo === 'nativo' ? discoDaUnidade(dados.saudeDiscos, c.info.unidade) : null;
    const avaliacao = avaliar(id, resumo, {
      falhaFatal: c.falhaFatal || c.info?.falhaFatal,
      distribuicao: c.info?.distribuicao,
      quedaCpu,
      movel: dados.sistema?.dispositivo?.tipo === 'celular',
      disparoTemp: dados.protecao?.disparo?.componente === id ? dados.protecao.disparo : null,
      limiteTemp: dados.protecao?.limites?.ativa ? dados.protecao.limites[id] : undefined,
      saudeDisco: fisico?.avaliacao?.estado,
      avisos,
    });
    componentes[id] = { resumo, avaliacao, info: c.info };
  }
  const avaliacoes = Object.fromEntries(Object.entries(componentes).filter(([id]) => id !== 'pressao').map(([id, c]) => [id, c.avaliacao]));
  const geral = vereditoGeral(avaliacoes);
  const errosMedidos = Object.values(componentes).some((c) => (c.resumo.erros?.total || 0) > 0 || (c.resumo.artefatos?.total || 0) > 0);
  const falhaExecucao = !errosMedidos && Object.values(dados.componentes).some((c) => c.falhaFatal || c.info?.falhaFatal);
  if (geral.status === 'falha' && falhaExecucao) geral.titulo = 'Teste incompleto: falha na execução';
  if (componentes.pressao?.avaliacao.status === 'atencao' && geral.status === 'ok') {
    geral.status = 'atencao';
    geral.titulo = 'Aprovado com ressalvas';
  }
  // Parada por temperatura: nunca "aprovado", mesmo se o componente quente não estava em teste.
  if (dados.protecao?.disparo && geral.status !== 'falha') {
    geral.status = 'atencao';
    geral.titulo = 'Interrompido pela proteção de temperatura';
  }
  if (dados.interrupcaoAndroid && !errosMedidos) {
    geral.status = 'atencao';
    geral.titulo = 'Teste interrompido no Android';
  }
  if (dados.interrupcaoMovel && !errosMedidos) {
    geral.status = 'atencao';
    geral.titulo = 'Interrompido pela proteção de carga do celular';
  }
  return { geral, componentes, falhaExecucao };
}

function textoProtecao(p) {
  if (!p) return '';
  const max = (k) => (p.maxima?.[k] === null || p.maxima?.[k] === undefined ? 'sem leitura' : `${Math.round(p.maxima[k])} °C`);
  const limites = p.limites.ativa
    ? `limites CPU ${p.limites.cpu} °C e GPU ${p.limites.gpu} °C`
    : 'desligada (só registrou as temperaturas)';
  const disparo = p.disparo
    ? `<strong class="ruim-texto">Disparou: ${esc(NOMES[p.disparo.componente])} a ${Math.round(p.disparo.temp)} °C, e todos os testes foram parados.</strong>`
    : (p.limites.ativa ? 'Não disparou.' : '');
  return `<p><strong>Proteção de temperatura:</strong> ${esc(limites)}. Máximas: CPU ${esc(max('cpu'))}, GPU ${esc(max('gpu'))}. ${disparo}</p>`;
}

function linhaMetricas(id, resumo) {
  return METRICAS[id].map((m) => {
    const r = resumo[m.chave];
    if (m.plugin && !r.n) return ''; // sensor que não respondeu nesta máquina
    if (m.tipo === 'contador') {
      return `<tr><th scope="row">${esc(m.rotulo)}</th><td colspan="4" class="${r.total > 0 && /erro|artefato/i.test(m.rotulo) ? 'ruim' : ''}">
        <strong>${formatarNumero(r.total, m.casas)}</strong> ${esc(m.unidade)}</td></tr>`;
    }
    return `<tr><th scope="row">${esc(m.rotulo)}</th>
      <td><strong>${formatarNumero(r.media, m.casas)}</strong> ${esc(m.unidade)}</td>
      <td>${formatarNumero(r.min, m.casas)}</td><td>${formatarNumero(r.max, m.casas)}</td>
      <td>${esc(estabilidade(r.cv))}</td></tr>`;
  }).join('');
}

function detalheInfo(id, info = {}, opcoes = {}) {
  const itens = [];
  if (id === 'cpu') itens.push(`${info.threads ?? opcoes.threads} threads`);
  if (id === 'gpu') itens.push(info.renderer, info.resolucao, `${info.passos} passos de raymarching`);
  if (id === 'memoria') itens.push(`${info.alocadoMiB ?? opcoes.mib} MiB testados`);
  if (id === 'disco' && info.modo === 'nativo') itens.push(`disco real ${info.unidade} sem cache (plugin)`);
  if (id === 'disco' && info.modo === 'android') itens.push('armazenamento nativo Android · SEQ1M/RND4K Q1 · leitura pode incluir cache');
  else if (id === 'disco' && info.modo !== 'nativo') itens.push('armazenamento do navegador (OPFS)');
  if (id === 'disco') itens.push(`arquivo de ${info.arquivoMiB ?? opcoes.mib} MiB`, `${info.ciclos ?? 0} ciclo(s) completos`);
  return itens.filter(Boolean).map(esc).join(' · ');
}

function textoResumo(dados, analise) {
  const linhas = [
    `SLT Stress Test — ${dados.modo}`,
    `Data: ${dados.inicio.toLocaleString('pt-BR')} · Duração: ${formatarDuracao(dados.duracaoS)}`,
    `Resultado geral: ${analise.geral.titulo}`,
    '',
  ];
  for (const [id, c] of Object.entries(analise.componentes)) {
    if (c.avaliacao.status === 'na' && id === 'pressao') continue;
    linhas.push(`${NOMES[id]}: ${c.avaliacao.titulo}`);
    for (const m of METRICAS[id]) {
      const r = c.resumo[m.chave];
      if (m.plugin && !r.n) continue;
      const v = m.tipo === 'contador' ? r.total : r.media;
      linhas.push(`  ${m.rotulo}: ${formatarNumero(v, m.casas)} ${m.unidade}${m.tipo === 'media' ? ' (média)' : ''}`.trimEnd());
    }
    for (const motivo of c.avaliacao.motivos) linhas.push(`  → ${motivo}`);
  }
  linhas.push('', 'https://stresstest.smellsliketech.com.br');
  return linhas.join('\n');
}

export function gerarRelatorio(container, dados) {
  const analise = analisar(dados);
  const { geral } = analise;
  const s = dados.sistema || {};
  // A pressão só aparece quando o navegador entregou leituras de verdade.
  const temPressao = Object.keys(analise.componentes.pressao?.info?.distribuicao || {}).length > 0;
  const ids = [...dados.ids, ...(temPressao ? ['pressao'] : [])];

  const cartoes = ids.map((id) => {
    const c = analise.componentes[id];
    if (!c) return '';
    const a = c.avaliacao;
    return `<article class="cartao comp ${a.status}">
      <header>
        <h3>${esc(NOMES[id])}</h3>
        <span class="chip ${a.status}">${esc(a.titulo)}</span>
      </header>
      <p class="detalhe">${detalheInfo(id, c.info, dados.opcoes?.[id])}</p>
      <ul class="motivos">${a.motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <canvas class="grafico" height="120" data-grafico="${id}"></canvas>
      <div class="tabela-rolagem"><table class="tabela compacta">
        <thead><tr><th>Medida</th><th>Média</th><th>Mín</th><th>Máx</th><th>Estabilidade</th></tr></thead>
        <tbody>${linhaMetricas(id, c.resumo)}</tbody>
      </table></div>
      <details class="explica"><summary>O que cada número significa</summary>
        <dl>${METRICAS[id].filter((m) => !m.plugin || c.resumo[m.chave]?.n).map((m) => `<dt>${esc(m.rotulo)}</dt><dd>${esc(m.explica)}</dd>`).join('')}</dl>
      </details>
    </article>`;
  }).join('');

  const erros = dados.eventos.filter((e) => e.tipo === 'erro');
  const infoDisco = analise.componentes.disco?.info;
  const cdm = infoDisco?.modo === 'nativo' && Object.keys(infoDisco.resultados || {}).length
    ? `<article class="cartao">
        <h3>Disco real ${esc(infoDisco.unidade)}: resultado completo</h3>
        <p class="nota">Último ciclo completo, sem o cache do Windows (no estilo do CrystalDiskMark). Q = pedidos simultâneos.</p>
        <div class="grade-cdm">${FASES_CDM.map(([k, nome, tipo]) => {
          const r = infoDisco.resultados[k];
          return `<div><small>${nome} ${tipo}</small><strong>${r ? formatarNumero(r.mbs, r.mbs < 10 ? 2 : 0) : '—'}</strong> <small>MB/s${r && k.startsWith('rnd') ? ` · ${formatarNumero(r.iops, 0)} IOPS` : ''}</small></div>`;
        }).join('')}</div>
      </article>`
    : '';
  const saude = dados.saudeDiscos?.length
    ? `<article class="cartao">
        <h3>Saúde dos discos (SMART)</h3>
        <div class="saude">${dados.saudeDiscos.map((d) => `<div class="saude-disco">
          <strong>${esc(d.nome)} ${d.letras?.length ? `(${esc(d.letras.join(', '))})` : ''}</strong>
          <span class="chip ${esc(d.avaliacao?.estado)}">${esc(ESTADOS_DISCO[d.avaliacao?.estado] || 'Desconhecida')}</span>
          <p class="detalhe">${[
            `${d.tipo} ${d.barramento}`, `${formatarNumero(d.tamanhoGB, 0)} GB`,
            d.tempC ? `${d.tempC} °C agora` : null, d.tempMaxC ? `máx. registrada ${d.tempMaxC} °C` : null,
            d.horasLigado ? `${formatarNumero(d.horasLigado, 0)} h ligado` : null,
            d.tipo === 'SSD' && d.desgastePct !== undefined && d.desgastePct !== null ? `vida útil usada ${d.desgastePct}%` : null,
            d.errosNaoCorrigidos ? `${d.errosNaoCorrigidos} erro(s) não corrigidos` : null,
          ].filter(Boolean).map(esc).join(' · ')}</p>
          <p class="detalhe">${(d.avaliacao?.motivos || []).map(esc).join(' ')}</p>
        </div>`).join('')}</div>
      </article>`
    : '';
  const sensoresReais = dados.plugin
    ? `<article class="cartao indisponivel">
        <h3>Sensores reais (plugin v${esc(dados.plugin.versao)})</h3>
        <p>Temperatura, clocks e potência acima vieram dos sensores do hardware, lidos pelo SLT Stress Test Plugin.
          ${dados.plugin.memoria ? `Memória instalada: <strong>${esc(dados.plugin.memoria)}</strong>.` : ''}</p>
        ${dados.plugin.pawnio ? '' : '<p class="nota">O driver PawnIO não estava instalado, então a temperatura e o clock por núcleo da CPU ficaram de fora (o clock veio do contador do Windows). O plugin 1.2.0 inclui o driver; use “Instalar PawnIO incluído” no menu da bandeja e reabra o plugin.</p>'}
        ${textoProtecao(dados.protecao)}
        <p class="nota">Valores que o seu hardware não informa simplesmente não aparecem: nada foi estimado no lugar.</p>
      </article>`
    : null;
  const temCPU = dados.ids.includes('cpu');
  const temGPU = dados.ids.includes('gpu');

  container.innerHTML = `
    <div class="relatorio-cab">
      <div>
        <p class="selo">Relatório · ${esc(dados.modo)}</p>
        <h2>Resultado do teste</h2>
        <p class="meta">${esc(dados.inicio.toLocaleString('pt-BR'))} · duração ${formatarDuracao(dados.duracaoS)}
          ${dados.duracaoAlvoS ? `de ${formatarDuracao(dados.duracaoAlvoS)} previstos` : '(sem limite)'} · ${esc(dados.motivo)}</p>
      </div>
      <div class="relatorio-acoes nao-imprimir">
        <button type="button" class="botao" data-acao="pdf">Imprimir / PDF</button>
        <button type="button" class="botao" data-acao="json">Baixar JSON</button>
        <button type="button" class="botao" data-acao="copiar">Copiar resumo</button>
        <button type="button" class="botao primario" data-acao="novo">Novo teste</button>
      </div>
    </div>

    <div class="veredito ${geral.status}">
      <span class="veredito-icone" aria-hidden="true">${{ ok: '✔', atencao: '!', falha: '✖', na: '?' }[geral.status]}</span>
      <div>
        <strong>${esc(geral.titulo)}</strong>
        <p>${(dados.interrupcaoAndroid || dados.interrupcaoMovel) && geral.status !== 'falha' ? esc(dados.interrupcaoAndroid || dados.interrupcaoMovel) : dados.protecao?.disparo && geral.status !== 'falha'
          ? `O teste parou porque a ${esc(NOMES[dados.protecao.disparo.componente])} passou do limite de ${dados.protecao.disparo.limite} °C que você definiu. Até a parada não houve erros, mas a refrigeração precisa de atenção antes de um teste longo.`
          : {
          ok: 'Nenhum erro de cálculo, de memória, de imagem ou de dados, e o desempenho se manteve. Para este teste, o sistema se comportou como um computador estável.',
          atencao: 'Não houve erros, mas algo merece atenção (geralmente queda de desempenho por calor). Veja os detalhes abaixo.',
          falha: analise.falhaExecucao ? 'Uma carga não conseguiu concluir ou confirmar a limpeza. Isso não comprova defeito do hardware. Consulte o motivo abaixo e aguarde a liberação dos recursos antes de repetir.' : 'Foram encontrados erros nos dados ou cálculos verificados. Veja abaixo qual componente registrou os erros e o que fazer.',
          na: 'O teste foi curto demais ou não conseguiu medir. Tente de novo com pelo menos 2 minutos.',
        }[geral.status]}</p>
      </div>
    </div>

    <div class="grade-relatorio">${cartoes}</div>

    ${cdm || saude ? `<div class="grade-dupla">${cdm}${saude}</div>` : ''}

    ${dados.android ? `<article class="cartao"><h3>Dados nativos do Android</h3>
      <p>${esc(dados.android.marca)} ${esc(dados.android.modelo)} · Android ${esc(dados.android.android)}.
        CPU, memória e armazenamento usam cargas nativas. A GPU usa WebGL2.</p>
      ${dados.android.emulado ? '<p class="alerta">Ambiente emulado: serve para validar o funcionamento e fica fora das médias de hardware físico.</p>' : ''}
      <dl class="lista-sistema">
        <div><dt>Processador / SoC</dt><dd>${esc(dados.android.cpu?.modelo || 'não disponível')}</dd></div>
        <div><dt>RAM informada pelo Android</dt><dd>${Number.isFinite(dados.android.memoria?.totalGB) ? `${formatarNumero(dados.android.memoria.totalGB, 2)} GiB` : 'não disponível'}</dd></div>
        <div><dt>Frequência da RAM</dt><dd>${dados.android.memoria?.frequenciaMTs ? `${formatarNumero(dados.android.memoria.frequenciaMTs, 0)} MT/s` : 'não disponível'}</dd></div>
        <div><dt>Temperatura da bateria</dt><dd>${Number.isFinite(dados.sensoresAndroid?.bateria?.tempC) ? `${formatarNumero(dados.sensoresAndroid.bateria.tempC, 1)} °C` : 'não disponível'}</dd></div>
      </dl>
      <p class="nota">Temperatura da bateria é uma leitura separada da CPU/GPU. Sensores dependem do fabricante; valores ausentes não foram estimados. Modelo dos chips de memória e SMART não são expostos pela API pública do Android.</p>
      <details><summary>Todos os dados coletados e suas fontes</summary><pre>${esc(JSON.stringify({ inventario: dados.android, sensoresFinais: dados.sensoresAndroid }, null, 2))}</pre></details>
    </article>` : sensoresReais ?? `<article class="cartao indisponivel">
      <h3>Temperatura e clocks reais</h3>
      <p>Por segurança, o navegador não deixa sites lerem sensores. Por isso <strong>temperatura média,
        clock real da GPU e frequência da memória não aparecem aqui</strong> e não foram inventados.
        No lugar, use os sinais indiretos acima:</p>
      <ul>
        ${temCPU ? '<li><strong>CPU</strong>: queda de desempenho pode indicar limite térmico, de energia ou disputa por recursos. Sem sensor, não confirma temperatura.</li>' : ''}
        ${temGPU ? '<li><strong>GPU</strong>: queda de FPS também pode decorrer de limite térmico, de energia ou disputa por recursos.</li>' : ''}
        ${s.dispositivo?.tipo === 'celular' ? '<li>No iPhone, o navegador não oferece temperatura de CPU/GPU. No Android, o APK tenta fontes legíveis sem root; a disponibilidade varia entre fabricantes. Se esquentar, pare e aguarde esfriar, fora do carregador.</li>' : `<li>Para as temperaturas exatas, deixe o <a href="https://github.com/LibreHardwareMonitor/LibreHardwareMonitor" target="_blank" rel="noopener">LibreHardwareMonitor</a>
          ou o <a href="https://www.hwinfo.com/" target="_blank" rel="noopener">HWiNFO</a> aberto durante o teste e anote os máximos.
          Para a saúde do disco, use o <a href="https://crystalmark.info/en/software/crystaldiskinfo/" target="_blank" rel="noopener">CrystalDiskInfo</a>.</li>
        <li>Ou baixe o <a href="${DOWNLOAD}">SLT Stress Test Plugin</a> (Windows): com ele, temperatura, clocks reais, frequência da memória e SMART entram neste relatório.</li>`}
      </ul>
    </article>`}

    <div class="grade-dupla">
      <article class="cartao">
        <h3>Sistema testado</h3>
        <dl class="lista-sistema">
          <div><dt>Processador</dt><dd>${esc(s.threads ? `${s.threads} threads` : '—')}</dd></div>
          <div><dt>GPU</dt><dd>${esc(s.gpu || '—')}</dd></div>
          <div><dt>Memória RAM</dt><dd>${esc(descricaoMemoria({ plugin: dados.inventario, android: dados.android }))}</dd></div>
          <div><dt>Sistema</dt><dd>${esc(`${s.so || ''} · ${s.navegador || ''}`)}</dd></div>
          ${s.bateria ? `<div><dt>Energia</dt><dd>${s.bateria.carregando ? 'na tomada' : 'na bateria'}</dd></div>` : ''}
        </dl>
      </article>
      <article class="cartao">
        <h3>Erros registrados</h3>
        ${erros.length
          ? `<ol class="lista-erros">${erros.slice(0, 30).map((e) => `<li><time>${formatarDuracao(e.t)}</time> ${esc(e.msg)}</li>`).join('')}</ol>
             ${erros.length > 30 ? `<p class="nota">…e mais ${erros.length - 30}. Todos estão no JSON.</p>` : ''}`
          : '<p class="bom">Nenhum erro durante o teste.</p>'}
      </article>
    </div>

    <p class="nota">Gerado por SLT Stress Test (stresstest.smellsliketech.com.br). Os números
      dependem do navegador, do sistema e do que mais estava aberto. Compare resultados do mesmo
      computador, no mesmo navegador.</p>`;

  for (const canvas of container.querySelectorAll('[data-grafico]')) {
    const id = canvas.dataset.grafico;
    const chave = PRINCIPAL[id];
    const m = METRICAS[id].find((x) => x.chave === chave);
    graficoRelatorio(canvas, dados.componentes[id]?.series[chave] || [], { unidade: m.unidade, casas: m.casas, duracaoS: dados.duracaoS });
    canvas.setAttribute('aria-label', `Gráfico de ${m.rotulo} ao longo do teste`);
  }

  const texto = textoResumo(dados, analise);
  integrarComparacao(container, dados);
  container.querySelector('.relatorio-acoes').addEventListener('click', async (e) => {
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'pdf') { if (dados.android) globalThis.SLTAndroid.imprimir(); else window.print(); }
    if (acao === 'novo') document.dispatchEvent(new CustomEvent('slt:novo-teste'));
    if (acao === 'copiar') {
      try { await navigator.clipboard.writeText(texto); e.target.textContent = 'Copiado!'; }
      catch { e.target.textContent = 'Não foi possível copiar'; }
      setTimeout(() => { e.target.textContent = 'Copiar resumo'; }, 2000);
    }
    if (acao === 'json') {
      const json = JSON.stringify({ versao: 1, ...dados, analise }, null, 2);
      if (dados.android) { globalThis.SLTAndroid.exportar(json); return; }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `slt-stresstest-${dados.inicio.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
}
