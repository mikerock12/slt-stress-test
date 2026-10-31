import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumir, reduzir, formatarDuracao } from '../js/metricas.js';

test('resumir calcula média, extremos, percentis e coeficiente de variação', () => {
  const r = resumir([10, 10, 10, 10]);
  assert.equal(r.media, 10);
  assert.equal(r.min, 10);
  assert.equal(r.max, 10);
  assert.equal(r.p50, 10);
  assert.equal(r.cv, 0);
  assert.equal(r.queda, null, 'menos de 10 amostras não tem queda');
  assert.equal(r.cobertura, null);
});

test('resumir detecta queda de desempenho do início ao fim', () => {
  const valores = Array.from({ length: 100 }, (_, i) => (i < 50 ? 100 : 80));
  const r = resumir(valores);
  assert.ok(Math.abs(r.queda - 20) < 0.001, `queda ${r.queda}`);
});

test('janelas usam tempo monotônico e separam queda inicial, final e sustentada', () => {
  const valores = Array.from({ length: 120 }, (_, i) => i < 90 ? 100 : 80);
  const temposS = Array.from({ length: 120 }, (_, i) => i + 1);
  const r = resumir(valores, { temposS, duracaoAlvoS: 120 });
  assert.equal(r.n, 120);
  assert.equal(r.tempoUtilS, 120);
  assert.equal(r.cobertura, 1);
  assert.equal(r.quedaInicioFimPct, 20);
  assert.equal(r.quedaPicoSustentadaPct, 20);
  assert.ok(r.regressoesIntermediarias >= 1);
});

test('lacunas reduzem cobertura sem virar zero e intervalos irregulares são contados', () => {
  const r = resumir([100, 100, 80, 100], { temposS: [1, 2, 12, 22], duracaoAlvoS: 22 });
  assert.equal(r.media, 95);
  assert.equal(r.tempoUtilS, 5);
  assert.ok(Math.abs(r.cobertura - 5 / 22) < 1e-9);
  assert.equal(r.amostrasIrregulares, 2);
  assert.equal(r.queda, null);
});

test('amostras inválidas ficam fora das estatísticas e ausência não é zero', () => {
  const r = resumir([100, 999, 80], { temposS: [1, 2, 3], validos: [true, false, true], duracaoAlvoS: 3 });
  assert.equal(r.n, 2);
  assert.equal(r.media, 90);
  assert.equal(r.max, 100);
  const vazio = resumir([]);
  assert.equal(vazio.media, null);
  assert.equal(vazio.tempoUtilS, null);
  assert.equal(vazio.cobertura, null);
});

test('reduzir mantém o tamanho pedido e a média', () => {
  const v = Array.from({ length: 1000 }, (_, i) => i);
  const r = reduzir(v, 100);
  assert.equal(r.length, 100);
  const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(Math.abs(m(r) - m(v)) < 1);
});

test('formatarDuracao', () => {
  assert.equal(formatarDuracao(65), '01:05');
  assert.equal(formatarDuracao(3725), '1:02:05');
});
