// Conversa com o SLT Stress Test Plugin (programa local do Windows, em 127.0.0.1:5299).
// Ele entrega o que o navegador não alcança: temperatura, clocks e potência reais,
// frequência da memória, saúde SMART dos discos e benchmark de disco sem cache.

export const BASE = 'http://127.0.0.1:5299';
export const PROTOCOLO = 1;
export const DOWNLOAD = 'https://github.com/mikerock12/slt-stress-test/releases/latest/download/SLTStressTestPlugin.exe';

async function pedir(caminho, { metodo = 'GET', corpo, tempo = 4000 } = {}) {
  const resp = await fetch(BASE + caminho, {
    method: metodo,
    headers: metodo === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-SLT-Plugin': '1' },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(tempo),
    cache: 'no-store',
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || `Plugin respondeu ${resp.status}`);
  return dados;
}

// Devolve a apresentação do plugin ou null se ele não estiver ligado.
export async function detectarPlugin() {
  try {
    const ola = await pedir('/v1/ola', { tempo: 1500 });
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
  if (!pentes.length) return null;
  const total = pentes.reduce((s, p) => s + (p.capacidadeGB || 0), 0);
  const tipos = [...new Set(pentes.map((p) => p.tipo).filter((t) => t && t !== 'desconhecido'))].join('/');
  const freqs = pentes.map((p) => p.configuradaMTs || p.velocidadeMTs).filter(Boolean);
  const freq = freqs.length ? Math.min(...freqs) : null;
  return `${Math.round(total)} GB ${tipos}${freq ? ` · ${freq} MT/s` : ''} (${pentes.length} ${pentes.length === 1 ? 'pente' : 'pentes'})`.replace('  ', ' ');
}

export function frequenciaMemoria(pentes = []) {
  const freqs = pentes.map((p) => p.configuradaMTs || p.velocidadeMTs).filter(Boolean);
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
