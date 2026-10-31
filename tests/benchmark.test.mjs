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
test('ambiente emulado não contribui para médias de hardware físico',()=>{
  const e=exemplo();e.sistema.emulado=true;assert.equal(validarBenchmark(e).componentes.cpu.elegivel,false);
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

function gpuV1() {
  const e = exemplo();
  e.ids = ['gpu'];
  e.componentes = { gpu: { hardware: { marca: 'ARM', modelo: 'Mali-G720 MC7' },
    configuracao: { motor: 'webgl2-fence-v2', largura: 640, altura: 360, intensidade: 64, simultaneos: 'gpu', duracaoAlvoS: 120 },
    series: { fps: Array(120).fill(60), artefatos: [0] } } };
  return e;
}
function gpuV2() {
  const e = gpuV1();
  e.versao = 2; e.perfil = 'rapido';
  const gpu = e.componentes.gpu;
  gpu.configuracao.motor = 'webgl2-fence-v3';
  gpu.series = { passadasPorSegundo: Array(120).fill(60), divergenciasReferencia: [0] };
  gpu.tempos = { passadasPorSegundo: Array.from({ length: 120 }, (_, i) => i + 1), divergenciasReferencia: [1] };
  return e;
}

test('benchmark v1 fps e v2 passadasPorSegundo ficam em grupos isolados', () => {
  const v1 = validarBenchmark(gpuV1());
  const v2 = validarBenchmark(gpuV2());
  assert.equal(v1.componentes.gpu.pontuacao, 60);
  assert.equal(v2.componentes.gpu.pontuacao, 60);
  assert.equal(v2.componentes.gpu.elegivel, true);
  assert.equal(v2.componentes.gpu.qualidade.tempoUtilS, 120);
  assert.equal(v2.componentes.gpu.qualidade.cobertura, 1);
  assert.notEqual(chaveGrupo(v1, 'gpu'), chaveGrupo(v2, 'gpu'));
});

test('v2 exige timestamps e recusa cobertura insuficiente na elegibilidade', () => {
  const semTempos = gpuV2(); delete semTempos.componentes.gpu.tempos;
  assert.throws(() => validarBenchmark(semTempos), /Timestamps/);
  const lacunas = gpuV2();
  lacunas.duracaoS = 1191;
  lacunas.componentes.gpu.tempos.passadasPorSegundo = Array.from({ length: 120 }, (_, i) => i * 10 + 1);
  const d = validarBenchmark(lacunas);
  assert.equal(d.componentes.gpu.elegivel, false);
  assert.ok(d.componentes.gpu.motivosInelegibilidade.includes('cobertura_ou_tempo_util_insuficiente'));
  const inconsistente = gpuV2();
  inconsistente.componentes.gpu.tempos.passadasPorSegundo[119] = 500;
  assert.throws(() => validarBenchmark(inconsistente), /excedem a duração/);
});

test('MAX v2 com CPU válida e GPU sem dados não publica nenhum componente como concluído', () => {
  const e = gpuV2();
  e.ids = ['cpu', 'gpu'];
  e.componentes.cpu = exemplo().componentes.cpu;
  e.componentes.cpu.tempos = { gflops: Array.from({ length: 120 }, (_, i) => i + 1), erros: [1] };
  assert.equal(validarBenchmark(e).componentes.cpu.elegivel, true);
  assert.equal(validarBenchmark(e).componentes.gpu.elegivel, true);
  e.componentes.gpu.series.passadasPorSegundo = [];
  e.componentes.gpu.tempos.passadasPorSegundo = [];
  const d = validarBenchmark(e);
  assert.equal(d.componentes.gpu.elegivel, false);
  assert.equal(d.componentes.cpu.elegivel, false);
  assert.ok(d.componentes.cpu.motivosInelegibilidade.includes('componente_selecionado_inconclusivo'));
});

test('disco v2 aceita fases esparsas com ciclos e acompanhamento completo', () => {
  const e = gpuV2(); e.ids = ['disco'];
  e.componentes = { disco: { hardware: { marca: 'Lexar', modelo: 'SSD 240 GB', tipo: 'SSD' },
    configuracao: { motor: 'navegador-v1', mib: 1024, simultaneos: 'disco', duracaoAlvoS: 120 },
    series: { seqLeitura: Array(30).fill(500), seqEscrita: Array(30).fill(250), erros: Array(120).fill(0), ciclos: [7] },
    tempos: { seqLeitura: Array.from({ length: 30 }, (_, i) => (i + 1) * 4), seqEscrita: Array.from({ length: 30 }, (_, i) => (i + 1) * 4), erros: Array.from({ length: 120 }, (_, i) => i + 1), ciclos: [120] },
    detalhes: { ciclos: 7 } } };
  const d = validarBenchmark(e);
  assert.equal(d.componentes.disco.elegivel, true);
  assert.equal(d.componentes.disco.qualidade.amostrasValidas, 30);
  assert.equal(d.componentes.disco.qualidade.cobertura, 1);
});
