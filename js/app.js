// Orquestrador: seleção dos testes, cronômetro, amostragem a cada segundo e painel ao vivo.
import { TesteCPU } from './testes/cpu.js';
import { TesteGPU } from './testes/gpu.js';
import { TesteMemoria } from './testes/memoria.js';
import { TesteDisco } from './testes/disco.js';
import { TesteDiscoPlugin } from './testes/disco-plugin.js';
import { MonitorPressao } from './testes/pressao.js';
import { coletarSistema } from './sistema.js';
import { METRICAS, NOMES } from './avaliacao.js';
import { formatarDuracao, formatarNumero } from './metricas.js';
import { sparkline } from './graficos.js';
import { gerarRelatorio } from './relatorio.js';
import { DOWNLOAD, MonitorSensores, detectarPlugin, lerDiscos, permissaoRedeLocal, resumoMemoria, descricaoMemoria } from './plugin.js';
import { LIMITES_PADRAO, ProtecaoTemperatura, nivel, normalizarLimites } from './protecao.js';
import { DOWNLOAD_APK, inventarioAndroid, sensoresAndroid, MonitorAndroid, TesteAndroid } from './android.js';
import { iniciarRanking } from './ranking.js';
import { ProtecaoDesempenhoMovel, encerrarComPrazo } from './seguranca-movel.js';

const CLASSES = { cpu: TesteCPU, gpu: TesteGPU, memoria: TesteMemoria, disco: TesteDisco, pressao: MonitorPressao };
const ORDEM = ['cpu', 'gpu', 'memoria', 'disco'];
const $ = (sel) => document.querySelector(sel);

let sistema = null;
let execucao = null;
let plugin = null;
let procurandoPlugin = null;
let android = null;

// ---------- Início ----------

async function mostrarSistema() {
  sistema = await coletarSistema();
  android = inventarioAndroid();
  sistema.android = android;
  const movel = sistema.dispositivo.tipo === 'celular';
  document.body.dataset.dispositivo = sistema.dispositivo.tipo;
  $('#tipo-dispositivo').textContent = movel ? `Celular / tablet · ${sistema.dispositivo.plataforma}` : 'Computador · desktop';
  if (movel) {
    $('#titulo-hero').textContent = 'Conheça o desempenho e a estabilidade do seu celular.';
    document.querySelector('[name=gpuRes]').value = '640x360';
    document.querySelector('[name=gpuInt]').value = '64';
    document.querySelector('[name=memMiB]').value = '256';
    document.querySelector('[name=discoMiB]').value = '256';
    document.querySelector('input[name=duracao][value="120"]').checked = true;
    $('#nota-movel').hidden = false;
    $('#nota-aovivo').textContent = 'Mantenha o aplicativo visível. Se esquentar ou a tela apresentar problemas, pare o teste e aguarde esfriar. O teste interrompe diante de queda persistente de desempenho; isso não substitui um sensor térmico.';
  }
  $('#android').hidden = !movel;
  $('#plugin').hidden = sistema.so !== 'Windows';
  $('#android-conteudo').textContent = android ? `Aplicativo conectado: ${android.marca} ${android.modelo}. CPU, memória e armazenamento usam testes nativos. GPU usa WebGL2 com verificação de imagem.`
    : sistema.dispositivo.android ? 'Instale o APK e abra o SLT Stress Test para testar CPU, memória e armazenamento nativamente, além da GPU. O app coleta identificação e os sensores que seu aparelho disponibiliza.'
      : 'No iPhone/iPad, os testes disponíveis rodam no navegador. Um APK é exclusivo do Android e não pode ser instalado no iOS.';
  $('#btn-baixar-apk').hidden = !sistema.dispositivo.android || !!android;
  $('#btn-baixar-apk').href = DOWNLOAD_APK;
  if (android) $('#android-dados').textContent = JSON.stringify(android, null, 2);
  const linhas = [
    ['Dispositivo', android ? `${android.marca} ${android.modelo}` : sistema.dispositivo.tipo === 'celular' ? 'Celular / tablet' : 'Computador'],
    ['Processador', sistema.threads ? `${sistema.threads} threads lógicas` : 'não informado'],
    ['Memória RAM', descricaoMemoria({ plugin, android })],
    ['GPU', sistema.gpu],
    ['Sistema', `${sistema.so} · ${sistema.navegador}`],
    ['Tela', sistema.tela],
    ['Armazenamento p/ teste', sistema.armazenamentoLivreGB ? `${formatarNumero(sistema.armazenamentoLivreGB, 0)} GB disponíveis` : 'não informado'],
    ['Sensor de pressão', sistema.pressao ? 'disponível (Compute Pressure)' : 'indisponível neste navegador'],
  ];
  if (sistema.bateria) {
    linhas.push(['Energia', `${sistema.bateria.carregando ? 'na tomada' : 'na bateria'} · ${sistema.bateria.nivel}%`]);
  }
  $('#sistema').innerHTML = linhas.map(([t, d]) => `<div><dt>${t}</dt><dd${t === 'Memória RAM' ? ' data-memoria' : ''}>${escapar(d)}</dd></div>`).join('');

  const sel = $('#cpu-threads');
  const n = sistema.threads || 4;
  const opcoes = [[n, `Todas (${n})`]];
  if (n > 2) opcoes.push([Math.ceil(n / 2), `Metade (${Math.ceil(n / 2)})`]);
  opcoes.push([1, '1 thread']);
  sel.innerHTML = opcoes.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  if (movel) sel.value = String(n > 2 ? Math.ceil(n / 2) : 1);

  const avisos = [];
  if (!sistema.webgl2) { desativarCard('gpu', 'WebGL2 indisponível'); avisos.push('GPU: o navegador não oferece WebGL2 (ative a aceleração por hardware).'); }
  if (!sistema.opfs && !android) { desativarCard('disco', 'OPFS indisponível'); avisos.push('Disco: o navegador não oferece o armazenamento OPFS.'); }
  if (!movel && sistema.bateria && !sistema.bateria.carregando) avisos.push('Seu aparelho está na bateria: ligue na tomada para o resultado refletir o desempenho máximo.');
  if (avisos.length) {
    const el = $('#aviso-compat');
    el.innerHTML = avisos.map(escapar).join('<br>');
    el.hidden = false;
  }
}

// ---------- Plugin ----------

// O Chrome pergunta ao visitante antes de um site acessar 127.0.0.1. Para não incomodar
// quem nunca baixou o plugin, a procura só começa depois de um clique (ou se ele já foi
// usado antes neste navegador).
function lembrarPlugin() {
  try { localStorage.setItem('slt-plugin', '1'); } catch { /* sem storage */ }
}

function pluginJaUsado() {
  try { return localStorage.getItem('slt-plugin') === '1'; } catch { return false; }
}

let detectando = false;
let permissaoPlugin = null;
let tentativaPlugin = null;

async function atualizarPlugin({ reiniciar = false } = {}) {
  if (detectando && !reiniciar) return;
  tentativaPlugin?.abort();
  const tentativa = new AbortController();
  tentativaPlugin = tentativa;
  detectando = true;
  const anterior = !!plugin;
  mostrarPlugin();
  // Não aguardar Permissions API antes do fetch: preserva o gesto do clique.
  const resposta = detectarPlugin({ signal: tentativa.signal });
  permissaoRedeLocal().then((estado) => {
    if (tentativaPlugin !== tentativa) return;
    permissaoPlugin = estado;
    mostrarPlugin();
  });
  const encontrado = await resposta;
  const permissao = await permissaoRedeLocal();
  // Uma resposta cancelada/antiga nunca sobrescreve uma conexão mais recente.
  if (tentativaPlugin !== tentativa) return;
  plugin = encontrado;
  permissaoPlugin = permissao;
  detectando = false;
  if (plugin) {
    lembrarPlugin();
    clearInterval(procurandoPlugin);
    procurandoPlugin = null;
  }
  mostrarPlugin();
  if (plugin && !anterior && execucao) registrar('log', 'Plugin conectado: os sensores entram a partir do próximo teste.');
}

function procurarPlugin({ reiniciar = false } = {}) {
  if (sistema?.so !== 'Windows') return;
  lembrarPlugin();
  if (!procurandoPlugin) procurandoPlugin = setInterval(() => { if (!execucao) atualizarPlugin(); }, 4000);
  return atualizarPlugin({ reiniciar });
}

function verificarPluginAgora() {
  return procurarPlugin({ reiniciar: true });
}

// A pessoa sai do Chrome para instalar/abrir o exe. Ao voltar, retoma a procura
// somente se já optou pelo plugin; nunca pede rede local a um visitante novo.
function retomarBuscaPlugin() {
  if (!document.hidden && !execucao && !plugin && pluginJaUsado()) procurarPlugin();
}
window.addEventListener('focus', retomarBuscaPlugin);
window.addEventListener('pageshow', retomarBuscaPlugin);
document.addEventListener('visibilitychange', retomarBuscaPlugin);

// ---------- Proteção de temperatura ----------

function lerLimites() {
  let salvos = {};
  try { salvos = JSON.parse(localStorage.getItem('slt-protecao') || '{}'); } catch { /* sem storage */ }
  const padrao = sistema?.dispositivo.tipo === 'celular' ? { ...LIMITES_PADRAO, cpu: 80, gpu: 80 } : LIMITES_PADRAO;
  // Os antigos padrões de desktop também eram gravados automaticamente no celular.
  if (sistema?.dispositivo.tipo === 'celular' && salvos.cpu === 95 && salvos.gpu === 90) { salvos.cpu = 80; salvos.gpu = 80; }
  return normalizarLimites({ ...padrao, ...salvos });
}

function limitesDaTela() {
  const limites = normalizarLimites({
    ativa: $('#protecao-ativa').checked,
    cpu: $('#limite-cpu').value,
    gpu: $('#limite-gpu').value,
  });
  try { localStorage.setItem('slt-protecao', JSON.stringify(limites)); } catch { /* sem storage */ }
  return limites;
}

function prepararProtecao() {
  const l = lerLimites();
  $('#protecao-ativa').checked = l.ativa;
  $('#limite-cpu').value = l.cpu;
  $('#limite-gpu').value = l.gpu;
  for (const el of ['#protecao-ativa', '#limite-cpu', '#limite-gpu']) {
    $(el).addEventListener('change', () => {
      const n = limitesDaTela();
      $('#limite-cpu').value = n.cpu;
      $('#limite-gpu').value = n.gpu;
    });
  }
}

function mostrarTemperaturas(temps, limites) {
  const caixa = $('#temperaturas');
  caixa.hidden = false;
  caixa.innerHTML = ['cpu', 'gpu'].map((k) => {
    const t = temps[k];
    const n = nivel(t, limites[k]);
    const valor = n === 'sem' ? 'sem leitura' : `${Math.round(t)} °C`;
    const limite = limites.ativa ? `limite ${limites[k]} °C` : 'proteção desligada';
    return `<div class="temp ${n}"><span>${k.toUpperCase()}</span><strong>${valor}</strong><small>${limite}</small></div>`;
  }).join('');
}

function mostrarEstadoAndroid(s) {
  const niveis = ['normal', 'leve', 'moderado', 'grave', 'crítico', 'emergência', 'desligamento'];
  const estado = niveis[s.estadoTermico] || 'não disponível';
  const bateria = Number.isFinite(s.bateria?.tempC) ? `${s.bateria.tempC.toFixed(1)} °C` : 'não disponível';
  const indice = Number.isFinite(s.indiceTermico) ? ` Índice térmico: ${s.indiceTermico.toFixed(2)} (1 = limite grave; não é °C).` : '';
  $('#android-sensores-vivo').textContent = `Estado térmico Android: ${estado}. Bateria: ${bateria} (sensor separado).${indice}`;
  $('#android-sensores-detalhes').textContent = ['cpu', 'gpu'].map((k) => {
    const chave = `${k}TempC`;
    return `${k.toUpperCase()}: ${Number.isFinite(s[chave]) ? `${s[chave].toFixed(1)} °C · ${s.fontes?.[chave] || s.leituraAvancada?.fontes?.[chave] || 'sensor identificado'}` : s.ausencias?.[chave] || 'Aguardando leitura.'}`;
  }).join('\n');
  $('#android-leituras').textContent = $('#android-sensores-vivo').textContent + '\n' + $('#android-sensores-detalhes').textContent;
  $('#android-dados').textContent = JSON.stringify({ inventario: android, sensores: s }, null, 2);
}

function mostrarPlugin() {
  const memoria = $('#sistema [data-memoria]');
  if (memoria) memoria.textContent = descricaoMemoria({ plugin, android });
  const caixa = $('#plugin-estado');
  if (sistema?.so !== 'Windows') {
    caixa.innerHTML = android ? '<p><strong>Aplicativo Android conectado.</strong> Veja os dados e fontes na seção Aplicativo.</p>' : '<p>Testes no navegador. Consulte a seção Aplicativo para os recursos nativos do seu sistema.</p>';
    $('#protecao').hidden = !android;
    if (android) $('#protecao-nota').textContent = 'CPU/GPU: limites só funcionam com sensores acessíveis; o app mostra a fonte ou o motivo da ausência. Também para em estado térmico grave do Android, bateria a 43 °C ou queda persistente de desempenho. Bateria não é temperatura da CPU/GPU.';
    return;
  }
  const alvo = $('#disco-alvo');
  $('#protecao').hidden = !plugin;
  if (plugin) {
    $('#protecao-nota').innerHTML = `A temperatura real aparece durante o teste. Se ficar acima do limite por 3 segundos
      seguidos, todos os testes param na hora e o relatório mostra o motivo.${plugin.pawnio ? '' : `
      <br><span class="alerta">Sem o driver <a href="https://pawnio.eu/" target="_blank" rel="noopener">PawnIO</a> o plugin não lê a
      temperatura da CPU, então a proteção vale só para a GPU (quando ela informa a temperatura).</span>`}`;
  }
  if (!plugin) {
    caixa.className = 'plugin-estado';
    caixa.innerHTML = `<p role="status" aria-live="polite"><strong>${detectando ? 'Verificando o plugin…' : 'Plugin não conectado.'}</strong> Sem ele ficam de fora temperatura,
      clocks reais, frequência da memória, SMART e o teste de disco real.</p>
      <div class="acoes"><a class="botao primario" href="${DOWNLOAD}" data-baixar>Baixar plugin</a>
      <button type="button" class="botao" data-verificar>${detectando ? 'Tentar novamente agora' : 'Já abri: verificar'}</button></div>
      ${procurandoPlugin ? '<p class="nota">A procura continua automaticamente. Aguarde a inicialização do plugin; não é preciso fechar o navegador.</p>' : ''}
      ${permissaoPlugin === 'prompt' && procurandoPlugin ? '<p class="alerta">Se o Chrome pedir acesso à rede local ou a aplicativos neste computador, clique em <strong>Permitir</strong> no aviso perto da barra de endereço.</p>' : ''}
      ${permissaoPlugin === 'denied' && procurandoPlugin ? '<p class="alerta">O acesso à rede local foi bloqueado para este site. Clique no ícone à esquerda do endereço, permita o acesso à rede local ou a aplicativos neste computador e clique em “Já abri: verificar”.</p>' : ''}`;
    $('#opcao-disco-alvo').hidden = true;
    alvo.value = 'navegador';
    return;
  }
  const mem = resumoMemoria(plugin.memoria);
  caixa.className = 'plugin-estado ligado';
  caixa.innerHTML = `<p><strong>✔ Plugin conectado</strong> · v${escapar(plugin.versao)}</p>
    <p>${escapar(plugin.cpu)}${mem ? `<br>${escapar(mem)}` : ''}</p>
    ${plugin.pawnio ? '' : '<p class="alerta">Para a temperatura da CPU, instale o driver gratuito <a href="https://pawnio.eu/" target="_blank" rel="noopener">PawnIO</a> e reabra o plugin.</p>'}
    ${plugin.administrador ? '' : '<p class="alerta">O plugin está sem permissão de administrador: SMART e parte dos sensores ficam de fora.</p>'}`;
  const escolhido = alvo.value;
  alvo.innerHTML = '<option value="navegador">Navegador (OPFS)</option>' + plugin.unidades.map((u) =>
    `<option value="${escapar(u.letra)}">Disco real ${escapar(u.letra)}${u.rotulo ? ` (${escapar(u.rotulo)})` : ''} · ${formatarNumero(u.livreGB, 0)} GB livres</option>`).join('');
  const opcoes = [...alvo.options].map((o) => o.value);
  alvo.value = escolhido !== 'navegador' && opcoes.includes(escolhido) ? escolhido : (plugin.unidades[0]?.letra || 'navegador');
  $('#opcao-disco-alvo').hidden = false;
  const card = document.querySelector('.card-teste[data-teste="disco"]');
  if (card.classList.contains('desativado')) {
    card.classList.remove('desativado');
    card.querySelector('input').disabled = false;
  }
}

function desativarCard(id, motivo) {
  const card = document.querySelector(`.card-teste[data-teste="${id}"]`);
  const caixa = card.querySelector('input[type=checkbox]');
  caixa.checked = false;
  caixa.disabled = true;
  card.classList.add('desativado');
  card.querySelector('.card-desc').textContent = motivo + ' neste navegador.';
}

function escapar(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function lerOpcoes() {
  const form = (nome) => document.querySelector(`[name="${nome}"]`);
  const [w, h] = form('gpuRes').value.split('x').map(Number);
  return {
    cpu: { threads: Number(form('cpuThreads').value) },
    gpu: { resolucao: [w, h], intensidade: Number(form('gpuInt').value) },
    memoria: { mib: Number(form('memMiB').value), workers: sistema?.dispositivo.tipo === 'celular' ? 1 : undefined },
    disco: { mib: Number(form('discoMiB').value), unidade: plugin ? form('discoAlvo').value : 'navegador' },
    pressao: {},
  };
}

function confirmarRiscos() {
  try { if (localStorage.getItem('slt-aceite') === '1') return Promise.resolve(true); } catch { /* sem storage */ }
  const dlg = $('#dialogo-aviso');
  return new Promise((ok) => {
    dlg.addEventListener('close', () => {
      const aceitou = dlg.returnValue === 'ok' && $('#aceite').checked;
      if (aceitou) { try { localStorage.setItem('slt-aceite', '1'); } catch { /* sem storage */ } }
      ok(aceitou);
    }, { once: true });
    dlg.showModal();
  });
}

async function pedirInicio(maxStress) {
  if (execucao) return;
  let ids = maxStress
    ? ORDEM.filter((id) => !document.querySelector(`.card-teste[data-teste="${id}"] input`).disabled)
    : [...document.querySelectorAll('input[name=teste]:checked')].map((i) => i.value);
  ids = ORDEM.filter((id) => ids.includes(id));
  if (!ids.length) { alert('Selecione pelo menos um teste.'); return; }
  if (!(await confirmarRiscos())) return;
  const duracaoS = Number(document.querySelector('input[name=duracao]:checked').value);
  executar(ids, duracaoS, maxStress ? 'MAX STRESS' : ids.length > 1 ? 'Testes combinados' : `Teste de ${NOMES[ids[0]]}`);
}

// ---------- Execução ----------

function registrar(tipo, msg) {
  if (!execucao) return;
  const t = (performance.now() - execucao.t0) / 1000;
  execucao.eventos.push({ t, tipo, msg });
  const li = document.createElement('li');
  li.className = tipo;
  li.innerHTML = `<time>${formatarDuracao(t)}</time> ${escapar(msg)}`;
  const log = $('#log');
  log.prepend(li);
  while (log.children.length > 200) log.lastChild.remove();
}

function montarPaineis(ids) {
  const html = ids.map((id) => {
    const metricas = METRICAS[id];
    const principal = metricas[0];
    return `<article class="painel" data-comp="${id}">
      <header><h3>${NOMES[id]}</h3><span class="estado" data-estado>iniciando…</span></header>
      <p class="valor-grande"><span data-valor="${principal.chave}">—</span> <small>${principal.unidade}</small></p>
      <canvas class="spark" height="44" data-spark></canvas>
      <dl class="metricas-pequenas">
        ${metricas.slice(1).filter((m) => !m.plugin || execucao.monitor).map((m) => `<div><dt>${m.rotulo}</dt><dd><span data-valor="${m.chave}">—</span> ${m.unidade}</dd></div>`).join('')}
      </dl>
    </article>`;
  }).join('');
  $('#paineis').innerHTML = html;
}

function atualizarPaineis() {
  for (const [id, comp] of Object.entries(execucao.componentes)) {
    if (id === 'pressao') continue;
    const painel = document.querySelector(`.painel[data-comp="${id}"]`);
    if (!painel) continue;
    const estado = painel.querySelector('[data-estado]');
    const erros = comp.series.erros?.at(-1) ?? comp.series.divergenciasReferencia?.at(-1) ?? comp.series.artefatos?.at(-1) ?? 0;
    if (comp.falhaFatal) { estado.textContent = 'inconclusivo · falha do motor'; estado.className = 'estado falha'; }
    else if (erros > 0) { estado.textContent = `${erros} erro(s) de verificação`; estado.className = 'estado falha'; }
    else if (comp.iniciado) { estado.textContent = 'rodando · sem erros'; estado.className = 'estado ok'; }
    for (const m of METRICAS[id]) {
      const el = painel.querySelector(`[data-valor="${m.chave}"]`);
      const v = comp.series[m.chave]?.at(-1);
      if (el && v !== undefined) el.textContent = formatarNumero(v, m.casas);
    }
    const principal = METRICAS[id][0].chave;
    sparkline(painel.querySelector('[data-spark]'), comp.series[principal] || []);
  }
}

function prepararTelaGPU(ativo) {
  const caixa = $('#tela-gpu');
  caixa.innerHTML = '';
  caixa.hidden = !ativo;
  if (!ativo) return null;
  // Canvas novo a cada execução: o contexto anterior foi descartado no fim do teste.
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Cena do teste de GPU');
  caixa.append(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round((caixa.clientWidth || 640) * dpr);
  canvas.height = Math.round(canvas.width * 9 / 16);
  return canvas;
}

async function executar(ids, duracaoS, modo) {
  const opcoes = lerOpcoes();
  execucao = {
    ids, duracaoS, modo,
    inicio: new Date(),
    t0: performance.now(),
    eventos: [],
    componentes: {},
    opcoes,
    compartilhar: $('#compartilhar-benchmark').checked,
  };
  const ex = execucao;
  ex.protecaoMovel = sistema.dispositivo.tipo === 'celular' ? new ProtecaoDesempenhoMovel() : null;
  // Começa antes das inicializações: um worker que não avisa "pronto" não prende o prazo.
  ex.relogio = setInterval(() => { if (execucao === ex) tique(); }, 1000);
  if (duracaoS) ex.prazo = setTimeout(() => { if (execucao === ex) finalizar('Tempo concluído'); }, duracaoS * 1000);
  opcoes.gpu.prazoMs = duracaoS ? ex.t0 + duracaoS * 1000 : Infinity;
  document.body.classList.add('rodando');
  $('#relatorio').hidden = true;
  $('#aovivo').hidden = false;
  $('#log').innerHTML = '';
  $('#android-sensores-vivo').textContent = '';
  $('#android-sensores-detalhes').textContent = '';
  $('#tempo-decorrido').textContent = '00:00';
  $('#tempo-restante').textContent = '';
  $('#barra-progresso').style.width = '0%';
  $('#aovivo-modo').textContent = modo;
  opcoes.gpu.canvas = prepararTelaGPU(ids.includes('gpu'));
  $('#aovivo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  for (const b of document.querySelectorAll('#btn-selecionados, #btn-max')) b.disabled = true;

  try {
    const lock = await navigator.wakeLock?.request('screen');
    if (ex.finalizando) { await lock?.release(); return; }
    ex.wakeLock = lock;
  } catch { /* sem wake lock */ }
  if (ex.finalizando) return;

  const todos = [...ids];
  if (MonitorPressao.disponivel()) todos.push('pressao');
  const aoEvento = ({ tipo, msg }) => { if (execucao === ex && !ex.finalizando) registrar(tipo, msg); };
  registrar('log', `${modo} iniciado: ${ids.map((i) => NOMES[i]).join(', ')} · ${duracaoS ? formatarDuracao(duracaoS) : 'sem limite de tempo'}.`);

  const discoReal = ids.includes('disco') && opcoes.disco.unidade !== 'navegador';
  if (android) {
    if (typeof globalThis.SLTAndroid.preparar === 'function') {
      const preparado = JSON.parse(globalThis.SLTAndroid.preparar(JSON.stringify({ duracaoS, limites: limitesDaTela() })));
      if (preparado.erro) { registrar('erro', preparado.erro); await finalizar(preparado.erro); return; }
    }
    execucao.monitor = new MonitorAndroid(); execucao.monitor.iniciar();
    execucao.protecao = new ProtecaoTemperatura(limitesDaTela());
    registrar('log', 'Aplicativo Android: testes nativos e sensores disponíveis ativos.');
  } else if (plugin) {
    let discos = [];
    try { discos = await lerDiscos(); } catch { /* segue sem o mapa de discos */ }
    if (ex.finalizando) return;
    execucao.monitor = new MonitorSensores(plugin, {
      gpuWebgl: sistema?.gpu,
      unidadeDisco: discoReal ? opcoes.disco.unidade : 'C:',
      discos,
    });
    execucao.monitor.iniciar();
    registrar('log', `Plugin conectado: sensores reais ativos${plugin.pawnio ? '' : ' (sem PawnIO, a temperatura da CPU fica de fora)'}.`);
    const limites = limitesDaTela();
    execucao.protecao = new ProtecaoTemperatura(limites);
    registrar('log', limites.ativa
      ? `Proteção de temperatura ligada: para tudo se a CPU passar de ${limites.cpu} °C ou a GPU de ${limites.gpu} °C.`
      : 'Proteção de temperatura desligada: as temperaturas só são registradas.');
    mostrarTemperaturas({}, limites);
  } else {
    $('#temperaturas').hidden = true;
  }
  montarPaineis(ids);

  await Promise.all(todos.map(async (id) => {
    if (ex.finalizando) return;
    const Classe = id === 'disco' && discoReal ? TesteDiscoPlugin : CLASSES[id];
    const inst = android && ['cpu', 'memoria', 'disco'].includes(id) ? new TesteAndroid(id) : new Classe();
    const comp = { instancia: inst, series: {}, tempos: {}, iniciado: false };
    ex.componentes[id] = comp;
    try {
      await inst.iniciar(opcoes[id], aoEvento);
      if (ex.finalizando) { await inst.parar(); return; }
      comp.iniciado = true;
    } catch (e) {
      comp.falhaFatal = `Não foi possível iniciar: ${e.message}`;
      registrar('erro', `${NOMES[id]}: ${e.message}`);
    }
  }));
}

function tique() {
  const ex = execucao;
  if (!ex || ex.finalizando) return;
  const decorrido = (performance.now() - ex.t0) / 1000;
  if (ex.duracaoS && decorrido >= ex.duracaoS) { finalizar('Tempo concluído'); return; }
  if (android && ex.monitor?.ultima?.paradaTermica) {
    registrar('erro', ex.monitor.ultima.paradaTermica);
    ex.interrupcaoAndroid = ex.monitor.ultima.paradaTermica;
    finalizar(`Proteção Android: ${ex.monitor.ultima.paradaTermica}`); return;
  }
  if (android && ex.monitor?.ultima?.interrupcao) {
    ex.interrupcaoAndroid = ex.monitor.ultima.interrupcao;
    finalizar(ex.interrupcaoAndroid); return;
  }
  if (ex.monitor?.desconectado && !ex.avisouPlugin) {
    ex.avisouPlugin = true;
    registrar('erro', 'O plugin parou de responder: os sensores reais saíram do teste.');
  }
  for (const [id, comp] of Object.entries(ex.componentes)) {
    if (!comp.iniciado || comp.falhaFatal) continue;
    let amostra = null;
    try { amostra = comp.instancia.amostra(); } catch (e) { registrar('erro', e.message); }
    if (ex.monitor && id !== 'pressao') amostra = { ...(amostra || {}), ...ex.monitor.para(id) };
    if (!amostra || !Object.keys(amostra).length) continue;
    for (const [k, v] of Object.entries(amostra)) {
      if (!Number.isFinite(v)) continue;
      (comp.series[k] ||= []).push(v);
      (comp.tempos[k] ||= []).push(decorrido);
    }
    const fatal = comp.instancia.falhaFatal;
    if (fatal && !comp.falhaFatal) comp.falhaFatal = fatal;
  }
  atualizarPaineis();
  if (android && ex.monitor?.ultima) mostrarEstadoAndroid(ex.monitor.ultima);
  const falhaGpu = ex.componentes.gpu?.instancia.falhaFatal;
  if (falhaGpu) { ex.componentes.gpu.falhaFatal = falhaGpu; finalizar('GPU interrompida: ' + falhaGpu); return; }
  const queda = ex.protecaoMovel?.verificar(decorrido, {
    cpu: ex.componentes.cpu?.series.gflops?.at(-1), gpu: ex.componentes.gpu?.series.passadasPorSegundo?.at(-1),
  });
  if (queda) {
    ex.interrupcaoMovel = `Carga encerrada após queda persistente de ${Math.round(queda.queda)}% na ${queda.componente.toUpperCase()}. Pode haver limite térmico, de energia ou disputa por recursos; sem sensor não é possível confirmar a temperatura. Aguarde o aparelho esfriar antes de repetir.`;
    finalizar(ex.interrupcaoMovel); return;
  }

  // A proteção olha CPU e GPU mesmo quando só outro componente está sendo testado.
  if (ex.protecao && ex.monitor?.ultima) {
    const temps = { cpu: ex.monitor.para('cpu').tempC ?? null, gpu: ex.monitor.para('gpu').tempC ?? null };
    const { avisos, disparo } = ex.protecao.verificar(temps);
    mostrarTemperaturas(temps, ex.protecao.limites);
    for (const a of avisos) {
      registrar('log', `${NOMES[a.componente]} a ${Math.round(a.temp)} °C, perto do limite de ${a.limite} °C.`);
    }
    if (disparo) {
      const msg = `${NOMES[disparo.componente]} chegou a ${Math.round(disparo.temp)} °C (limite ${disparo.limite} °C)`;
      registrar('erro', `Proteção de temperatura: ${msg}. Parando todos os testes.`);
      finalizar(`Parado pela proteção de temperatura: ${msg}`);
      return;
    }
  }

  $('#tempo-decorrido').textContent = formatarDuracao(decorrido);
  if (ex.duracaoS) {
    $('#tempo-restante').textContent = ` · faltam ${formatarDuracao(ex.duracaoS - decorrido)}`;
    $('#barra-progresso').style.width = `${Math.min(100, (decorrido / ex.duracaoS) * 100)}%`;
    if (decorrido >= ex.duracaoS) finalizar('Tempo concluído');
  } else {
    $('#tempo-restante').textContent = ' · sem limite';
    $('#barra-progresso').style.width = '100%';
  }
}

async function finalizar(motivo) {
  const ex = execucao;
  if (!ex || ex.finalizando) return;
  ex.finalizando = true;
  clearInterval(ex.relogio);
  clearTimeout(ex.prazo);
  const duracaoReal = (performance.now() - ex.t0) / 1000;
  registrar('log', `${motivo}. Encerrando testes…`);
  $('#btn-parar').disabled = true;
  $('#btn-parar').textContent = 'Encerrando e liberando recursos…';
  $('#tempo-decorrido').textContent = formatarDuracao(duracaoReal);
  $('#tempo-restante').textContent = ' · encerrando';
  if (motivo === 'Tempo concluído') $('#barra-progresso').style.width = '100%';

  // A GPU para antes de qualquer espera na bridge nativa ou na limpeza de arquivos.
  await ex.componentes.gpu?.instancia.parar();
  ex.monitor?.parar();
  await Promise.all(Object.values(ex.componentes).map(async (c) => {
    const erro = await encerrarComPrazo(c.instancia);
    if (erro) { c.falhaFatal ||= erro; registrar('erro', erro); }
  }));
  try { await ex.wakeLock?.release(); } catch { /* já liberado */ }
  let saudeDiscos = null;
  if (ex.monitor && !android) {
    try { saudeDiscos = await lerDiscos(); } catch { /* plugin fechado */ }
  }

  const componentes = {};
  for (const [id, c] of Object.entries(ex.componentes)) {
    let info = {};
    try { info = c.instancia.info(); } catch { c.falhaFatal ||= 'Não foi possível obter os detalhes finais desta carga.'; }
    componentes[id] = { series: c.series, tempos: c.tempos, info, falhaFatal: c.falhaFatal };
  }
  execucao = null;
  document.body.classList.remove('rodando');
  $('#btn-parar').disabled = false;
  $('#btn-parar').textContent = '■ Parar e ver relatório';
  for (const b of document.querySelectorAll('#btn-selecionados, #btn-max')) b.disabled = false;
  $('#aovivo').hidden = true;
  $('#tela-gpu').innerHTML = '';

  const relatorio = $('#relatorio');
  gerarRelatorio(relatorio, {
    modo: ex.modo,
    motivo,
    inicio: ex.inicio,
    perfil: ex.duracaoS === 120 ? 'rapido' : ex.duracaoS === 900 ? 'completo' : ex.duracaoS >= 1800 ? 'extremo' : ex.duracaoS ? 'personalizado' : 'indefinido',
    duracaoAlvoS: ex.duracaoS,
    duracaoS: duracaoReal,
    sistema,
    opcoes: { ...ex.opcoes, gpu: { ...ex.opcoes.gpu, canvas: undefined } },
    ids: ex.ids,
    componentes,
    eventos: ex.eventos,
    plugin: plugin && ex.monitor ? { versao: plugin?.versao, pawnio: plugin?.pawnio, administrador: plugin?.administrador, cpu: plugin?.cpu, memoria: resumoMemoria(plugin?.memoria) } : null,
    inventario: plugin,
    android,
    sensoresAndroid: android ? ex.monitor?.ultima : null,
    interrupcaoAndroid: ex.interrupcaoAndroid,
    interrupcaoMovel: ex.interrupcaoMovel,
    compartilhar: ex.compartilhar,
    oculta: ex.oculta,
    saudeDiscos,
    protecao: ex.protecao ? { limites: ex.protecao.limites, maxima: ex.protecao.maxima, disparo: ex.protecao.disparo } : null,
  });
  relatorio.hidden = false;
  relatorio.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Ligações ----------

$('#btn-selecionados').addEventListener('click', () => pedirInicio(false));
$('#btn-baixar-plugin').href = DOWNLOAD;
$('#btn-verificar-plugin').addEventListener('click', verificarPluginAgora);
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-verificar]')) verificarPluginAgora();
  // Quem baixou vai abrir o plugin em seguida: começa a procurar.
  if (e.target.closest('[data-baixar], #btn-baixar-plugin')) { lembrarPlugin(); setTimeout(procurarPlugin, 3000); }
});
$('#btn-max').addEventListener('click', () => pedirInicio(true));
$('#btn-parar').addEventListener('click', () => finalizar('Parado pelo usuário'));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && execucao) finalizar('Parado pelo usuário (Esc)'); });
window.addEventListener('slt:parada-nativa', (e) => {
  if (!execucao || typeof e.detail !== 'string') return;
  if (e.detail !== 'Tempo concluído') execucao.interrupcaoAndroid = e.detail;
  finalizar(e.detail);
});
document.addEventListener('visibilitychange', () => {
  if (!execucao) return;
  if (document.hidden && sistema?.dispositivo.tipo === 'celular') { execucao.oculta = true; finalizar('Celular saiu do primeiro plano; cargas encerradas.'); return; }
  if (document.hidden) execucao.oculta = true;
  registrar('log', document.hidden ? 'Aba escondida: o teste de GPU fica pausado até você voltar.' : 'Aba visível novamente.');
});
window.addEventListener('beforeunload', (e) => { if (execucao) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('slt:novo-teste', () => {
  $('#relatorio').hidden = true;
  $('#configurar').scrollIntoView({ behavior: 'smooth' });
});

iniciarRanking();
mostrarSistema().then(() => {
  prepararProtecao();
  mostrarPlugin();
  if (android) {
    const atualizar = () => { if (!execucao) mostrarEstadoAndroid(sensoresAndroid()); };
    atualizar(); setInterval(atualizar, 2000);
  }
  for (const b of document.querySelectorAll('#btn-selecionados, #btn-max')) b.disabled = false;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (sistema.so === 'Windows' && (pluginJaUsado() || local)) procurarPlugin();
}).catch(() => {
  $('#aviso-compat').hidden = false;
  $('#aviso-compat').textContent = 'Não foi possível identificar os recursos do aparelho. Atualize o navegador e recarregue a página.';
});
