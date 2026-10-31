import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProtecaoDesempenhoMovel, encerrarComPrazo } from '../js/seguranca-movel.js';
import { avaliar, resumirComponente } from '../js/avaliacao.js';
import { TesteGPU } from '../js/testes/gpu.js';
import { TesteAndroid } from '../js/android.js';
import { analisar } from '../js/relatorio.js';

test('celular interrompe queda persistente, sem tratar os números como temperatura', () => {
  const p = new ProtecaoDesempenhoMovel(); let disparo;
  for (let s = 1; s <= 45; s++) { disparo = p.verificar(s, { cpu: s < 25 ? 4 : 0.5 }); if (disparo) break; }
  assert.equal(disparo.componente, 'cpu'); assert.ok(disparo.queda > 80);
  const a = avaliar('cpu', resumirComponente('cpu', { gflops: Array.from({ length: 100 }, (_, i) => i < 50 ? 4 : 0.5) }), { movel: true });
  assert.match(a.motivos.join(' '), /Sem sensor correspondente não é possível confirmar/);
  assert.doesNotMatch(a.motivos.join(' '), /pasta térmica|cooler/);
});

test('aquecimento inicial, pico isolado, dados ausentes e recuperação não disparam', () => {
  const p = new ProtecaoDesempenhoMovel();
  for (let s = 1; s <= 120; s++) assert.equal(p.verificar(s, { gpu: s === 40 ? 1 : s < 5 ? 50 : 15 }), null);
  assert.equal(p.verificar(121, { cpu: null, gpu: NaN }), null);
});

test('queda a zero também dispara, mas uma base inteira em zero não cria comparação', () => {
  const p = new ProtecaoDesempenhoMovel(); let disparo;
  for (let s = 1; s <= 45; s++) { disparo = p.verificar(s, { cpu: s < 25 ? 4 : 0 }); if (disparo) break; }
  assert.equal(disparo.queda, 100);
  const vazio = new ProtecaoDesempenhoMovel();
  for (let s = 1; s < 50; s++) assert.equal(vazio.verificar(s, { cpu: 0 }), null);
});

test('encerramento com erro ou tarefa pendurada não bloqueia o relatório', async () => {
  assert.equal(await encerrarComPrazo({ parar: async () => {} }, 20), null);
  assert.match(await encerrarComPrazo({ parar: () => { throw new Error('falha de limpeza'); } }), /falha de limpeza/);
  assert.match(await encerrarComPrazo({ parar: () => new Promise(() => {}) }, 20), /prazo/);
});

test('guarda/limpeza sem confirmação não é reprovação de hardware; erro medido permanece falha', () => {
  const dados = { ids: ['cpu'], sistema: { dispositivo: { tipo: 'celular' } }, interrupcaoAndroid: 'A interface deixou de responder.', componentes: { cpu: { series: { gflops: [1,1,1], erros: [0] }, falhaFatal: 'Limpeza não confirmou a parada.' } } };
  assert.equal(analisar(dados).geral.titulo, 'Teste interrompido no Android');
  assert.equal(analisar(dados).geral.status, 'atencao');
  dados.componentes.cpu.series.erros = [1];
  assert.equal(analisar(dados).geral.status, 'falha');
  dados.componentes.cpu.series.erros = [0]; delete dados.interrupcaoAndroid;
  assert.equal(analisar(dados).geral.titulo, 'Teste inconclusivo: falha na execução');
});

test('bridge Android devolve a parada antes da limpeza e consulta a confirmação', async (t) => {
  let consultas = 0, sinais = 0;
  t.mock.method(globalThis, 'setTimeout', (fn) => { queueMicrotask(fn); return 0; });
  globalThis.SLTAndroid = { parar: () => sinais++, amostra: () => JSON.stringify({ encerrado: ++consultas >= 3, metricas: {} }) };
  try { await new TesteAndroid('memoria').parar(); assert.equal(sinais, 1); assert.equal(consultas, 3); }
  finally { delete globalThis.SLTAndroid; }
});

test('GPU pendente não envia outra carga nem conta trabalho não concluído', (t) => {
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
  const gpu = new TesteGPU(); gpu.rodando = true; gpu.prazoMs = Infinity;
  gpu.gl = { TIMEOUT_EXPIRED: 1, clientWaitSync: () => 1 };
  gpu.pendente = { sync: {}, tipo: 'cena', passadas: 32, t0: performance.now() };
  t.mock.method(gpu, 'desenhar', () => { throw new Error('Enviou carga com lote pendente'); });
  try {
    for (let i = 0; i < 100; i++) gpu.quadro(performance.now());
    assert.equal(gpu.janela.passadas, 0); assert.equal(gpu.desenhar.mock.callCount(), 0);
    t.mock.method(gpu, 'parar', async () => { gpu.rodando = false; });
    gpu.prazoMs = 100; gpu.quadro(101); assert.equal(gpu.rodando, false);
  } finally { delete globalThis.document; delete globalThis.requestAnimationFrame; delete globalThis.cancelAnimationFrame; }
});
