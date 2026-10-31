import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularMedidasGPU, interpretarTempoGpu } from '../js/testes/gpu.js';

function janela() {
  return { passadas: 1200, lotes: 60, rafs: 60, passadasPorLote: Array(60).fill(20), temposParede: Array(60).fill(16), temposGpu: [] };
}

test('GPU separa 20 passadas por lote, 60 lotes/s e RAF sem chamar de FPS', () => {
  const r = calcularMedidasGPU(janela(), 1, 640, 360);
  assert.equal(r.passadasPorSegundo, 1200);
  assert.equal(r.lotesConcluidosPorSegundo, 60);
  assert.equal(r.rafPorSegundo, 60);
  assert.equal(r.passadasPorLote, 20);
  assert.equal(r.tempoParedeLoteMs, 16);
  assert.equal(r.fps, undefined);
  assert.equal(r.frameMs, undefined);
  assert.equal(r.mpixPorSegundo, 276.48);
});

test('sem timer query ou sem lotes concluídos não inventa tempo de GPU', () => {
  assert.equal(calcularMedidasGPU(janela(), 1, 640, 360).tempoGpuMs, undefined);
  const vazia = { passadas: 0, lotes: 0, rafs: 0, passadasPorLote: [], temposParede: [], temposGpu: [] };
  assert.deepEqual(calcularMedidasGPU(vazia, 1, 640, 360), {});
});

test('timer query descarta disjoint, espera resultado e converte nanos válidos', () => {
  assert.deepEqual(interpretarTempoGpu({ disjoint: true, disponivel: true, nanos: 2e6 }), { descartar: true });
  assert.deepEqual(interpretarTempoGpu({ disjoint: false, disponivel: false, nanos: null }), { pendente: true });
  assert.deepEqual(interpretarTempoGpu({ disjoint: false, disponivel: true, nanos: 2e6 }), { valorMs: 2 });
  assert.equal(interpretarTempoGpu({ disjoint: false, disponivel: true, nanos: -1 }).valorMs, null);
});
