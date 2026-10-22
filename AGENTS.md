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

Site estático, sem build e sem dependências de execução (HTML + CSS + ES modules).

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
| `js/testes/disco-plugin.js` | Teste de disco real via plugin (substitui o OPFS quando escolhido) |
| `plugin/SLTStressTest.Plugin/` | Plugin Windows (.NET 10, bandeja + Kestrel em 127.0.0.1:5299, LibreHardwareMonitorLib). Ver `plugin/README.md` |
| `tests/*.test.mjs` | `node --test` das partes puras |
| `scripts/servidor.mjs` | Servidor local de desenvolvimento (porta 5173) |
| `_headers` | Cabeçalhos do Cloudflare Pages |

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
  desempenho do Windows. Não distribuir o PawnIO junto.
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

- Hospedagem: Cloudflare Workers com assets estáticos (o Pages foi incorporado ao Workers),
  Worker `slt-stress-test`, configuração em `wrangler.jsonc`. Publicar a partir da `main`:
  `npm run deploy` (monta `dist/` e roda `wrangler deploy`). O domínio
  `stresstest.smellsliketech.com.br` é um custom domain do Worker, criado pelo próprio deploy;
  a zona smellsliketech.com.br usa nameservers do Cloudflare, então o Registro.br não muda.
- Repositório público no GitHub; backup em `G:/Meu Drive/Backups/Smells Like Tech - Stress Test/`.
