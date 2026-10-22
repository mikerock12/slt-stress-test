// Gráficos simples em canvas (sem biblioteca): sparkline ao vivo e gráfico do relatório.
import { formatarDuracao, formatarNumero, reduzir } from './metricas.js';

function prepararCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function cssVar(nome, padrao) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || padrao;
}

export function sparkline(canvas, valores, cor) {
  const { ctx, w, h } = prepararCanvas(canvas);
  const dados = reduzir(valores.slice(-180), 90);
  if (dados.length < 2) return;
  let min = Math.min(...dados);
  let max = Math.max(...dados);
  if (max === min) { max += 1; min -= 1; }
  const x = (i) => (i / (dados.length - 1)) * w;
  const y = (v) => h - 3 - ((v - min) / (max - min)) * (h - 6);
  ctx.beginPath();
  dados.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.strokeStyle = cor || cssVar('--accent', '#f7bd24');
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Gráfico do relatório: linha da série, linha tracejada da média e escala nos cantos.
export function graficoRelatorio(canvas, valores, { unidade = '', casas = 1, duracaoS = 0 } = {}) {
  const { ctx, w, h } = prepararCanvas(canvas);
  const dados = reduzir(valores, 160);
  const texto = cssVar('--muted', '#aab3c2');
  const grade = cssVar('--line', '#223044');
  const cor = cssVar('--accent', '#f7bd24');
  ctx.font = '11px system-ui, sans-serif';
  if (dados.length < 2) {
    ctx.fillStyle = texto;
    ctx.fillText('Poucos dados para o gráfico', 8, h / 2);
    return;
  }
  const esq = 4, dir = w - 4, topo = 16, base = h - 16;
  let min = Math.min(...dados);
  let max = Math.max(...dados);
  if (max === min) { max += Math.abs(max) * 0.05 || 1; min -= Math.abs(min) * 0.05 || 1; }
  const folga = (max - min) * 0.1;
  min -= folga; max += folga;
  const x = (i) => esq + (i / (dados.length - 1)) * (dir - esq);
  const y = (v) => base - ((v - min) / (max - min)) * (base - topo);

  ctx.strokeStyle = grade;
  ctx.lineWidth = 1;
  for (let k = 0; k <= 2; k++) {
    const yy = topo + ((base - topo) * k) / 2;
    ctx.beginPath(); ctx.moveTo(esq, yy); ctx.lineTo(dir, yy); ctx.stroke();
  }

  const media = dados.reduce((a, b) => a + b, 0) / dados.length;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = texto;
  ctx.beginPath(); ctx.moveTo(esq, y(media)); ctx.lineTo(dir, y(media)); ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  dados.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = texto;
  ctx.fillText(`${formatarNumero(max, casas)} ${unidade}`, esq, topo - 4);
  ctx.fillText(`${formatarNumero(min, casas)} ${unidade}`, esq, h - 3);
  if (duracaoS) {
    const fim = formatarDuracao(duracaoS);
    ctx.fillText(fim, dir - ctx.measureText(fim).width, h - 3);
  }
}
