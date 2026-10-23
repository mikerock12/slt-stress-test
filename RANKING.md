# Banco de benchmarks e ranking

Cloudflare Worker `slt-stress-test`, D1 `slt-stress-test-benchmarks`, binding `DB`.
Frontend continua sem dependências de execução; protocolo de dados e algoritmo são versão 1.

## Fluxo

Ao terminar, o relatório consulta o banco. A pessoa pode marcar a contribuição antes de iniciar
ou clicar em “Contribuir com este teste” depois. Só então o teste é gravado. Sem marcação,
`POST /api/comparar` processa os dados em memória sem persistir o relatório. O navegador guarda
UUID aleatório para distinguir contribuições repetidas; o servidor armazena apenas seu hash.
Esse hash não é público. IP é usado pelo limitador do Cloudflare, não gravado no D1.

São públicos: hardware identificado, parâmetros, séries numéricas, resumos recalculados e
resultados detalhados de disco. Não se enviam logs livres, nome/e-mail da pessoa, números de
série, rótulos de volumes ou caminhos locais. Dados privados do inventário completo permanecem
no relatório local. A API valida e projeta campos permitidos, sem aceitar média do cliente.

## Referência estatística

- Grupo exato por componente, marca/modelo, capacidade e frequência nominal/configurada
  disponível, contexto do hardware, motor/versão, SO, navegador, energia e parâmetros.
- GPU separada por resolução/intensidade. CPU por threads. Memória por alocação real.
- Testes isolados e simultâneos não se misturam. Parâmetros dos componentes concorrentes e
  duração prevista entram na chave. Frequência desconhecida fica separada da conhecida.
- Apenas teste concluído, pelo menos 115 segundos (tolerância do cronômetro de 2 minutos),
  10 amostras positivas da métrica principal, sem falha/erros e com modelo identificado.
- Cliente também exclui teste que passou pelo segundo plano. Isso é autodeclarado, não atestado.
- Último resultado elegível por identificador anônimo e grupo contribui para a média.
  A comparação exclui **todos** os resultados da própria pessoa.
- Mínimo de cinco **outros identificadores anônimos**. Faixa “na média”: ±10%; acima/abaixo
  fora da faixa. São regras iniciais explícitas, não intervalos estatísticos de confiança.
- Sem dados suficientes, informa a ausência e agradece a contribuição. Falta de identificação
  ou teste inválido não resulta em alegação de hardware lento.

Banco comunitário, sem certificação/atestado de integridade. UUID pode ser redefinido e um
cliente alterado pode enviar números forjados: não é prova de cinco pessoas físicas nem um
ranking homologado. O sistema não mistura esses dados com benchmarks de ferramentas externas.

## API e operação

| Método / rota | Uso |
| --- | --- |
| POST `/api/benchmarks` | Salvar contribuição e devolver comparação; UUID de teste idempotente |
| POST `/api/comparar` | Consultar sem persistir |
| GET `/api/ranking?componente=cpu` | Grupos; filtros exatos `tipo`, `marca`, `modelo`, `frequencia`, `pagina` |
| GET `/api/benchmarks/:uuid` | Séries e dados públicos de um teste para comparar um a um |

50 grupos por página. Grupos pequenos aparecem como informação insuficiente. Classificação é
por média da métrica principal; linhas de configurações diferentes não são classificação direta
de hardware. Métricas adicionais ficam nos resultados completos e na comparação lado a lado.

Envios: `application/json`, origem oficial ou desenvolvimento explicitamente listada, 10 pedidos
POST/minuto/IP por localização Cloudflare, máximo de 1,5 MB e 7.200 amostras por série. O limite
evita exceder uma linha do D1 e abuso; teste muito longo que exceder isso continua exportável
localmente e **não** aparece como salvo. Não há corte silencioso de séries. Sem banco/conexão,
o relatório continua disponível e oferece nova tentativa. Gravação do teste/componentes é atômica.

```powershell
npm run dev:api       # migração local e Worker em localhost:8787
npm run check         # inclui integração com SQLite real
npm run db:migrar     # aplicar migrações no D1 remoto
npm run deploy       # somente na main, depois de CI verde e merge
```

Testes sintéticos ficam apenas nos bancos de memória/local. Nunca popular a produção com
números de exemplo. Backup D1: `npx wrangler@4 d1 export DB --remote --output caminho.sql`.
Esquema e código ficam no backup Git; o dump remoto precisa de backup próprio.

Referências: [migrações D1](https://developers.cloudflare.com/d1/reference/migrations/),
[configuração Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/),
[limitação de requisições](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
