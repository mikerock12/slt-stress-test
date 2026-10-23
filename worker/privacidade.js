import { identificadorValido } from '../js/privacidade.js';

export async function atenderPrivacidade(caminho, entrada, env, hash, json) {
  if (!identificadorValido(entrada?.contribuinte)) return json({ erro: 'Chave de contribuições inválida.' }, 400);
  const contribuinte = await hash(entrada.contribuinte);
  if (caminho === '/api/privacidade/excluir') {
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM benchmarks WHERE contribuinte = ?').bind(contribuinte).first();
    // A revogação permite sanear backups antes de qualquer restauração.
    await env.DB.batch([
      env.DB.prepare('INSERT OR REPLACE INTO revogacoes(contribuinte) VALUES (?)').bind(contribuinte),
      env.DB.prepare('DELETE FROM resultados WHERE contribuinte = ?').bind(contribuinte),
      env.DB.prepare('DELETE FROM benchmarks WHERE contribuinte = ?').bind(contribuinte),
    ]);
    return json({ excluidos: n.n, revogado: true });
  }
  const pagina = Number.isInteger(entrada.pagina) && entrada.pagina >= 0 ? Math.min(entrada.pagina, 10000) : 0;
  const { results } = await env.DB.prepare('SELECT id, criado, dados, consentimento_versao, consentido_em FROM benchmarks WHERE contribuinte = ? ORDER BY criado, id LIMIT 11 OFFSET ?').bind(contribuinte, pagina * 10).all();
  return json({ testes: results.slice(0, 10).map((r) => ({ ...JSON.parse(r.dados), criado: r.criado, consentimento: { versao: r.consentimento_versao, em: r.consentido_em } })), proximaPagina: results.length > 10 ? pagina + 1 : null });
}

export async function expirarDados(env) {
  // Prazo público de 12 meses; filhos removidos na mesma transação.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM resultados WHERE benchmark_id IN (SELECT id FROM benchmarks WHERE criado < strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 months'))").bind(),
    env.DB.prepare("DELETE FROM benchmarks WHERE criado < strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 months')").bind(),
  ]);
}
