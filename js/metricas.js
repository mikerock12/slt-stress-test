// Estatística pura das séries coletadas durante o teste (sem DOM, testada em Node).

export class Serie {
  constructor() {
    this.valores = [];
    this.tempos = [];
  }

  adicionar(valor, tempoS) {
    if (!Number.isFinite(valor)) return;
    this.valores.push(valor);
    this.tempos.push(tempoS);
  }

  get ultimo() {
    return this.valores.length ? this.valores[this.valores.length - 1] : null;
  }
}

function mediaDe(lista) {
  if (!lista.length) return null;
  let soma = 0;
  for (const v of lista) soma += v;
  return soma / lista.length;
}

function percentil(ordenados, proporcao) {
  if (!ordenados.length) return null;
  const posicao = (ordenados.length - 1) * proporcao;
  const inferior = Math.floor(posicao);
  const fracao = posicao - inferior;
  return ordenados[inferior] + (ordenados[inferior + 1] - ordenados[inferior] || 0) * fracao;
}

function janelasDe(pontos, inicio, segundos = 5) {
  const grupos = new Map();
  for (const p of pontos) {
    const indice = Math.floor((p.t - inicio) / segundos);
    if (!grupos.has(indice)) grupos.set(indice, []);
    grupos.get(indice).push(p.v);
  }
  return [...grupos.entries()].sort(([a], [b]) => a - b).map(([, valores]) => mediaDe(valores));
}

function resumoTemporal(pontos, duracaoAlvoS, intervaloEsperadoS) {
  const vazio = { tempoUtilS: null, cobertura: null, amostrasIrregulares: null, regressoesIntermediarias: null, quedaPicoSustentadaPct: null };
  if (pontos.length < 2 || pontos.some((p) => !Number.isFinite(p.t))) return vazio;
  let tempoUtilS = Math.min(intervaloEsperadoS, Math.max(0, pontos[0].t) || intervaloEsperadoS);
  let amostrasIrregulares = 0;
  for (let i = 1; i < pontos.length; i++) {
    const delta = pontos[i].t - pontos[i - 1].t;
    tempoUtilS += Math.min(intervaloEsperadoS * 1.5, Math.max(0, delta));
    if (delta < intervaloEsperadoS * 0.5 || delta > intervaloEsperadoS * 1.5) amostrasIrregulares++;
  }
  const fimObservado = pontos[pontos.length - 1].t;
  const alvo = Number.isFinite(duracaoAlvoS) && duracaoAlvoS > 0 ? duracaoAlvoS : 0;
  const referencia = Math.max(alvo, fimObservado, tempoUtilS);
  const cobertura = referencia > 0 ? Math.min(1, tempoUtilS / referencia) : null;
  const janelas = janelasDe(pontos, pontos[0].t);
  let regressoesIntermediarias = janelas.length >= 3 ? 0 : null;
  if (regressoesIntermediarias !== null) {
    for (let i = 1; i < janelas.length - 1; i++) {
      if (janelas[i - 1] > 0 && janelas[i] <= janelas[i - 1] * 0.88 && janelas[i + 1] <= janelas[i - 1] * 0.88) regressoesIntermediarias++;
    }
  }
  const pico = janelas.length > 1 ? Math.max(...janelas.slice(0, -1)) : null;
  const janelaFinalS = Math.max(2, (fimObservado - pontos[0].t) * 0.2);
  let finais = pontos.filter((p) => p.t >= fimObservado - janelaFinalS);
  if (finais.length < 2) finais = pontos.slice(-2);
  const fim = mediaDe(finais.map((p) => p.v));
  const quedaPicoSustentadaPct = pico > 0 && janelas.length >= 3 ? ((pico - fim) / pico) * 100 : null;
  return { tempoUtilS, cobertura, amostrasIrregulares, regressoesIntermediarias, quedaPicoSustentadaPct };
}

// Sem timestamps conserva o cálculo legado por contagem. Com timestamps, aquecimento e
// janelas usam tempo monotônico e lacunas reduzem a cobertura em vez de virarem zeros.
export function resumir(valores, opcoes = {}) {
  const temposS = opcoes.temposS;
  const temposCompletos = Array.isArray(temposS) && temposS.length === valores.length && temposS.every(Number.isFinite);
  const pontos = [];
  for (let i = 0; i < valores.length; i++) {
    if (!Number.isFinite(valores[i]) || opcoes.validos?.[i] === false) continue;
    pontos.push({ v: valores[i], t: temposCompletos ? temposS[i] : null });
  }
  const lista = pontos.map((p) => p.v);
  const n = lista.length;
  const vazio = { n: 0, media: null, min: null, max: null, desvio: null, cv: null, p5: null, p50: null, p95: null,
    inicio: null, fim: null, queda: null, quedaInicioFimPct: null, tempoUtilS: null, cobertura: null,
    amostrasIrregulares: null, regressoesIntermediarias: null, quedaPicoSustentadaPct: null };
  if (!n) return vazio;

  const ordenados = [...lista].sort((a, b) => a - b);
  const min = ordenados[0];
  const max = ordenados[n - 1];
  const media = mediaDe(lista);
  let quad = 0;
  for (const v of lista) quad += (v - media) ** 2;
  const desvio = Math.sqrt(quad / n);
  const cv = media !== 0 ? (desvio / Math.abs(media)) * 100 : null;
  const temporal = resumoTemporal(pontos, opcoes.duracaoAlvoS, opcoes.intervaloEsperadoS || 1);

  let inicio = null;
  let fim = null;
  let queda = null;
  if (n >= 10 && temposCompletos) {
    const primeiro = pontos[0].t;
    const ultimo = pontos[n - 1].t;
    const aquecimentoS = Math.max(1, Math.min(5, (ultimo - primeiro) * 0.05));
    const util = pontos.filter((p) => p.t >= primeiro + aquecimentoS);
    if (util.length >= 10) {
      const t0 = util[0].t;
      const t1 = util[util.length - 1].t;
      const janelaS = Math.max(2, (t1 - t0) * 0.2);
      const iniciais = util.filter((p) => p.t <= t0 + janelaS);
      const finais = util.filter((p) => p.t >= t1 - janelaS);
      if (iniciais.length >= 2 && finais.length >= 2 && iniciais[iniciais.length - 1].t < finais[0].t) {
        inicio = mediaDe(iniciais.map((p) => p.v));
        fim = mediaDe(finais.map((p) => p.v));
        queda = inicio > 0 ? ((inicio - fim) / inicio) * 100 : null;
      }
    }
  } else if (n >= 10) {
    const aquecimento = Math.floor(n * 0.05);
    const util = lista.slice(aquecimento);
    const janela = Math.max(2, Math.floor(util.length * 0.2));
    inicio = mediaDe(util.slice(0, janela));
    fim = mediaDe(util.slice(-janela));
    queda = inicio > 0 ? ((inicio - fim) / inicio) * 100 : null;
  }

  return { n, media, min, max, desvio, cv, p5: percentil(ordenados, 0.05), p50: percentil(ordenados, 0.5),
    p95: percentil(ordenados, 0.95), inicio, fim, queda, quedaInicioFimPct: queda, ...temporal };
}

// Reduz uma série longa para no máximo `pontos` valores (média por balde), para gráficos.
export function reduzir(valores, pontos = 120) {
  if (valores.length <= pontos) return valores.slice();
  const saida = [];
  const passo = valores.length / pontos;
  for (let i = 0; i < pontos; i++) {
    const a = Math.floor(i * passo);
    const b = Math.max(a + 1, Math.floor((i + 1) * passo));
    saida.push(mediaDe(valores.slice(a, b)));
  }
  return saida;
}

export function formatarDuracao(segundos) {
  const s = Math.max(0, Math.round(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dois = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${dois(m)}:${dois(r)}` : `${dois(m)}:${dois(r)}`;
}

export function formatarNumero(valor, casas = 1) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
