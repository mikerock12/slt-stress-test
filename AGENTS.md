# AGENTS.md — como trabalhar neste repositório

Guia para qualquer agente (Claude, Codex ou outro) que continue o **SLT Stress Test**
(stresstest.smellsliketech.com.br). O histórico e o estado atual ficam em
[contexto.md](contexto.md). **Atualize os dois arquivos durante o trabalho**, não só no final:
o dono troca de agente quando a cota acaba, e quem chega precisa saber onde parou.

## Regras do dono

- Responder sempre em **português do Brasil**: conversas, commits, PRs, documentação e textos
  do site.
- **Nunca** pôr `Co-Authored-By` nem "Generated with …" em commits ou PRs.
- Nunca imprimir, colar ou versionar segredos (tokens do Cloudflare, GitHub, Google). O dono
  digita credenciais e faz login ele mesmo. Peça antes de aceitar termos.
- Todo endereço `*@smellsliketech.com.br` usado no site precisa existir no Cloudflare Email
  Routing encaminhando para smellsliketechinfo@gmail.com. Pergunte antes de criar um novo.
  O site usa só `contato@` (já existe).
- Mudança só de documentação pode ir direto à `main`. Código vai por branch → PR → CI verde →
  merge.
- Não inventar números: o que o navegador não consegue medir (temperatura, clock real da GPU,
  frequência da RAM, SMART do disco) aparece como "não disponível" com a explicação, nunca
  como valor estimado disfarçado. Estimativas levam o rótulo "estimado".

## Mapa

Frontend estático (HTML + CSS + ES modules), sem dependências de execução. API no Cloudflare
Worker com D1 para benchmarks; APK Android com interface embarcada e cargas Java/C++ (NDK).

| Caminho | O que é |
| --- | --- |
| `index.html` | Página única: hero, configuração, painel ao vivo, relatório, como funciona, créditos |
| `css/style.css` | Tema escuro da marca (tokens em `:root`) |
| `js/app.js` | Orquestrador: seleção, cronômetro, amostragem a cada 1 s, wake lock, UI ao vivo |
| `js/sistema.js` | Informações do sistema que o navegador expõe |
| `js/metricas.js` | Estatística pura (média, mín, máx, CV, queda início→fim). Testada |
| `js/avaliacao.js` | Veredito por componente (aprovado/atenção/falhou). Testada |
| `js/relatorio.js` | Monta o relatório HTML, exporta JSON e imprime/PDF |
| `js/graficos.js` | Sparklines e gráficos em canvas (sem biblioteca) |
| `js/testes/*.js` | Um módulo por teste: `cpu`, `gpu`, `memoria`, `disco`, `pressao` |
| `js/workers/*.worker.js` | Carga pesada fora da thread principal |
| `js/plugin.js` | Cliente do plugin local (detecção, sensores, SMART, benchmark) |
| `js/protecao.js` | Proteção de temperatura (limites CPU/GPU, para o teste após 3 s acima). Testada |
| `js/testes/disco-plugin.js` | Teste de disco real via plugin (substitui o OPFS quando escolhido) |
| `plugin/SLTStressTest.Plugin/` | Plugin Windows (.NET 10, bandeja + Kestrel em 127.0.0.1:5299, LibreHardwareMonitorLib). Ver `plugin/README.md` |
| `tests/*.test.mjs` | `node --test` das partes puras |
| `scripts/servidor.mjs` | Servidor local de desenvolvimento (porta 5173) |
| `_headers` | Cabeçalhos do Cloudflare Pages |
| `worker/index.js` / `migrations/` | API de benchmarks/ranking e migrações D1 |
| `js/benchmark.js` / `js/ranking.js` | Contrato validado no servidor, grupos comparáveis e UI |
| `js/dispositivo.js` / `js/android.js` | Detecção celular/desktop e bridge com APK |
| `android/` | APK com CPU/memória/disco nativos e WebGL2; ver `android/README.md` |
| `privacidade.html` / `PRIVACIDADE.md` | Política pública e procedimentos de privacidade |
| `worker/privacidade.js` / `js/privacidade.js` | Consentimento, exportação, exclusão e retenção |

### Contrato dos testes

Cada módulo em `js/testes/` exporta uma classe com:

```js
static id; static nome;
async iniciar(opcoes, aoEvento)   // aoEvento({tipo:'log'|'erro', msg})
amostra()                         // { metrica: valor } do último segundo
async parar()                     // libera workers, arquivos, contexto WebGL
info()                            // dados fixos para o relatório (ex.: renderer da GPU)
```

As métricas e os rótulos ficam em `js/avaliacao.js` (`METRICAS`). Ao criar uma métrica nova,
registre lá, avalie no veredito e acrescente teste em `tests/`.

## Verificar

```bash
npm test          # node --test das funções puras
npm run check     # sintaxe de todos os .js + testes
npm run dev       # http://localhost:5173
npm run build     # dist/ só com o que vai ao ar
npm run dev:api   # site + Worker + D1 local em 8787
node scripts/testar-cargas-android.mjs # algoritmos Java, JDK 17+
dotnet publish plugin/SLTStressTest.Plugin -c Release -o plugin/publicado
```

### Plugin

- Contrato em `plugin/README.md`; o site fala com ele em `js/plugin.js`. Os dois mudam juntos
  e `PROTOCOLO` sobe quando a mudança quebra compatibilidade.
- Origens aceitas ficam em `Servidor.cs` (`Origens`). Nunca abrir para `*` nem escutar fora do
  loopback.
- O site só procura o plugin depois de um clique (ou se já foi usado antes no navegador), para
  o Chrome não pedir "acesso à rede local" a quem nunca baixou.
- O `.exe` é publicado como asset `SLTStressTestPlugin.exe` de uma release do GitHub; o link do
  site aponta para `releases/latest/download/`.
- Sem o driver PawnIO não há temperatura/clock por núcleo da CPU: o clock vem do contador de
  desempenho do Windows. O dono autorizou em 23/10/2026 incluir o PawnIO no exe, com instalação
  e configuração automáticas, licença, fontes exigidas e créditos; entregue no plugin 1.2.0.
  O pacote usa SYS/INF/CAT oficiais assinados e instalação PnP própria após aceitação.
  Nunca desativar proteções do Windows. A validação local da instalação ficou incompleta:
  o UAC foi cancelado; não repetir nem contornar essa recusa sem nova instrução específica.
- O plugin pede administrador (manifesto). O terminal de desenvolvimento do dono já roda
  elevado.

Teste manual mínimo antes de PR: rodar cada teste em "2 min" no Chrome e no Firefox, um
MAX STRESS de 2 min, conferir o relatório, a impressão em PDF e o JSON exportado.

## Trabalho multiagente

1. Antes de começar, leia `contexto.md` → "Estado atual" e "Em andamento".
2. Registre em "Em andamento" o que vai fazer (agente, branch, arquivos). Dois agentes nunca
   editam os mesmos arquivos ao mesmo tempo; os módulos de teste são independentes entre si
   e são a divisão natural de trabalho (um agente por `js/testes/<x>.js` + worker).
3. Arquivos compartilhados (`js/app.js`, `js/avaliacao.js`, `index.html`, `css/style.css`)
   têm um dono por vez: anote em "Em andamento".
4. Uma branch por tarefa (`feat/…`, `fix/…`, `docs/…`), PR pequeno, CI verde, merge.
5. Ao terminar, mova o item para o histórico do `contexto.md` com data, PR e verificação.

## Publicação

- Hospedagem: Cloudflare Workers com assets estáticos, API e D1 (o Pages foi incorporado ao Workers),
  Worker `slt-stress-test`, configuração em `wrangler.jsonc`. Publicar a partir da `main`:
  `npm run db:migrar` e `npm run deploy` (monta `dist/` e roda `wrangler deploy`). O domínio
  `stresstest.smellsliketech.com.br` é um custom domain do Worker, criado pelo próprio deploy;
  a zona smellsliketech.com.br usa nameservers do Cloudflare, então o Registro.br não muda.
- Repositório público no GitHub; backup em `G:/Meu Drive/Backups/Smells Like Tech - Stress Test/`.

## Última entrega (23/10/2026)

Em andamento em 24/10/2026: Codex, branch `codex/corrige-estabilidade-celulares`,
investiga travamento ao encerrar no Galaxy A52, carga/proteção móvel no iPhone 11 e
sensores Android/MediaTek no POCO X7 PRO. Escopo e verificações em contexto.md.
Correções implementadas e APK 1.3.0 preparado; validações e entrega ainda em andamento.

PRs #7 e #8 integrados, CI verde de site/API, Android e plugin. Release v1.2.1 publicada:
APK Android 1.2.1 e plugin Windows 1.2.0 (mesmo binário aprovado no CI do PR #7).
Download do APK pelo próprio domínio, sem redirecionamento, com hash validado no build;
Chrome concluiu o download em produção. Falta confirmação no POCO X7 PRO físico.
PawnIO 2.2.0 incluído no exe com GPL/exceção, fontes, licenças e créditos. A aceitação e
instalação de teste foram autorizadas, mas o UAC local foi cancelado; rotina PnP não
validada ponta a ponta. O serviço já ativo não é evidência de instalação pelo novo exe.
Política de privacidade e controles técnicos publicados: consentimento versionado,
exportação/exclusão por chave e retenção de 12 meses. Procedimentos e limites jurídicos/
operacionais em PRIVACIDADE.md; não declarar certificação integral de conformidade LGPD.
Worker de produção: `08475345-749d-4b3f-9b35-443d9fc6c51f`, migração 0002 aplicada.

PR #6 integrado na main, CI verde de site/API, Android e plugin. Release v1.1.0 e produção publicadas.
README e seção Sobre do GitHub atualizados com APK Android, plugin Windows e ranking;
downloads, requisitos, métodos nativos e comandos de desenvolvimento documentados.
Estado e verificações em contexto.md. Leituras indisponíveis no Android continuam explícitas;
nunca tratar temperatura da bateria como temperatura de CPU/GPU.


Android: interface embarcada, bridge só com assets do próprio APK; root opcional apenas pelo
botão nativo e comando fixo somente leitura. Ranking: não misturar motores, configurações,
frequências desconhecidas e medidas; envio opt-in, sem séries sintéticas no banco de produção.
Emuladores identificados ficam fora das médias de hardware físico. A chave e a senha de
assinatura em `.local/assinatura-android/` são privadas: não imprimir, versionar nem copiar
para a nuvem sem autorização específica. O backup padrão exclui esses arquivos.
Exceção autorizada expressamente pelo dono em 23/10/2026: cópia dos dois arquivos em
`2026-10-23/privado/assinatura-android/` dentro da pasta de backup abaixo, com integridade
conferida. Essa autorização se limita a essa pasta/data; os segredos continuam fora do Git
e da release.
Backup de fontes, histórico, release e dump D1 conferido em
`G:/Meu Drive/Backups/Smells Like Tech - Stress Test/2026-10-23/`.
