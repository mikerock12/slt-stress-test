import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliar, resumirComponente, vereditoGeral } from '../js/avaliacao.js';

const estavel = (v, n = 60) => Array.from({ length: n }, () => v);

test('CPU sem erros e estável é aprovada', () => {
  const r = resumirComponente('cpu', { gflops: estavel(20), erros: estavel(0), verificacoes: [1, 2, 3] });
  assert.equal(avaliar('cpu', r).status, 'ok');
});

test('CPU com erro de cálculo falha', () => {
  const r = resumirComponente('cpu', { gflops: estavel(20), erros: [0, 0, 1] });
  const a = avaliar('cpu', r);
  assert.equal(a.status, 'falha');
  assert.match(a.motivos[0], /erro\(s\) de cálculo/);
});

test('CPU com queda forte pede atenção (throttling)', () => {
  const gflops = Array.from({ length: 100 }, (_, i) => (i < 50 ? 30 : 20));
  const a = avaliar('cpu', resumirComponente('cpu', { gflops, erros: estavel(0) }));
  assert.equal(a.status, 'atencao');
  assert.match(a.motivos.join(' '), /throttling/);
});

test('GPU com contexto perdido falha', () => {
  const a = avaliar('gpu', resumirComponente('gpu', { fps: estavel(60) }), { falhaFatal: 'driver reiniciou' });
  assert.equal(a.status, 'falha');
});

test('teste sem amostras fica sem dados', () => {
  assert.equal(avaliar('memoria', resumirComponente('memoria', {})).status, 'na');
});

test('pressão sem API fica indisponível e crítica frequente pede atenção', () => {
  assert.equal(avaliar('pressao', resumirComponente('pressao', {}), {}).status, 'na');
  const a = avaliar('pressao', resumirComponente('pressao', { estado: estavel(3) }), { distribuicao: { critical: 50, nominal: 10 } });
  assert.equal(a.status, 'atencao');
});

test('veredito geral pega o pior estado', () => {
  assert.equal(vereditoGeral({ a: { status: 'ok' }, b: { status: 'atencao' } }).status, 'atencao');
  assert.equal(vereditoGeral({ a: { status: 'ok' }, b: { status: 'falha' } }).status, 'falha');
  assert.equal(vereditoGeral({ a: { status: 'ok' } }).status, 'ok');
  assert.equal(vereditoGeral({}).status, 'na');
});
