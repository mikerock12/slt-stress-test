import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarBenchmark, chaveGrupo, comparar } from '../js/benchmark.js';
import { detectarDispositivo } from '../js/dispositivo.js';

export function exemplo() {
  return { versao: 1, id: crypto.randomUUID(), contribuinte: crypto.randomUUID(), ids: ['cpu'], concluido: true, duracaoS: 120,
    sistema: { tipo: 'desktop', so: 'Windows', navegador: 'Chrome 152', energia: 'tomada' },
    componentes: { cpu: { hardware: { marca: 'Intel', modelo: 'i5-6500', frequencia: 3200, unidadeFrequencia: 'MHz' },
      configuracao: { motor: 'navegador-v1', threads: 4, simultaneos: 'cpu', duracaoAlvoS: 120 }, series: { gflops: Array(120).fill(10), erros: [0] } } } };
}
test('dispositivo distingue Android, iOS e desktop inclusive iPad com UA de Mac', () => {
  assert.equal(detectarDispositivo({ userAgent: 'Android 15', platform: 'Linux' }).android, true);
  assert.equal(detectarDispositivo({ userAgent: 'iPhone' }).ios, true);
  assert.equal(detectarDispositivo({ platform: 'MacIntel', maxTouchPoints: 5 }).ios, true);
  assert.equal(detectarDispositivo({ userAgent: 'Windows NT' }).tipo, 'desktop');
});
test('validação recalcula médias e remove logs, caminhos e identificadores pessoais', () => {
  const e = exemplo(); e.media = 999; e.sistema.serial = 'SEGREDO'; e.componentes.cpu.hardware.serial = 'SEGREDO';
  const d = validarBenchmark(e);
  assert.equal(d.componentes.cpu.pontuacao, 10); assert.equal(d.componentes.cpu.elegivel, true);
  assert.ok(!JSON.stringify(d).includes('SEGREDO'));
});
test('teste curto, interrompido, com erros ou sem modelo não entra na média', () => {
  for (const alterar of [(e) => e.duracaoS = 10, (e) => e.concluido = false, (e) => e.componentes.cpu.series.erros = [1], (e) => e.componentes.cpu.hardware.modelo = null]) {
    const e = exemplo(); alterar(e); assert.equal(validarBenchmark(e).componentes.cpu.elegivel, false);
  }
});
test('validação recusa NaN, negativos, amostras excessivas e componentes arbitrários', () => {
  for (const serie of [[NaN], [-1], Array(7201).fill(1)]) { const e = exemplo(); e.componentes.cpu.series.gflops = serie; assert.throws(() => validarBenchmark(e)); }
  const e = exemplo(); e.ids = ['constructor']; assert.throws(() => validarBenchmark(e));
});
test('modelo genérico e GPU de software não viram grupos de hardware físico', () => {
  for(const modelo of ['unknown','To be filled by OEM','qcom','ANGLE (Google, SwiftShader)']){const e=exemplo();e.componentes.cpu.hardware.modelo=modelo;assert.equal(validarBenchmark(e).componentes.cpu.elegivel,false);}
});
test('grupo separa frequência, resolução/motor, simultâneos, energia e navegador', () => {
  const d = validarBenchmark(exemplo()); const chave = chaveGrupo(d, 'cpu');
  for (const alterar of [(e) => e.componentes.cpu.hardware.frequencia = null, (e) => e.componentes.cpu.configuracao.motor = 'android-nativo-v1', (e) => e.componentes.cpu.configuracao.simultaneos = 'cpu+gpu', (e) => e.sistema.energia = 'bateria', (e) => e.sistema.navegador = 'Firefox 140']) {
    const outro = structuredClone(d); alterar(outro); assert.notEqual(chaveGrupo(outro, 'cpu'), chave);
  }
});
test('média exige cinco outros contribuintes e usa margem explícita de 10%', () => {
  assert.equal(comparar(100, 100, 4).estado, 'insuficiente');
  assert.equal(comparar(100, 100, 5).estado, 'na-media');
  assert.equal(comparar(80, 100, 5).estado, 'abaixo');
  assert.equal(comparar(120, 100, 5).estado, 'acima');
});
test('detalhes preservam as oito fases de disco sem aceitar caminhos ou logs', () => {
  const e = exemplo();e.componentes.cpu.detalhes={arquivoMiB:256,resultados:{seq1mq8Leitura:{mbs:123,iops:456,caminho:'SEGREDO'}}};
  const d=validarBenchmark(e);assert.equal(d.componentes.cpu.detalhes.resultados.seq1mq8Leitura.mbs,123);assert.ok(!JSON.stringify(d).includes('SEGREDO'));
});
