import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumir, reduzir, formatarDuracao } from '../js/metricas.js';

test('resumir calcula média, extremos e coeficiente de variação', () => {
  const r = resumir([10, 10, 10, 10]);
  assert.equal(r.media, 10);
  assert.equal(r.min, 10);
  assert.equal(r.max, 10);
  assert.equal(r.cv, 0);
  assert.equal(r.queda, null, 'menos de 10 amostras não tem queda');
});

test('resumir detecta queda de desempenho do início ao fim', () => {
  const valores = Array.from({ length: 100 }, (_, i) => (i < 50 ? 100 : 80));
  const r = resumir(valores);
  assert.ok(Math.abs(r.queda - 20) < 0.001, `queda ${r.queda}`);
});

test('resumir de série vazia devolve nulos', () => {
  assert.equal(resumir([]).media, null);
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
