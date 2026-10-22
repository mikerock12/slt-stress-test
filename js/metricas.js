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

// Resume uma série. A "queda" compara o começo com o fim (20% iniciais × 20% finais),
// ignorando os primeiros 5% como aquecimento. Só existe com 10 amostras ou mais.
export function resumir(valores) {
  const n = valores.length;
  if (!n) return { n: 0, media: null, min: null, max: null, desvio: null, cv: null, inicio: null, fim: null, queda: null };

  let min = Infinity;
  let max = -Infinity;
  for (const v of valores) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const media = mediaDe(valores);
  let quad = 0;
  for (const v of valores) quad += (v - media) ** 2;
  const desvio = Math.sqrt(quad / n);
  const cv = media !== 0 ? (desvio / Math.abs(media)) * 100 : null;

  let inicio = null;
  let fim = null;
  let queda = null;
  if (n >= 10) {
    const aquecimento = Math.floor(n * 0.05);
    const util = valores.slice(aquecimento);
    const janela = Math.max(2, Math.floor(util.length * 0.2));
    inicio = mediaDe(util.slice(0, janela));
    fim = mediaDe(util.slice(-janela));
    queda = inicio > 0 ? ((inicio - fim) / inicio) * 100 : null;
  }

  return { n, media, min, max, desvio, cv, inicio, fim, queda };
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
