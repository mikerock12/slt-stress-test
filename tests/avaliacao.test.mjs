import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliar, medicaoSuficiente, resumirComponente, vereditoGeral } from '../js/avaliacao.js';

const estavel = (v, n = 60) => Array.from({ length: n }, () => v);
const tempos = (n) => Array.from({ length: n }, (_, i) => i + 1);

test('CPU sem erros e estável é aprovada', () => {
  const r = resumirComponente('cpu', { gflops: estavel(20), erros: estavel(0), verificacoes: [1, 2, 3] });
  assert.equal(avaliar('cpu', r).status, 'ok');
});

test('CPU com erro de cálculo falha', () => {
  const r = resumirComponente('cpu', { gflops: estavel(20), erros: [0, 0, 1] });
  const a = avaliar('cpu', r);
  assert.equal(a.status, 'falha');
  assert.equal(a.diagnostico, 'erros_verificados');
  assert.match(a.motivos[0], /erro\(s\) de cálculo/);
});

test('CPU com queda forte pede atenção sem afirmar a causa', () => {
  const gflops = Array.from({ length: 100 }, (_, i) => (i < 50 ? 30 : 20));
  const a = avaliar('cpu', resumirComponente('cpu', { gflops, erros: estavel(0) }));
  assert.equal(a.status, 'atencao');
  assert.match(a.motivos.join(' '), /limite térmico/);
  assert.match(a.motivos.join(' '), /não determina a causa/);
});

test('GPU com contexto perdido é falha do motor, não defeito comprovado', () => {
  const a = avaliar('gpu', resumirComponente('gpu', { passadasPorSegundo: estavel(60) }), { falhaFatal: 'driver reiniciou' });
  assert.equal(a.status, 'na');
  assert.equal(a.execucao, 'falha_motor');
  assert.equal(a.diagnostico, 'inconclusivo');
});

test('teste sem amostras principais fica sem dados mesmo com sensor', () => {
  assert.equal(avaliar('memoria', resumirComponente('memoria', {})).status, 'na');
  const r = resumirComponente('cpu', { tempC: estavel(70, 120) });
  assert.equal(avaliar('cpu', r).status, 'na');
});

test('execução rápida concluída com 100 amostras válidas e cobertura é elegível', () => {
  const series = { gflops: estavel(20, 100), erros: [0] };
  const r = resumirComponente('cpu', series, { gflops: tempos(100), erros: [1] }, { duracaoAlvoS: 120 });
  const execucao = { concluido: true, duracaoAlvoS: 120, duracaoRealS: 120 };
  assert.equal(medicaoSuficiente('cpu', r, execucao, 'rapido'), true);
  const a = avaliar('cpu', r, { execucao, perfil: 'rapido' });
  assert.equal(a.status, 'ok');
  assert.equal(a.execucao, 'concluida');
  assert.equal(a.diagnostico, 'sem_erros_detectados');
});

test('perfil completo interrompido aos 2 minutos não é aprovado', () => {
  const series = { gflops: estavel(20, 120), erros: [0] };
  const r = resumirComponente('cpu', series, { gflops: tempos(120), erros: [1] }, { duracaoAlvoS: 900 });
  const a = avaliar('cpu', r, { execucao: { concluido: false, motivo: 'Parado pelo usuário', duracaoAlvoS: 900, duracaoRealS: 120 }, perfil: 'completo' });
  assert.equal(a.status, 'na');
  assert.equal(a.execucao, 'incompleta');
});

test('erro verificado continua reprovação mesmo se a limpeza falhar', () => {
  const a = avaliar('cpu', resumirComponente('cpu', { gflops: estavel(20), erros: [1] }), { falhaFatal: 'limpeza pendente' });
  assert.equal(a.status, 'falha');
  assert.equal(a.diagnostico, 'erros_verificados');
});

test('disco usa fases concluídas para velocidade e acompanhamento para cobertura', () => {
  const seqEscrita = estavel(250, 30);
  const erros = estavel(0, 120);
  const series = { seqEscrita, erros, ciclos: [7] };
  const r = resumirComponente('disco', series, {
    seqEscrita: Array.from({ length: 30 }, (_, i) => (i + 1) * 4), erros: tempos(120), ciclos: [120],
  }, { duracaoAlvoS: 120 });
  const execucao = { concluido: true, duracaoAlvoS: 120, duracaoRealS: 120, ciclos: 7 };
  assert.equal(medicaoSuficiente('disco', r, execucao, 'rapido'), true);
  const a = avaliar('disco', r, { execucao, perfil: 'rapido' });
  assert.equal(a.status, 'ok');
  assert.match(a.motivos.join(' '), /30 medições de fase e 7 ciclo/);
  assert.equal(medicaoSuficiente('disco', r, { ...execucao, ciclos: 0 }, 'rapido'), false);
});

test('pressão sem API fica indisponível', () => {
  assert.equal(avaliar('pressao', resumirComponente('pressao', {}), {}).status, 'na');
});

test('pressão crítica sem queda da CPU não rebaixa o veredito', () => {
  const resumo = resumirComponente('pressao', { estado: estavel(3) });
  const semQueda = avaliar('pressao', resumo, { distribuicao: { critical: 60 }, quedaCpu: 2 });
  assert.equal(semQueda.status, 'ok');
  assert.match(semQueda.motivos.join(' '), /não indica problema/);
  assert.equal(avaliar('pressao', resumo, { distribuicao: { critical: 60 } }).status, 'ok', 'sem teste de CPU');
});

test('pressão crítica com queda da CPU pede atenção', () => {
  const a = avaliar('pressao', resumirComponente('pressao', { estado: estavel(3) }), { distribuicao: { critical: 60 }, quedaCpu: 20 });
  assert.equal(a.status, 'atencao');
  assert.match(a.motivos.join(' '), /refrigeração está no limite/);
});

test('veredito geral não aprova componente válido com outro sem dados', () => {
  assert.equal(vereditoGeral({ a: { status: 'ok' }, b: { status: 'atencao' } }).status, 'atencao');
  assert.equal(vereditoGeral({ a: { status: 'ok' }, b: { status: 'falha' } }).status, 'falha');
  assert.equal(vereditoGeral({ a: { status: 'ok' }, b: { status: 'na' } }).status, 'na');
  assert.equal(vereditoGeral({ a: { status: 'ok' } }).status, 'ok');
  assert.equal(vereditoGeral({}).status, 'na');
});
