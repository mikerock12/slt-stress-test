import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProtecaoTemperatura, nivel, normalizarLimites } from '../js/protecao.js';
import { avaliar, resumirComponente } from '../js/avaliacao.js';
import { analisar } from '../js/relatorio.js';

test('parada por temperatura vira atenção no componente e no veredito geral', () => {
  const serie = Array.from({ length: 30 }, () => 20);
  const disparo = { componente: 'cpu', temp: 96.4, limite: 95 };
  const a = avaliar('cpu', resumirComponente('cpu', { gflops: serie }), { disparoTemp: disparo });
  assert.equal(a.status, 'atencao');
  assert.match(a.motivos[0], /CPU chegou a 96 °C, acima do limite de 95 °C/);

  // Com a parada, não pode aparecer "sob controle" ao lado do motivo.
  const comTemp = avaliar('cpu', resumirComponente('cpu', { gflops: serie, tempC: serie.map(() => 73) }), { disparoTemp: disparo });
  assert.ok(!comTemp.motivos.some((m) => /sob controle/.test(m)), comTemp.motivos.join(' | '));

  // GPU quente durante um teste só de memória: o geral também não pode sair "aprovado".
  const analise = analisar({
    componentes: { memoria: { series: { copiaGBs: serie, erros: [0] }, info: {} } },
    protecao: { limites: { ativa: true, cpu: 95, gpu: 85 }, maxima: { cpu: null, gpu: 88 }, disparo: { componente: 'gpu', temp: 88, limite: 85 } },
  });
  assert.equal(analise.geral.titulo, 'Interrompido pela proteção de temperatura');
});

test('limites fora da faixa são ajustados e valores inválidos voltam ao padrão', () => {
  assert.deepEqual(normalizarLimites({ cpu: 200, gpu: 'x' }), { ativa: true, cpu: 105, gpu: 90 });
  assert.deepEqual(normalizarLimites({ ativa: false, cpu: 40, gpu: 85 }), { ativa: false, cpu: 60, gpu: 85 });
});

test('dispara só depois de 3 leituras seguidas acima do limite', () => {
  const p = new ProtecaoTemperatura({ cpu: 90, gpu: 85 });
  assert.equal(p.verificar({ cpu: 91, gpu: 60 }).disparo, null);
  assert.equal(p.verificar({ cpu: 89, gpu: 60 }).disparo, null, 'voltou abaixo: zera a contagem');
  p.verificar({ cpu: 92 });
  p.verificar({ cpu: 93 });
  assert.deepEqual(p.verificar({ cpu: 94 }).disparo, { componente: 'cpu', temp: 94, limite: 90 });
  assert.equal(p.maxima.cpu, 94);
});

test('avisa uma vez quando chega perto do limite', () => {
  const p = new ProtecaoTemperatura({ gpu: 85 });
  assert.equal(p.verificar({ gpu: 79 }).avisos.length, 0);
  assert.deepEqual(p.verificar({ gpu: 81 }).avisos, [{ componente: 'gpu', temp: 81, limite: 85 }]);
  assert.equal(p.verificar({ gpu: 82 }).avisos.length, 0);
});

test('desligada, registra máximas mas não dispara; sem leitura não faz nada', () => {
  const p = new ProtecaoTemperatura({ ativa: false, cpu: 70 });
  for (let i = 0; i < 5; i++) p.verificar({ cpu: 99, gpu: null });
  assert.equal(p.disparo, null);
  assert.equal(p.maxima.cpu, 99);
  assert.equal(p.maxima.gpu, null);
});

test('limite definido pela pessoa vale no veredito quando é mais baixo que o padrão', () => {
  const serie = Array.from({ length: 30 }, () => 20);
  const r = resumirComponente('cpu', { gflops: serie, tempC: serie.map(() => 80) });
  const comLimite = avaliar('cpu', r, { limiteTemp: 75 });
  assert.equal(comLimite.status, 'atencao');
  assert.match(comLimite.motivos.join(' '), /limite de 75 °C que você definiu/);
  assert.equal(avaliar('cpu', r, {}).status, 'ok', 'sem limite próprio, 80 °C está abaixo do padrão de 90 °C');
});

test('nível para a faixa ao vivo', () => {
  assert.equal(nivel(null, 90), 'sem');
  assert.equal(nivel(70, 90), 'ok');
  assert.equal(nivel(86, 90), 'perto');
  assert.equal(nivel(90, 90), 'limite');
});
