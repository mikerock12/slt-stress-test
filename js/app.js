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
import { DOWNLOAD, MonitorSensores, detectarPlugin, lerDiscos, resumoMemoria } from './plugin.js';

const CLASSES = { cpu: TesteCPU, gpu: TesteGPU, memoria: TesteMemoria, disco: TesteDisco, pressao: MonitorPressao };
const ORDEM = ['cpu', 'gpu', 'memoria', 'disco'];
const $ = (sel) => document.querySelector(sel);

let sistema = null;
let execucao = null;
let plugin = null;
let procurandoPlugin = null;

// ---------- Início ----------

async function mostrarSistema() {
  sistema = await coletarSistema();
  const linhas = [
    ['Processador', sistema.threads ? `${sistema.threads} threads lógicas` : 'não informado'],
    ['Memória', sistema.memoriaGB ? `${sistema.memoriaGB >= 8 ? '8 GB ou mais' : `~${sistema.memoriaGB} GB`}` : 'não informada'],
    ['GPU', sistema.gpu],
    ['Sistema', `${sistema.so} · ${sistema.navegador}`],
    ['Tela', sistema.tela],
    ['Armazenamento p/ teste', sistema.armazenamentoLivreGB ? `${formatarNumero(sistema.armazenamentoLivreGB, 0)} GB disponíveis` : 'não informado'],
    ['Sensor de pressão', sistema.pressao ? 'disponível (Compute Pressure)' : 'indisponível neste navegador'],
  ];
  if (sistema.bateria) {
    linhas.push(['Energia', `${sistema.bateria.carregando ? 'na tomada' : 'na bateria'} · ${sistema.bateria.nivel}%`]);
  }
  $('#sistema').innerHTML = linhas.map(([t, d]) => `<div><dt>${t}</dt><dd>${escapar(d)}</dd></div>`).join('');

  const sel = $('#cpu-threads');
  const n = sistema.threads || 4;
  const opcoes = [[n, `Todas (${n})`]];
  if (n > 2) opcoes.push([Math.ceil(n / 2), `Metade (${Math.ceil(n / 2)})`]);
  opcoes.push([1, '1 thread']);
  sel.innerHTML = opcoes.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');

  const avisos = [];
  if (!sistema.webgl2) { desativarCard('gpu', 'WebGL2 indisponível'); avisos.push('GPU: o navegador não oferece WebGL2 (ative a aceleração por hardware).'); }
  if (!sistema.opfs) { desativarCard('disco', 'OPFS indisponível'); avisos.push('Disco: o navegador não oferece o armazenamento OPFS.'); }
  if (sistema.bateria && !sistema.bateria.carregando) avisos.push('Seu aparelho está na bateria: ligue na tomada para o resultado refletir o desempenho máximo.');
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

async function atualizarPlugin() {
  const anterior = !!plugin;
  plugin = await detectarPlugin();
  if (plugin) lembrarPlugin();
  mostrarPlugin();
  if (plugin && !anterior && execucao) registrar('log', 'Plugin conectado: os sensores entram a partir do próximo teste.');
  if (plugin) { clearInterval(procurandoPlugin); procurandoPlugin = null; }
}

function procurarPlugin() {
  atualizarPlugin();
  if (!procurandoPlugin) procurandoPlugin = setInterval(() => { if (!execucao) atualizarPlugin(); }, 4000);
}

function mostrarPlugin() {
  const caixa = $('#plugin-estado');
  const alvo = $('#disco-alvo');
  if (!plugin) {
    caixa.className = 'plugin-estado';
    caixa.innerHTML = `<p><strong>Plugin não conectado.</strong> Sem ele ficam de fora temperatura,
      clocks reais, frequência da memória, SMART e o teste de disco real.</p>
      <div class="acoes"><a class="botao primario" href="${DOWNLOAD}" data-baixar>Baixar plugin</a>
      <button type="button" class="botao" data-verificar>${procurandoPlugin ? 'Procurando…' : 'Já abri: verificar'}</button></div>`;
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
    memoria: { mib: Number(form('memMiB').value) },
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
    const erros = comp.series.erros?.at(-1) ?? comp.series.artefatos?.at(-1) ?? 0;
    if (comp.falhaFatal) { estado.textContent = 'falhou'; estado.className = 'estado falha'; }
    else if (erros > 0) { estado.textContent = `${erros} erro(s)`; estado.className = 'estado falha'; }
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
  };
  document.body.classList.add('rodando');
  $('#relatorio').hidden = true;
  $('#aovivo').hidden = false;
  $('#log').innerHTML = '';
  $('#aovivo-modo').textContent = modo;
  opcoes.gpu.canvas = prepararTelaGPU(ids.includes('gpu'));
  $('#aovivo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  for (const b of document.querySelectorAll('#btn-selecionados, #btn-max')) b.disabled = true;

  try { execucao.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* sem wake lock */ }

  const todos = [...ids];
  if (MonitorPressao.disponivel()) todos.push('pressao');
  const aoEvento = ({ tipo, msg }) => registrar(tipo, msg);
  registrar('log', `${modo} iniciado: ${ids.map((i) => NOMES[i]).join(', ')} · ${duracaoS ? formatarDuracao(duracaoS) : 'sem limite de tempo'}.`);

  const discoReal = ids.includes('disco') && opcoes.disco.unidade !== 'navegador';
  if (plugin) {
    let discos = [];
    try { discos = await lerDiscos(); } catch { /* segue sem o mapa de discos */ }
    execucao.monitor = new MonitorSensores(plugin, {
      gpuWebgl: sistema?.gpu,
      unidadeDisco: discoReal ? opcoes.disco.unidade : 'C:',
      discos,
    });
    execucao.monitor.iniciar();
    registrar('log', `Plugin conectado: sensores reais ativos${plugin.pawnio ? '' : ' (sem PawnIO, a temperatura da CPU fica de fora)'}.`);
  }
  montarPaineis(ids);

  await Promise.all(todos.map(async (id) => {
    const Classe = id === 'disco' && discoReal ? TesteDiscoPlugin : CLASSES[id];
    const inst = new Classe();
    const comp = { instancia: inst, series: {}, iniciado: false };
    execucao.componentes[id] = comp;
    try {
      await inst.iniciar(opcoes[id], aoEvento);
      comp.iniciado = true;
    } catch (e) {
      comp.falhaFatal = `Não foi possível iniciar: ${e.message}`;
      registrar('erro', `${NOMES[id]}: ${e.message}`);
    }
  }));
  if (!execucao) return; // parado durante a inicialização

  execucao.relogio = setInterval(tique, 1000);
}

function tique() {
  const ex = execucao;
  if (!ex) return;
  const decorrido = (performance.now() - ex.t0) / 1000;
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
    }
    const fatal = comp.instancia.falhaFatal;
    if (fatal && !comp.falhaFatal) comp.falhaFatal = fatal;
  }
  atualizarPaineis();

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
  const duracaoReal = (performance.now() - ex.t0) / 1000;
  registrar('log', `${motivo}. Encerrando testes…`);
  $('#btn-parar').disabled = true;

  ex.monitor?.parar();
  await Promise.all(Object.values(ex.componentes).map((c) => c.instancia.parar().catch(() => {})));
  try { await ex.wakeLock?.release(); } catch { /* já liberado */ }
  let saudeDiscos = null;
  if (ex.monitor) {
    try { saudeDiscos = await lerDiscos(); } catch { /* plugin fechado */ }
  }

  const componentes = {};
  for (const [id, c] of Object.entries(ex.componentes)) {
    componentes[id] = { series: c.series, info: c.instancia.info(), falhaFatal: c.falhaFatal };
  }
  execucao = null;
  document.body.classList.remove('rodando');
  $('#btn-parar').disabled = false;
  for (const b of document.querySelectorAll('#btn-selecionados, #btn-max')) b.disabled = false;
  $('#aovivo').hidden = true;
  $('#tela-gpu').innerHTML = '';

  const relatorio = $('#relatorio');
  gerarRelatorio(relatorio, {
    modo: ex.modo,
    motivo,
    inicio: ex.inicio,
    duracaoAlvoS: ex.duracaoS,
    duracaoS: duracaoReal,
    sistema,
    opcoes: { ...ex.opcoes, gpu: { ...ex.opcoes.gpu, canvas: undefined } },
    ids: ex.ids,
    componentes,
    eventos: ex.eventos,
    plugin: ex.monitor ? { versao: plugin?.versao, pawnio: plugin?.pawnio, administrador: plugin?.administrador, cpu: plugin?.cpu, memoria: resumoMemoria(plugin?.memoria) } : null,
    saudeDiscos,
  });
  relatorio.hidden = false;
  relatorio.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Ligações ----------

$('#btn-selecionados').addEventListener('click', () => pedirInicio(false));
$('#btn-baixar-plugin').href = DOWNLOAD;
$('#btn-verificar-plugin').addEventListener('click', procurarPlugin);
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-verificar]')) procurarPlugin();
  // Quem baixou vai abrir o plugin em seguida: começa a procurar.
  if (e.target.closest('[data-baixar], #btn-baixar-plugin')) { lembrarPlugin(); setTimeout(procurarPlugin, 3000); }
});
$('#btn-max').addEventListener('click', () => pedirInicio(true));
$('#btn-parar').addEventListener('click', () => finalizar('Parado pelo usuário'));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && execucao) finalizar('Parado pelo usuário (Esc)'); });
document.addEventListener('visibilitychange', () => {
  if (!execucao) return;
  registrar('log', document.hidden ? 'Aba escondida: o teste de GPU fica pausado até você voltar.' : 'Aba visível novamente.');
});
window.addEventListener('beforeunload', (e) => { if (execucao) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('slt:novo-teste', () => {
  $('#relatorio').hidden = true;
  $('#configurar').scrollIntoView({ behavior: 'smooth' });
});

mostrarSistema().then(() => {
  mostrarPlugin();
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (pluginJaUsado() || local) procurarPlugin();
});
