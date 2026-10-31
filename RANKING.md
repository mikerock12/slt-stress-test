# Banco de benchmarks e ranking

Cloudflare Worker `slt-stress-test`, D1 `slt-stress-test-benchmarks`, binding `DB`.
Frontend continua sem dependências de execução. O protocolo atual é **v2**; o Worker aceita e
preserva o **v1** durante a transição, sem converter nem misturar os dados históricos.

## Metodologia v2 e compatibilidade

- GPU atual usa `webgl2-fence-v3`: `passadasPorSegundo`, `lotesConcluidosPorSegundo` e
  `rafPorSegundo` são medidas distintas. Nenhuma é FPS do display. `mpixPorSegundo` é
  pixel-shading equivalente. `tempoParedeLoteMs` inclui espera; `tempoGpuMs` só existe quando
  uma timer query válida o mede, sem `GPU_DISJOINT_EXT`.
- Divergências de referência medem autoconsistência visual no mesmo ambiente, não correção
  absoluta nem defeito físico isolado.
- No v1, `fps` continua sendo o campo histórico do motor `webgl2-fence-v2`. Embora ele já
  contasse passadas, não é reetiquetado como v2 nem agregado a `passadasPorSegundo`.
- O JSON local tem `schemaVersion` e `benchmarkMethodVersion` 2, build, commit, timestamps
  monotônicos, escopo, estados de execução e diagnóstico. O Worker usa timestamps relativos
  para validar as amostras, mas **não os persiste nem os publica**. No banco ficam séries,
  resumos e indicadores de qualidade recalculados.
- Não foi necessária migração D1: a versão e o perfil entram no hash do grupo. Registros e
  índices antigos permanecem intactos; rollback do Worker não exclui dados.

## Fluxo e privacidade

Ao terminar, o relatório consulta o banco. A pessoa pode marcar a contribuição antes de iniciar
ou clicar em “Contribuir com este teste” depois. Só então o teste é gravado. Sem marcação,
`POST /api/comparar` processa os dados em memória sem persistir o relatório. O navegador guarda
UUID aleatório para distinguir contribuições repetidas; o servidor armazena apenas seu hash.
Esse hash não é público. IP é usado pelo limitador do Cloudflare, não gravado no D1.

O identificador é pseudônimo, não anonimização irreversível. A API exige consentimento da
política atual para publicar, registra versão/data e oferece POST `/api/privacidade/exportar`
e `/api/privacidade/excluir`, autenticados pela chave local. Exclusão é atômica e revoga essa
chave; conhecer o ID público de teste não autoriza excluir. Limpeza diária remove contribuições
com mais de 12 meses. Política pública em [privacidade.html](privacidade.html), operação e
restauração de backups em [PRIVACIDADE.md](PRIVACIDADE.md).

São públicos: hardware identificado, parâmetros, séries numéricas, resumos recalculados,
qualidade da medição e resultados detalhados de disco. Não se enviam logs livres, nome/e-mail,
números de série, rótulos de volumes ou caminhos locais. Dados privados do inventário completo
permanecem no relatório local. A API valida e projeta campos permitidos, sem aceitar média do
cliente. A política e a versão de consentimento não mudaram nesta etapa.

## Referência estatística e elegibilidade

- Grupo exato por **versão**, perfil, componente, marca/modelo, capacidade e frequência
  nominal/configurada disponível, contexto do hardware, motor, SO, navegador, energia e
  parâmetros. GPU separa resolução/intensidade; CPU, threads; memória, alocação real; disco,
  política de cache, sincronização e fila quando identificada.
- Testes isolados e simultâneos não se misturam. Parâmetros dos componentes concorrentes e
  duração prevista entram na chave. Frequência desconhecida fica separada da conhecida.
- No v1, mantém-se a regra histórica: concluído, ao menos 115 segundos, 10 amostras positivas,
  sem falha/erros e com modelo identificado.
- No v2, cada série precisa de timestamps monotônicos crescentes, compatíveis com a duração.
  O servidor recalcula amostras válidas, tempo útil e cobertura. No perfil rápido exige 100 s
  úteis e pelo menos 80% de cobertura; perfis mais longos exigem 80% do alvo, conclusão dentro
  da tolerância de 5 s e ausência de erros/falhas. O número de amostras também precisa sustentar
  a métrica principal. Motivos de inelegibilidade são registrados em linguagem técnica.
  Em uma carga combinada, erro, falha do motor, duração ou cobertura insuficiente em qualquer
  componente selecionado torna a execução inteira inelegível. Hardware não identificado ou
  emulação exclui apenas o grupo/componente correspondente, sem apagar o histórico.
  Disco é a exceção de amostragem: velocidades entram somente ao concluir uma fase. Sua
  elegibilidade exige ao menos um ciclo completo e cobertura do acompanhamento por segundo;
  não exige 100 medições de velocidade. Ciclos e medições de fase aparecem separadamente.
- Aquecimento e lacunas não viram zero. Estatísticas temporais incluem P5/P50/P95, queda entre
  janelas, queda em relação ao melhor intervalo de 5 s e regressões sustentadas. Queda não é
  termômetro nem prova de defeito.
- Cliente também exclui teste que passou pelo segundo plano. Isso é autodeclarado; lacunas e
  cobertura são verificáveis, mas não atestam toda a atividade do aparelho.
- Último resultado elegível por identificador pseudônimo e grupo contribui para a média.
  A comparação exclui **todos** os resultados da própria pessoa.
- Mínimo de cinco **outros identificadores pseudônimos**. Faixa “na média”: ±10%; acima/abaixo
  fora da faixa. São regras explícitas, não intervalos estatísticos de confiança.
- Sem dados suficientes, informa a ausência. Falta de identificação ou teste inválido não
  resulta em alegação de hardware lento.

Banco comunitário, sem certificação/atestado de integridade. UUID pode ser redefinido e um
cliente alterado pode enviar números forjados: não é prova de cinco pessoas físicas nem um
ranking homologado. O sistema não mistura esses dados com benchmarks de ferramentas externas.

## API e operação

| Método / rota | Uso |
| --- | --- |
| POST `/api/benchmarks` | Salvar contribuição v1 ou v2 e devolver comparação; UUID idempotente |
| POST `/api/comparar` | Consultar sem persistir |
| GET `/api/ranking?componente=gpu&versao=2` | Grupos da metodologia escolhida; filtros `tipo`, `marca`, `modelo`, `frequencia`, `pagina` |
| GET `/api/benchmarks/:uuid` | Séries, qualidade e dados públicos de um teste para comparar um a um |

Sem o parâmetro `versao`, a API de ranking assume v1 para não quebrar clientes antigos. O site
atual consulta v2 por padrão e oferece “Anterior (v1 · histórico)” no filtro. A resposta informa
`metricaPrincipal`; v1 usa `fps` histórico e v2, `passadasPorSegundo`.

50 grupos por página. Grupos pequenos aparecem como informação insuficiente. Classificação é
por média da métrica principal da versão; linhas de configurações diferentes não são classificação
direta de hardware. Métricas adicionais ficam nos resultados completos e na comparação lado a lado.

Envios: `application/json`, origem oficial ou desenvolvimento explicitamente listada, 10 pedidos
POST/minuto/IP por localização Cloudflare, máximo de 1,5 MB e 7.200 amostras por série. O limite
evita exceder uma linha do D1 e abuso; teste muito longo que exceder isso continua exportável
localmente e **não** aparece como salvo. Não há corte silencioso de séries. Sem banco/conexão,
o relatório continua disponível e oferece nova tentativa. Gravação do teste/componentes é atômica.

```powershell
npm run dev:api       # migração local e Worker em localhost:8787
npm run check         # inclui integração com SQLite real e separação v1/v2
npm run db:migrar     # aplicar migrações no D1 remoto, quando houver
npm run deploy        # somente na main, depois de CI verde e merge
```

Testes sintéticos ficam apenas nos bancos de memória/local. Nunca popular a produção com
números de exemplo. Backup D1: `npx wrangler@4 d1 export DB --remote --output caminho.sql`.
Esquema e código ficam no backup Git; o dump remoto precisa de backup próprio.

Referências: [migrações D1](https://developers.cloudflare.com/d1/reference/migrations/),
[configuração Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/),
[limitação de requisições](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
