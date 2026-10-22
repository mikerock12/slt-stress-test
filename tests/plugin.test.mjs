import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliar, resumirComponente } from '../js/avaliacao.js';
import { MonitorSensores, frequenciaMemoria, resumoMemoria } from '../js/plugin.js';

const serie = (v, n = 30) => Array.from({ length: n }, () => v);

test('CPU quente pelo sensor pede atenção', () => {
  const r = resumirComponente('cpu', { gflops: serie(20), erros: serie(0), tempC: [...serie(80), 97] });
  const a = avaliar('cpu', r);
  assert.equal(a.status, 'atencao');
  assert.match(a.motivos.join(' '), /97 °C/);
});

test('temperatura sob controle mantém aprovado e informa média', () => {
  const a = avaliar('gpu', resumirComponente('gpu', { fps: serie(60), tempC: serie(70) }));
  assert.equal(a.status, 'ok');
  assert.match(a.motivos.join(' '), /média 70 °C/);
});

test('SMART ruim no disco testado reprova', () => {
  const a = avaliar('disco', resumirComponente('disco', { seqEscrita: serie(500) }), { saudeDisco: 'ruim' });
  assert.equal(a.status, 'falha');
});

test('resumo e frequência da memória usam a menor velocidade configurada', () => {
  const pentes = [
    { capacidadeGB: 8, tipo: 'DDR4', velocidadeMTs: 2400, configuradaMTs: 2133 },
    { capacidadeGB: 8, tipo: 'DDR4', velocidadeMTs: 2133, configuradaMTs: 2133 },
  ];
  assert.equal(frequenciaMemoria(pentes), 2133);
  assert.equal(resumoMemoria(pentes), '16 GB DDR4 · 2133 MT/s (2 pentes)');
  assert.equal(resumoMemoria([]), null);
});

test('monitor reparte sensores por componente e casa o disco pela letra', () => {
  const m = new MonitorSensores(
    { memoria: [{ configuradaMTs: 3200 }] },
    { gpuWebgl: 'NVIDIA GeForce RTX 3060', unidadeDisco: 'D:', discos: [{ nome: 'WDC WD10', letras: ['D:'] }] },
  );
  m.ultima = {
    cpu: { tempC: 70, clockMHz: 4200, potenciaW: 65 },
    gpus: [{ nome: 'Intel UHD 770', tempC: 50 }, { nome: 'NVIDIA GeForce RTX 3060', tempC: 75, clockMHz: 1800 }],
    memoria: {},
    discos: [{ nome: 'WDC WD10 ', tempC: 38 }],
  };
  assert.deepEqual(m.para('cpu'), { tempC: 70, clockReal: 4.2, potenciaW: 65 });
  assert.equal(m.para('gpu').tempC, 75);
  assert.deepEqual(m.para('memoria'), { freqMTs: 3200 });
  assert.deepEqual(m.para('disco'), { tempC: 38 });
});
