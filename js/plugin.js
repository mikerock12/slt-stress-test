// Conversa com o SLT Stress Test Plugin (programa local do Windows, em 127.0.0.1:5299).
// Ele entrega o que o navegador não alcança: temperatura, clocks e potência reais,
// frequência da memória, saúde SMART dos discos e benchmark de disco sem cache.

export const BASE = 'http://127.0.0.1:5299';
export const PROTOCOLO = 1;
export const DOWNLOAD = 'https://github.com/mikerock12/slt-stress-test/releases/latest/download/SLTStressTestPlugin.exe';

async function pedir(caminho, { metodo = 'GET', corpo, tempo = 4000, signal } = {}) {
  const resp = await fetch(BASE + caminho, {
    method: metodo,
    headers: metodo === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-SLT-Plugin': '1' },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(tempo)]) : AbortSignal.timeout(tempo),
    targetAddressSpace: 'loopback',
    cache: 'no-store',
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || `Plugin respondeu ${resp.status}`);
  return dados;
}

// Permissão do Chrome para um site acessar 127.0.0.1 ("acesso à rede local"):
// 'granted', 'prompt', 'denied' ou null quando o navegador não tem esse controle.
export async function permissaoRedeLocal() {
  for (const name of ['loopback-network', 'local-network-access']) {
    try { return (await navigator.permissions.query({ name })).state; } catch { /* nome não suportado */ }
  }
  return null;
}

// Começa o fetch no próprio clique, antes de consultar permissões. A apresentação faz
// consultas WMI/SMART e pode demorar na primeira abertura: 1,5 s não bastava quando o
// Chrome já tinha permissão. Cada tentativa tem URL própria e prazo de 60 s, incluindo
// o aviso de rede local; um novo clique pode cancelar a tentativa antiga.
export async function detectarPlugin({ signal } = {}) {
  try {
    const ola = await pedir(`/v1/ola?tentativa=${crypto.randomUUID()}`, { tempo: 60000, signal });
    return ola.protocolo === PROTOCOLO ? ola : null;
  } catch {
    return null;
  }
}

export const lerSensores = () => pedir('/v1/sensores', { tempo: 2500 });
export const lerDiscos = () => pedir('/v1/discos', { tempo: 15000 });
export const estadoBenchmark = () => pedir('/v1/disco/benchmark');
export const iniciarBenchmark = (pedido) => pedir('/v1/disco/benchmark', { metodo: 'POST', corpo: pedido });
export const cancelarBenchmark = () => pedir('/v1/disco/benchmark/cancelar', { metodo: 'POST', corpo: {} });

// Resumo da memória instalada: "16 GB DDR4 · 2133 MT/s (2 pentes)".
export function resumoMemoria(pentes = []) {
  if (!Array.isArray(pentes) || !pentes.length) return null;
  const capacidades = pentes.map((p) => p.capacidadeGB);
  const capacidade = capacidades.every((n) => Number.isFinite(n) && n > 0)
    ? `${numeroMemoria(capacidades.reduce((s, n) => s + n, 0))} GB`
    : 'capacidade não informada';
  const tipos = [...new Set(pentes.map((p) => p.tipo && p.tipo !== 'desconhecido' ? p.tipo : 'tipo não informado'))].join('/');
  const freq = frequenciaMemoria(pentes);
  return `${capacidade} ${tipos}${freq ? ` · ${freq} MT/s` : ''} (${pentes.length} ${pentes.length === 1 ? 'pente' : 'pentes'})`;
}

const numeroMemoria = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 });

// Painel e relatório usam a mesma leitura nativa. A estimativa deviceMemory não
// identifica capacidade física nem DDR e não deve ocupar o lugar desses dados.
export function descricaoMemoria({ plugin, android } = {}) {
  const instalada = resumoMemoria(plugin?.memoria);
  if (instalada) return instalada;
  if (Number.isFinite(android?.memoria?.totalGB) && android.memoria.totalGB > 0) {
    return `${numeroMemoria(android.memoria.totalGB)} GiB · ${android.memoria.tipo || 'tipo não informado'} (Android)`;
  }
  if (plugin) return 'Capacidade e tipo não informados pelo Windows';
  return 'Não identificada — no Windows, abra o plugin para ler capacidade e tipo';
}

export function frequenciaMemoria(pentes = []) {
  const freqs = (Array.isArray(pentes) ? pentes : []).map((p) => p.configuradaMTs || p.velocidadeMTs).filter((n) => Number.isFinite(n) && n > 0);
  return freqs.length ? Math.min(...freqs) : null;
}

// Escolhe a GPU dos sensores que corresponde à usada pelo navegador.
function escolherGpu(gpus = [], nomeWebgl = '') {
  if (!gpus.length) return null;
  const alvo = nomeWebgl.toLowerCase();
  return gpus.find((g) => alvo && (alvo.includes(g.nome.toLowerCase()) || g.nome.toLowerCase().includes(alvo))) || gpus[0];
}

const normalizar = (t = '') => t.trim().toLowerCase();

// Lê os sensores em segundo plano (1 por segundo) e reparte os valores por componente.
export class MonitorSensores {
  constructor(ola, { gpuWebgl = '', unidadeDisco = 'C:', discos = [] } = {}) {
    this.ola = ola;
    this.gpuWebgl = gpuWebgl;
    this.freqMemoria = frequenciaMemoria(ola.memoria);
    const disco = discos.find((d) => d.letras?.includes(unidadeDisco));
    this.nomeDisco = disco ? normalizar(disco.nome) : null;
    this.ultima = null;
    this.falhas = 0;
  }

  iniciar() {
    const ciclo = async () => {
      try { this.ultima = await lerSensores(); this.falhas = 0; } catch { this.falhas++; }
    };
    ciclo();
    this.relogio = setInterval(ciclo, 1000);
  }

  parar() {
    clearInterval(this.relogio);
  }

  get desconectado() {
    return this.falhas >= 5;
  }

  // Valores do último segundo para o componente; só chaves com leitura real.
  para(componente) {
    const s = this.ultima;
    if (!s) return {};
    const saida = {};
    const por = (k, v) => { if (Number.isFinite(v)) saida[k] = v; };
    if (componente === 'cpu' && s.cpu) {
      por('tempC', s.cpu.tempC);
      por('clockReal', s.cpu.clockMHz ? s.cpu.clockMHz / 1000 : null);
      por('potenciaW', s.cpu.potenciaW);
      por('cargaPct', s.cpu.cargaPct);
    }
    if (componente === 'gpu') {
      const g = escolherGpu(s.gpus, this.gpuWebgl);
      if (g) {
        por('tempC', g.tempC);
        por('hotspotC', g.hotspotC);
        por('clockMHz', g.clockMHz);
        por('potenciaW', g.potenciaW);
        por('cargaPct', g.cargaPct);
      }
    }
    if (componente === 'memoria') {
      por('freqMTs', this.freqMemoria);
      por('tempC', s.memoria?.tempC);
    }
    if (componente === 'disco' && this.nomeDisco) {
      const d = s.discos?.find((x) => normalizar(x.nome) === this.nomeDisco);
      por('tempC', d?.tempC);
    }
    return saida;
  }
}
