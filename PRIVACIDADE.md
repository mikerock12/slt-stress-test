# Operação de privacidade — SLT Stress Test

Política pública em [privacidade.html](privacidade.html), versão 2026-10-23.
Controlador informado pelo dono: Smells Like Tech Informática, CNPJ 30.054.253/0001-09.
Canal: contato@smellsliketech.com.br, já existente no Email Routing.

## Revisão técnica

- Corrigidas afirmações antigas de que nada saía do computador: comparar já envia dados
  técnicos à API, mesmo sem persistir. O inventário bruto fica no relatório local.
- Publicação opt-in, desmarcada, com finalidade e informação de publicidade das séries.
  API exige consentimento específico da política atual e registra versão/data.
- Registros legados sem prova de versão/data ficam fora da API pública e das médias;
  não inventar consentimento retroativo. O próprio dono ainda pode exportar e excluir.
- UUID local e seu hash são pseudônimos; não chamar de anonimização irreversível.
- Campos projetados no servidor; sem IP/nome/e-mail/serial/caminhos/logs no D1.
- POST de exportação paginada e exclusão autenticado pela chave aleatória do navegador,
  com restrição de origem, limite de corpo e rate limit. Sem chave: atendimento pelo canal,
  com verificação proporcional; conhecer o ID público do teste não basta para excluir.
- Exclusão atômica de testes/resultados e registro mínimo de revogação. A chave revogada
  não pode publicar novamente. Nova escolha gera outra chave após a exclusão local.
- Limpeza diária dos testes com mais de 12 meses, incluindo resultados relacionados.
- Sem publicidade nem analytics incluídos; armazenamento local funcional documentado.
- APK inclui a política offline e mantém o mesmo contrato de consentimento. APK antigo
  continua testando, mas deve atualizar para voltar a publicar contribuições.

## Backups e atendimento

1. Pedidos abrangem o banco ativo e a análise de backups privados. Não publicar dumps.
2. Exportar a tabela `revogacoes` atual antes de restaurar qualquer dump anterior.
3. Antes de disponibilizar a restauração, reaplicar as exclusões de todos os hashes em
   `revogacoes`, tanto em `resultados` quanto em `benchmarks`, e executar a limpeza de
   retenção. Não restaurar uma cópia para produção sem esse saneamento.
4. Sanear ou eliminar cópias antigas afetadas pelo pedido quando não houver hipótese legal
   de conservação; registrar o atendimento sem reter o relatório ou identificação excessiva.
   O registro mínimo de revogação só deve permanecer enquanto houver cópias a sanear.
5. Perda da chave, correção e portabilidade precisam de atendimento humano. A página indica
   o contato; não exigir documentos indiscriminadamente nem enviar a chave em e-mail.

## Limites da verificação

Esta revisão cobre código e transparência do produto. Não é certificação jurídica de
conformidade. Permanecem dependentes da operação do controlador: atendimento de direitos,
gestão/eliminação de backups, contratos e salvaguardas de transferências internacionais,
configurações e retenção de logs dos fornecedores, resposta a incidentes e controle de
acesso às contas. Não declarar esses itens verificados sem evidência contratual/operacional.

Referências oficiais: [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm),
[guia de cookies da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais),
[ANPD](https://www.gov.br/anpd/pt-br).
