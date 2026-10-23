import { validarBenchmark, chaveGrupo, comparar, MIN_CONTRIBUINTES } from '../js/benchmark.js';
import { METRICAS } from '../js/avaliacao.js';

const ORIGENS = new Set(['https://stresstest.smellsliketech.com.br', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8787', 'http://127.0.0.1:8787']);
const LIMITE = 1500000;
const json = (dados, status = 200) => Response.json(dados, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer' } });
const recentes = `r.elegivel = 1 AND NOT EXISTS (SELECT 1 FROM resultados n WHERE n.grupo = r.grupo AND n.contribuinte = r.contribuinte AND n.elegivel = 1 AND (n.criado > r.criado OR (n.criado = r.criado AND n.benchmark_id > r.benchmark_id)))`;
const medidas = (id) => METRICAS[id].filter((m) => m.tipo === 'media');
const colunasMedias = (id) => medidas(id).map((m) => `AVG(json_extract(r.resumo, '$.${m.chave}.media')) m_${m.chave}, COUNT(json_extract(r.resumo, '$.${m.chave}.media')) n_${m.chave}`).join(', ');
const mediasPublicas = (id, r) => Object.fromEntries(medidas(id).map((m) => [m.chave, { media: r[`m_${m.chave}`] ?? null, n: r[`n_${m.chave}`] || 0 }]));
async function hash(s) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((n) => n.toString(16).padStart(2, '0')).join('');
}
async function corpo(req) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new Error('Envie application/json.');
  if (Number(req.headers.get('content-length')) > LIMITE) throw new Error('Relatório acima do limite de 1,5 MB.');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('Relatório ausente.');
  const partes = []; let tamanho = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    tamanho += value.length;
    if (tamanho > LIMITE) { await reader.cancel(); throw new Error('Relatório acima do limite de 1,5 MB.'); }
    partes.push(value);
  }
  const bytes = new Uint8Array(tamanho); let i = 0;
  for (const p of partes) { bytes.set(p, i); i += p.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function api(req, env) {
  const url = new URL(req.url);
  if (!env.DB) return json({ erro: 'O banco de benchmarks ainda não está configurado.' }, 503);
  if (req.method === 'POST') {
    const origem = req.headers.get('origin');
    // Wrangler pode reescrever localhost para http://<custom-domain> durante o dev.
    const origemDev = env.AMBIENTE === 'desenvolvimento' && origem === url.origin;
    if (!ORIGENS.has(origem) && !origemDev) return json({ erro: 'Origem não autorizada.' }, 403);
    if (env.ENVIOS) {
      const { success } = await env.ENVIOS.limit({ key: req.headers.get('cf-connecting-ip') || 'local' });
      if (!success) return json({ erro: 'Muitos envios. Aguarde um minuto e tente novamente.' }, 429);
    }
    if (!['/api/benchmarks', '/api/comparar'].includes(url.pathname)) return json({ erro: 'Rota não encontrada.' }, 404);
    let dados;
    try { dados = validarBenchmark(await corpo(req)); } catch (e) { return json({ erro: e.message }, 400); }
    const contribuinte = await hash(dados.contribuinte);
    // O identificador aleatório é transformado em hash e nunca é público.
    delete dados.contribuinte;
    const grupos = {};
    for (const id of dados.ids) grupos[id] = await hash(chaveGrupo(dados, id));
    const comparacoes = {};
    for (const id of dados.ids) {
      const c = dados.componentes[id];
      const ref = await env.DB.prepare(`SELECT COUNT(*) n, AVG(r.pontuacao) media, ${colunasMedias(id)} FROM resultados r WHERE r.grupo = ? AND r.contribuinte <> ? AND ${recentes}`).bind(grupos[id], contribuinte).first();
      comparacoes[id] = c.elegivel ? comparar(c.pontuacao, ref?.media, ref?.n || 0) : { estado: 'inelegivel', mensagem: 'Sem comparação: ambiente emulado, teste interrompido, curto, com erros, sem medições suficientes ou sem identificação exata do hardware.' };
      if (c.elegivel) comparacoes[id].metricas = Object.fromEntries(Object.entries(mediasPublicas(id, ref || {})).map(([k, r]) => [k, { ...r, valor: c.resumo[k]?.media, suficiente: r.n >= MIN_CONTRIBUINTES }]));
    }
    if (url.pathname === '/api/comparar') {
      for (const c of Object.values(comparacoes)) if (c.estado === 'insuficiente') c.mensagem = 'Ainda não temos informação suficiente sobre hardware igual nesta configuração. Você pode contribuir para ampliar o banco de testes.';
      return json({ comparacoes, salvo: false });
    }
    const existente = await env.DB.prepare('SELECT contribuinte FROM benchmarks WHERE id = ?').bind(dados.id).first();
    if (existente && existente.contribuinte !== contribuinte) return json({ erro: 'Identificador já utilizado.' }, 409);
    if (!existente) {
      const comandos = [env.DB.prepare('INSERT INTO benchmarks(id, contribuinte, dados) VALUES (?, ?, ?)').bind(dados.id, contribuinte, JSON.stringify(dados))];
      for (const id of dados.ids) {
        const c = dados.componentes[id]; const h = c.hardware;
        comandos.push(env.DB.prepare('INSERT INTO resultados(benchmark_id, contribuinte, componente, grupo, tipo, marca, modelo, frequencia, hardware, configuracao, pontuacao, resumo, elegivel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(dados.id, contribuinte, id, grupos[id], h.tipo, h.marca, h.modelo, h.frequencia, JSON.stringify(h), JSON.stringify(c.configuracao), c.pontuacao, JSON.stringify(c.resumo), c.elegivel ? 1 : 0));
      }
      try { await env.DB.batch(comandos); } catch (e) {
        const repetido = await env.DB.prepare('SELECT contribuinte FROM benchmarks WHERE id = ?').bind(dados.id).first();
        if (repetido?.contribuinte !== contribuinte) throw e;
      }
    }
    return json({ id: dados.id, salvo: true, comparacoes }, existente ? 200 : 201);
  }
  if (req.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);
  if (url.pathname === '/api/ranking') {
    const componente = url.searchParams.get('componente') || 'cpu';
    if (!['cpu', 'gpu', 'memoria', 'disco'].includes(componente)) return json({ erro: 'Componente inválido.' }, 400);
    const params = [componente]; const filtros = ['r.componente = ?'];
    for (const k of ['tipo', 'marca', 'modelo']) if (url.searchParams.get(k)?.trim()) { filtros.push(`r.${k} = ? COLLATE NOCASE`); params.push(url.searchParams.get(k).trim().slice(0, 240)); }
    const freq = url.searchParams.get('frequencia');
    if (freq) { if (!(Number(freq) > 0)) return json({ erro: 'Frequência inválida.' }, 400); filtros.push('r.frequencia = ?'); params.push(Number(freq)); }
    const pagina = Math.max(0, Math.min(1000, Number.parseInt(url.searchParams.get('pagina') || '0', 10) || 0));
    const { results } = await env.DB.prepare(`SELECT r.grupo, r.hardware, r.configuracao, COUNT(*) contribuicoes, AVG(r.pontuacao) media, MIN(r.pontuacao) minimo, MAX(r.pontuacao) maximo, ${colunasMedias(componente)} FROM resultados r WHERE ${filtros.join(' AND ')} AND ${recentes} GROUP BY r.grupo ORDER BY media DESC, r.grupo LIMIT 50 OFFSET ?`).bind(...params, pagina * 50).all();
    return json({ componente, pagina, minimoContribuintes: MIN_CONTRIBUINTES, resultados: results.map((r) => ({ grupo: r.grupo, contribuicoes: r.contribuicoes, media: r.media, minimo: r.minimo, maximo: r.maximo, metricas: mediasPublicas(componente, r), hardware: JSON.parse(r.hardware), configuracao: JSON.parse(r.configuracao), suficiente: r.contribuicoes >= MIN_CONTRIBUINTES })), aviso: 'Resultados da comunidade, sem certificação. Cada identificador anônimo contribui com seu último teste elegível por configuração; compare configurações iguais.' });
  }
  const detalhe = url.pathname.match(/^\/api\/benchmarks\/([a-f0-9-]{36})$/i);
  if (detalhe) {
    const r = await env.DB.prepare('SELECT dados, criado FROM benchmarks WHERE id = ?').bind(detalhe[1]).first();
    return r ? json({ ...JSON.parse(r.dados), criado: r.criado }) : json({ erro: 'Benchmark não encontrado.' }, 404);
  }
  return json({ erro: 'Rota não encontrada.' }, 404);
}
export default {
  async fetch(req, env) {
    if (!new URL(req.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try { return await api(req, env); } catch { return json({ erro: 'Não foi possível acessar o banco. Tente novamente em instantes.' }, 503); }
  },
};
