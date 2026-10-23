export const VERSAO_PRIVACIDADE = '2026-10-23';
export const consentimentoRanking = () => ({ versao: VERSAO_PRIVACIDADE, finalidade: 'ranking-publico', aceito: true });
export function consentimentoValido(c) {
  return c?.versao === VERSAO_PRIVACIDADE && c?.finalidade === 'ranking-publico' && c?.aceito === true;
}
export function identificadorValido(s) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s || '');
}
export async function minhasContribuicoes(acao, pagina = 0) {
  const contribuinte = localStorage.getItem('slt-contribuinte');
  if (!identificadorValido(contribuinte)) throw new Error('Este navegador não tem uma chave de contribuições. Se você apagou os dados locais, fale com nosso contato de privacidade.');
  const r = await fetch(`/api/privacidade/${acao}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contribuinte, pagina }), signal: AbortSignal.timeout(30000) });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro || 'Não foi possível atender ao pedido.');
  return dados;
}
export function iniciarPrivacidade() {
  const saida = document.querySelector('#privacidade-resultado');
  if (!saida) return;
  let pagina = 0;
  document.querySelector('#privacidade-exportar').onclick = async (e) => {
    const botao = e.currentTarget; botao.disabled = true; saida.textContent = 'Preparando seus dados…';
    try {
      const dados = await minhasContribuicoes('exportar', pagina);
      // Uma página por clique evita disparar vários downloads ou exceder o limite da API.
      const json = JSON.stringify(dados, null, 2);
      if (globalThis.SLTAndroid?.exportar) globalThis.SLTAndroid.exportar(json);
      else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = `slt-minhas-contribuicoes-${pagina + 1}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      pagina = dados.proximaPagina ?? 0;
      botao.textContent = dados.proximaPagina !== null ? 'Exportar próxima página' : 'Exportar minhas contribuições';
      saida.textContent = `${dados.testes.length} teste(s) exportado(s).${dados.proximaPagina !== null ? ' Há outras páginas; clique novamente para continuar.' : ' Exportação concluída.'}`;
    } catch (erro) { saida.textContent = erro.message; } finally { botao.disabled = false; }
  };
  document.querySelector('#privacidade-excluir').onclick = async (e) => {
    if (!document.querySelector('#privacidade-confirmar').checked) { saida.textContent = 'Marque a confirmação para excluir suas contribuições.'; return; }
    const botao = e.currentTarget; botao.disabled = true;
    try {
      const r = await minhasContribuicoes('excluir');
      localStorage.removeItem('slt-contribuinte');
      saida.textContent = `${r.excluidos} teste(s) excluído(s) do banco ativo e do ranking. A autorização foi revogada; uma nova contribuição exigirá nova escolha. Para cópias de backup e outros direitos, use o contato abaixo.`;
    } catch (erro) { saida.textContent = erro.message; } finally { botao.disabled = false; }
  };
}
