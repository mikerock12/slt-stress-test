import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.js';
import { consentimentoRanking } from '../js/privacidade.js';

function banco() {
  const db = new DatabaseSync(':memory:');
  for (const nome of ['0001_benchmarks.sql', '0002_privacidade.sql']) db.exec(readFileSync(new URL('../migrations/' + nome, import.meta.url), 'utf8'));
  return { sqlite: db, prepare(sql) { return { bind(...args) { return { sql, args, async first() { return db.prepare(sql).get(...args) || null; }, async all() { return { results: db.prepare(sql).all(...args) }; } }; } }; }, async batch(comandos) {
    db.exec('BEGIN'); try { for (const c of comandos) db.prepare(c.sql).run(...c.args); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  } };
}
function dados(contribuinte = crypto.randomUUID(), valor = 10) {
  return { versao: 1, id: crypto.randomUUID(), contribuinte, consentimento: consentimentoRanking(), ids: ['cpu'], concluido: true, duracaoS: 120,
    sistema: { tipo: 'desktop', so: 'Windows', navegador: 'Chrome 152' }, componentes: { cpu: { hardware: { modelo: 'Intel i5-6500' }, configuracao: { motor: 'navegador-v1', simultaneos: 'cpu' }, series: { gflops: Array(120).fill(valor), erros: [0] } } } };
}
async function post(env, corpo, caminho = '/api/benchmarks', origem = 'https://stresstest.smellsliketech.com.br') {
  return worker.fetch(new Request('https://stresstest.smellsliketech.com.br' + caminho, { method: 'POST', headers: { origin: origem, 'content-type': 'application/json' }, body: JSON.stringify(corpo) }), env);
}
const get = (env, caminho) => worker.fetch(new Request('https://stresstest.smellsliketech.com.br' + caminho), env);
test('API SQLite grava, compara excluindo a pessoa e não duplica repetição', async () => {
  const DB = banco(); const env = { DB }; const e = dados();
  assert.equal((await post(env, e)).status, 201);
  assert.equal((await post(env, e)).status, 200);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM benchmarks').get().n, 1);
  const d = await (await get(env, '/api/benchmarks/' + e.id)).json(); assert.equal(d.contribuinte, undefined);
  assert.equal(d.componentes.cpu.resumo.gflops.media, 10);
  // O teste seguinte precisa ser mais recente; inserções na mesma fração de segundo
  // usam UUID como desempate e tornavam esta expectativa aleatória.
  DB.sqlite.prepare('UPDATE resultados SET criado = ? WHERE benchmark_id = ?').run('2000-01-01T00:00:00.000Z', e.id);
  for (let i = 0; i < 5; i++) await post(env, dados());
  const r = await (await post(env, dados(e.contribuinte, 8))).json();
  assert.equal(r.comparacoes.cpu.n, 5); assert.equal(r.comparacoes.cpu.estado, 'abaixo');
  assert.equal(r.comparacoes.cpu.metricas.gflops.media, 10); assert.equal(r.comparacoes.cpu.metricas.gflops.n, 5);
  const ranking = await (await get(env, '/api/ranking?componente=cpu')).json();
  assert.equal(ranking.resultados[0].contribuicoes, 6); assert.equal(ranking.resultados[0].suficiente, true);
  assert.equal(ranking.resultados[0].media, (50+8)/6);
});
test('comparar sem consentimento não persiste, erro e teste curto ficam fora do ranking', async () => {
  const env = { DB: banco() }; const e = dados();
  const r = await (await post(env, e, '/api/comparar')).json(); assert.equal(r.salvo, false);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM benchmarks').get().n, 0);
  e.componentes.cpu.series.erros = [1]; await post(env, e);
  assert.equal((await (await get(env, '/api/ranking')).json()).resultados.length, 0);
});
test('origem estranha, corpo inválido, sem DB e rate limit são recusados', async () => {
  const env = { DB: banco() };
  assert.equal((await post(env, dados(), '/api/benchmarks', 'https://outro.example')).status, 403);
  assert.equal((await post(env, {})).status, 400);
  assert.equal((await post({}, dados())).status, 503);
  assert.equal((await post({ ...env, ENVIOS: { limit: async () => ({ success: false }) } }, dados())).status, 429);
  assert.equal((await get(env, '/api/ranking?componente=constructor')).status, 400);
});
test('origem reescrita pelo Wrangler é aceita somente no ambiente de desenvolvimento', async () => {
  const req = () => new Request('http://stresstest.smellsliketech.com.br/api/benchmarks', { method:'POST',headers:{origin:'http://stresstest.smellsliketech.com.br','content-type':'application/json'},body:JSON.stringify(dados()) });
  assert.equal((await worker.fetch(req(),{DB:banco(),AMBIENTE:'producao'})).status,403);
  assert.equal((await worker.fetch(req(),{DB:banco(),AMBIENTE:'desenvolvimento'})).status,201);
});

test('publicação exige consentimento atual e registra prova sem expor a chave', async () => {
  const env = { DB: banco() }; const e = dados(); delete e.consentimento;
  assert.equal((await post(env, e)).status, 400);
  assert.equal((await post(env, e, '/api/comparar')).status, 200);
  e.consentimento = consentimentoRanking(); assert.equal((await post(env, e)).status, 201);
  const registro = env.DB.sqlite.prepare('SELECT * FROM benchmarks').get();
  assert.equal(registro.consentimento_versao, '2026-10-23'); assert.ok(registro.consentido_em);
  assert.ok(!registro.dados.includes(e.contribuinte));
});

test('privacidade exporta e exclui só a chave válida, revogação impede nova gravação', async () => {
  const env = { DB: banco() }; const meu = dados(); const outro = dados();
  await post(env, meu); await post(env, outro);
  const caminho = '/api/privacidade/';
  assert.equal((await post(env, { contribuinte: 'inválido' }, caminho + 'excluir')).status, 400);
  assert.equal((await post(env, { contribuinte: meu.contribuinte }, caminho + 'excluir', 'https://outro.example')).status, 403);
  const copia = await (await post(env, { contribuinte: meu.contribuinte }, caminho + 'exportar')).json();
  assert.equal(copia.testes.length, 1); assert.equal(copia.testes[0].id, meu.id); assert.equal(copia.proximaPagina, null);
  assert.equal(copia.testes[0].contribuinte, undefined);
  const exclusao = await (await post(env, { contribuinte: meu.contribuinte }, caminho + 'excluir')).json();
  assert.equal(exclusao.excluidos, 1);
  assert.equal((await get(env, '/api/benchmarks/' + meu.id)).status, 404);
  assert.equal((await get(env, '/api/benchmarks/' + outro.id)).status, 200);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM resultados').get().n, 1);
  assert.equal((await post(env, dados(meu.contribuinte))).status, 409);
});

test('limpeza programada remove testes antigos e mantém os recentes', async () => {
  const env = { DB: banco() }; const antigo = dados(); const atual = dados();
  await post(env, antigo); await post(env, atual);
  env.DB.sqlite.prepare('UPDATE benchmarks SET criado = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', antigo.id);
  await worker.scheduled({}, env);
  assert.equal((await get(env, '/api/benchmarks/' + antigo.id)).status, 404);
  assert.equal((await get(env, '/api/benchmarks/' + atual.id)).status, 200);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM resultados').get().n, 1);
});

test('registros legados sem prova de consentimento não são públicos até nova autorização', async () => {
  const env = { DB: banco() }; const e = dados(); await post(env, e);
  env.DB.sqlite.prepare('UPDATE benchmarks SET consentimento_versao = NULL, consentido_em = NULL WHERE id = ?').run(e.id);
  assert.equal((await get(env, '/api/benchmarks/' + e.id)).status, 404);
  assert.equal((await (await get(env, '/api/ranking')).json()).resultados.length, 0);
  const copia = await (await post(env, { contribuinte: e.contribuinte }, '/api/privacidade/exportar')).json();
  assert.equal(copia.testes.length, 1);
  assert.equal((await post(env, e)).status, 200);
  assert.equal((await get(env, '/api/benchmarks/' + e.id)).status, 200);
});
