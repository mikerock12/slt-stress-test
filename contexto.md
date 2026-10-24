# Contexto do projeto — SLT Stress Test

Atualizado em 24/10/2026, horário de Brasília (America/Sao_Paulo).
Cópia principal: `D:/PROJETOS/SLTStressTest`. Regras de trabalho em [AGENTS.md](AGENTS.md).

## Objetivo

Site **stresstest.smellsliketech.com.br**, da Smells Like Tech, que testa o computador direto
no navegador, inspirado em ferramentas nativas consagradas:

| Componente | Inspiração | O que fazemos no navegador |
| --- | --- | --- |
| CPU | Prime95 | Lucas-Lehmer em primos de Mersenne conhecidos (BigInt) + FFT de ponto flutuante verificada, em todos os núcleos via Web Workers |
| GPU | FurMark | "Rosquinha peluda" em raymarching WebGL2 com resolução fixa; FPS, Mpixels/s e verificação de quadro determinístico (artefatos) |
| Memória | MemTest86 | Padrões (sólidos, xadrez, walking ones, endereço, inversões móveis, aleatório) em buffers grandes; banda de escrita/leitura/cópia e latência |
| Disco | CrystalDiskMark / CrystalDiskInfo | Arquivo temporário no OPFS: sequencial 1 MiB e aleatório 4 KiB, leitura/escrita, com verificação dos dados |

Modos: testar um por um ou **MAX STRESS** (todos juntos). Durações: 2 min (rápido), 15 min,
30 min, 1 h ou indefinido. Ao final, relatório conciso e didático com médias, mínimos,
máximos, estabilidade, queda de desempenho e veredito por componente; exporta PDF e JSON.

### Limites do navegador (decisão de produto)

O navegador **não** expõe temperatura, clock real da GPU, frequência da RAM nem SMART do
disco. O site mostra isso explicitamente e usa indicadores honestos no lugar:

- **Clock da CPU**: estimado por cadeia de operações dependentes (rótulo "estimado").
- **Térmica**: queda de desempenho início→fim (sinal de *thermal throttling*) e, no
  Chrome/Edge, a Compute Pressure API (`nominal/fair/serious/critical`).
- **Disco**: velocidade do armazenamento do navegador; leituras podem vir do cache do SO.
- Para sensores reais, o site recomenda ferramentas nativas (créditos na página).

As ferramentas originais (Prime95, FurMark, MemTest86, CrystalDiskMark/Info) são programas
nativos e não rodam em página web; por isso foram recriados os princípios, com créditos e
links. Nenhum código delas foi copiado.

## Estado atual

- 23/10/2026 — **Download direto, PawnIO e privacidade publicados** nos PRs
  [#7](https://github.com/mikerock12/slt-stress-test/pull/7) e
  [#8](https://github.com/mikerock12/slt-stress-test/pull/8), ambos com CI verde nos três jobs.
  Merges `6dae97e490402182f0400ffa193c0b6fa8e1ac7b` e
  `ad3b5d04383bd4f910f9f45a2a74d599db478de2`. Release
  [v1.2.1](https://github.com/mikerock12/slt-stress-test/releases/tag/v1.2.1): APK 1.2.1
  (versionCode 3, mesma assinatura), plugin Windows 1.2.0 do CI, fontes PawnIO e checksums.
  Worker `08475345-749d-4b3f-9b35-443d9fc6c51f`, migração `0002_privacidade.sql` aplicada.
  Download Android agora no próprio domínio, sem redirecionamento, nome versionado e hash
  validado no build; URL 1.2.0 preservada. APK 1.2.1 SHA-256
  `ef783be779cd98c9b55eaa6ea7bef4299f797fd0a91932eaf81c69bc5a4e6fc8`.
  Chrome com identificação de POCO concluiu download real de produção e conferiu os bytes.
  O travamento relatado no POCO físico não foi reproduzido; falta confirmação do dono.
- PawnIO 2.2.0 x64 oficial incluído no exe: SYS/INF/CAT originais assinados, GPL-2.0 ou
  posterior com exceção, fontes com PawnPP e módulos 0.1.6, licenças e créditos. Instalação
  própria via PnP após aceitação, sem baixar outro programa nem desativar proteções. Fontes
  e licenças acessíveis pela bandeja. Integridade dos recursos aprovada no CI Windows.
  O dono autorizou aceitar a licença e instalar para teste; UAC local foi cancelado.
  Não repetir/contornar. Serviço PawnIO já ativo não prova a nova instalação; rotina PnP
  segue sem validação ponta a ponta. Plugin SHA-256
  `b4735f7346ad3977f957d70653c8a4a8e29eaff35a8754f126c525d3a7477350`.
- Privacidade: controlador Smells Like Tech Informática, CNPJ 30.054.253/0001-09 e contato
  existente. Política online/offline, consentimento opt-in versionado e desmarcado,
  pseudônimo descrito corretamente, exportação paginada e exclusão/revogação por chave,
  limpeza diária após 12 meses. Três registros legados sem prova de consentimento saíram
  da API pública/médias; continuam exportáveis/excluíveis pelo dono. Sem fixtures em produção.
  Revisão técnica e pendências operacionais/jurídicas em PRIVACIDADE.md; não é certificação
  integral LGPD. PR #8 corrigiu referência oficial da ANPD também na política do APK.
- Verificações desta entrega: 44/44 JS/SQLite; build/lint Android e assinatura v2;
  ELF LOAD/RELRO e ZIP com alinhamento 16 KB nas quatro ABIs. Chrome e Firefox: cada teste
  e MAX STRESS de 2 min, relatório, JSON e impressão, sem erros JS. Política mobile sem
  transbordamento; exportação/exclusão reais no D1 local. Em produção: política e rankings
  200, entradas inválidas 400, download completo com SHA correto, sem inserir testes falsos.
  APK 1.2.0 instalado e processo aberto no emulador Android 16; System UI teve ANR e recebeu
  Esperar. Não atribuir isso ao app nem alegar nova validação completa da interface Android.
  Fontes, Git, releases e dump D1 consolidados no backup de 23/10/2026, com hashes conferidos.

- 23/10/2026 — Apresentação pública do GitHub atualizada: README com plataformas, downloads
  da release, métodos nativos, ranking, limites e comandos atuais; seção Sobre com descrição,
  link do site e tópicos. Conferidos os dados remotos e os links para documentação local.
- 23/10/2026 — **Android e ranking no ar**: PR [#6](https://github.com/mikerock12/slt-stress-test/pull/6),
  merge `ac241d5`, CI verde de site/API, Android e plugin. Release
  [v1.1.0](https://github.com/mikerock12/slt-stress-test/releases/tag/v1.1.0) com APK universal
  assinado (ARM/ARM64/x86/x86_64), plugin Windows 1.1.0 e checksums. Worker publicado na versão
  `8aa825da-7d9b-46c2-befc-f773ea679d7e`, D1 `slt-stress-test-benchmarks`
  (`267f4cce-4746-4234-83e8-66b29d757a5b`), migração `0001_benchmarks.sql` aplicada.
  Site distingue desktop, Android e iOS; APK é exclusivo do Android. CPU/disco Java,
  memória C++/NDK fora do heap Java e GPU WebGL2. Interface embarcada, PDF/JSON nativos,
  sensores com fonte e modo avançado opcional de somente leitura para root já existente.
- Ranking: contribuição opcional, séries e médias recalculadas no servidor; comparação por
  hardware/configuração equivalentes e ao menos cinco outros identificadores pseudônimos.
  Último teste elegível por identificador/grupo; todos os próprios resultados são excluídos
  da referência. Sem modelo exato/dados suficientes, informa a ausência; emulação e testes
  interrompidos/com erros ficam fora das médias. Sem séries sintéticas em produção.
  Detalhes em [RANKING.md](RANKING.md) e [android/README.md](android/README.md).
- Validação: 40/40 JS/SQLite; algoritmos Java com corrupção/cancelamento/limpeza; build/lint
  Android nas quatro ABIs; publish .NET; cada teste e MAX STRESS de 2 min no Chrome e Firefox,
  relatório, JSON, PDF e estilo de impressão. Mobile Android/iOS 375 px sem rolagem lateral.
  Android 16: MAX STRESS de 2 min, CPU/memória/disco sem erros, 256 MiB alocados fora do heap
  Java de 192 MiB, buffers e arquivo removidos. GPU emulada oscilou sob carga; não é referência
  de desempenho. Sensores e root ainda não conferidos em aparelho físico.
- Produção conferida: site e ranking dos quatro componentes respondem 200; corpo inválido
  recebe 400; APK e exe respondem 200; Chrome desktop/mobile sem erros JS. D1 teve recusa
  temporária 7403 no primeiro comando remoto, resolvida ao repetir a migração. Dump real
  exportado para backup; não reproduzir links temporários que o Wrangler possa imprimir.
- Backup em `G:/Meu Drive/Backups/Smells Like Tech - Stress Test/2026-10-23/`, com fontes,
  bundle Git, APK/exe/checksums, dump D1 e verificações. Hashes dos artefatos conferidos.
  Após autorização expressa do dono em 23/10/2026, chave e senha de assinatura foram
  copiadas de `.local/assinatura-android/` para `privado/assinatura-android/` nesse backup.
  Integridade dos dois arquivos conferida sem exibir valores. Continuam fora do Git,
  dos arquivos de fontes e da release; a autorização vale para essa pasta/data.

- 22/10/2026 — **No ar**: https://stresstest.smellsliketech.com.br (Cloudflare Workers com
  assets, Worker `slt-stress-test`, versão `f004a75c-7074-4c46-84e6-0b857f62c970`, custom
  domain criado pelo `wrangler deploy`; zona com NS Cloudflare, Registro.br sem mudança).
  Repositório público https://github.com/mikerock12/slt-stress-test, PR #1 com CI verde (site
  + plugin) e merge na `main`. Release v1.0.0 com `SLTStressTestPlugin.exe` (SHA-256
  904867e650bc90f5e2031e544915fdcf7e9c148f74d8c3da37ad6229d13d6535) e SHA256SUMS.txt.
  Backup em `G:/Meu Drive/Backups/Smells Like Tech - Stress Test/2026-10-22`.
- Conferido em produção: HTTPS 200, CSP com `connect-src http://127.0.0.1:5299`, workers com
  `text/javascript`, download do plugin pela release (61 MB), plugin aceita a origem de
  produção (CORS). O DNS do provedor desta máquina (45.165.84.10) guardou NXDOMAIN de uma
  consulta feita antes do deploy; o teste no Chrome do dono ficou para quando expirar.
- Verificado no Chrome 152 (Windows, Intel HD 530, 4 threads): `npm run check` 12/12; MAX
  STRESS de 2 min completo; CPU ~2,4 GFLOPS e clock estimado ~3,3 GHz; GPU ~5 FPS a 1080p e
  ~10 FPS a 720p; memória 1 GiB sem erros; disco ~430 MB/s leitura seq.; arquivo OPFS
  apagado no fim; layout mobile (375 px) sem rolagem lateral.
- Observações: a GPU só mede com a aba visível (o navegador pausa a animação). A Compute
  Pressure API existe no Chrome, mas não entregou leituras no painel do app; o cartão de
  pressão só aparece no relatório quando há leituras. Não testado ainda no Firefox/Safari.

- 22/10/2026 — **Plugin Windows** criado (`plugin/`), a pedido do dono, baixado pelo próprio
  site: bandeja + servidor em 127.0.0.1:5299, LibreHardwareMonitorLib 0.9.6. Entrega
  temperatura/clock/potência de CPU e GPU, frequência e pentes da memória (WMI), SMART via
  Windows (saúde, temperatura, horas, desgaste, erros) e benchmark de disco sem cache
  (SEQ1M Q8/Q1, RND4K Q32/Q1, com verificação). Exe único de ~61 MB, pede administrador.
  Testado nesta máquina (i5-6500, HD 530, Lexar 240 GB + WD Purple 1 TB): MAX STRESS de 2 min
  com plugin, disco real no D: (~110 MB/s seq., ~160 IOPS 4K), SMART "Bom" nos dois, arquivos
  temporários apagados, origem estranha recusada (403), POST sem cabeçalho recusado (400).
  Sem PawnIO aqui: temperatura da CPU ausente, clock pelo contador do Windows (~3,3 GHz).
  JS 17/17.
- Pendente de verificar em produção: o Chrome (Local Network Access) pede permissão quando um
  site https acessa 127.0.0.1; conferir o fluxo no domínio real.

- 22/10/2026 — Teste em produção no Chrome 156 do dono: o site abre (DNS liberado), mas o
  pedido ao plugin fica parado na permissão "acesso à rede local" (estado `prompt`) até a
  pessoa clicar em Permitir. Corrigido no PR #2 (deploy `0baa3cb3-3d2c-4b9f-a1c4-419b8730cf11`):
  com a permissão pendente o site espera até 60 s e mostra como permitir; se negada, como
  liberar. Aguardando o dono clicar em Permitir para concluir o teste ponta a ponta.
- 22/10/2026 — **Teste em produção concluído** no Chrome 156 do dono após "Permitir": plugin
  conectado (permissão `granted`), MAX STRESS de 2 min com disco real no D: (256 MiB), sem
  erros. CPU 3,49 GHz estimado × 3,30 GHz sensor; GPU 10 FPS a 720p com uso 100%; memória
  2133 MT/s; disco 113/126 MB/s leitura seq., ~160 IOPS 4K, 34 °C; SMART "Bom" nos dois
  discos; arquivo temporário apagado. Veredito "Aprovado com ressalvas" só por causa da
  Compute Pressure em "critical" 100% do tempo, o que é esperado sob carga total (ver
  próximo passo).
- 22/10/2026 — Corrigido (PR #3, CI verde, deploy `3d33c951-5899-4b36-9356-fb0c8d79b39f`):
  pressão crítica só pede atenção junto com queda da CPU >= 12%; sem queda, o relatório
  explica que é o esperado sob carga total. Conferido em produção no Chrome do dono com o
  módulo publicado: sem queda → "Aprovado: sistema estável"; com 33% de queda → "Aprovado com
  ressalvas". JS 19/19.

- 22/10/2026 — **Proteção de temperatura** (pedido do dono: "controle de temperatura da CPU
  e GPU no teste nativo"). Com o plugin conectado aparece o bloco de limites (padrão CPU
  95 °C, GPU 90 °C, faixa 60–105/60–100, salvo no navegador, pode desligar). Durante o teste,
  faixa ao vivo com a temperatura de CPU e GPU (verde/amarelo a 5 °C do limite/vermelho);
  aviso no registro perto do limite; acima do limite por 3 leituras seguidas, todos os testes
  param e o relatório mostra "Interrompido pela proteção de temperatura", o motivo no
  componente e as máximas. Vale mesmo se o componente quente não estava em teste. Sem PawnIO
  não há temperatura de CPU (a proteção avisa isso). Validado no navegador com leituras
  simuladas (CPU 68→82 °C, limite 75 °C: parou aos 79 °C em 6 s). JS 25/25.
- Corrigido junto: o site desistia do plugin quando a permissão de rede local aparecia como
  `denied`, mas página local (e navegadores embutidos) acessam 127.0.0.1 assim mesmo. Agora
  sempre tenta e só mostra o aviso de bloqueio se o pedido falhar.
- Publicado: PR #4 (CI verde), deploy `de85f02c-6c08-424a-aadf-cbdedda0eea1`. Em produção,
  conferido o caminho "rede local bloqueada" (navegador embutido do app, que nega a
  permissão): aviso correto. A conferência visual com o plugin no Chrome do dono ficou
  pendente porque a extensão Claude in Chrome desconectou.
- 22/10/2026 — Conferido em produção no Chrome do dono (plugin conectado, permissão
  `granted`, leituras de CPU simuladas, limite 75 °C): bloco de limites com aviso do PawnIO,
  faixa ao vivo (CPU vermelha no limite, GPU "sem leitura" na HD 530), parada aos 76–79 °C.
  A conferência achou incoerências no relatório, corrigidas no PR #5 (CI verde, deploy
  `5451b61e-ddff-488f-a840-9ca659e1d154`): sem "temperatura sob controle" quando houve
  parada; limite da pessoa vale no veredito quando é menor que o padrão; texto próprio do
  veredito; `.alerta` global. Reconferido em produção. Limite do dono restaurado para 95 °C.
  JS 26/26.

## Em andamento

- Codex, branch `codex/corrige-estabilidade-celulares`: corrigir encerramento travado
  em 01:59 no Galaxy A52, responsividade e proteção de carga em celulares (iPhone 11
  com queda de CPU/GPU nas imagens), e descoberta/identificação de sensores no POCO
  X7 PRO. Dono nesta tarefa de js/app.js, módulos de carga/proteção/relatório, Android,
  interface, testes e documentação. Sem outros agentes. Conferir bridge síncrona,
  encerramento nativo, tempo limite independente e fontes térmicas antes de alterar.
  Não inventar CPU/GPU a partir da bateria nem contornar permissões do fabricante.
  Entrega autorizada: commit/push/PR/CI/merge, produção e backup de 24/10/2026;
  autorização antiga de copiar chave/senha não se estende à nova pasta/data.
  Implementado: encerramento sem espera bloqueante na bridge; prazo/ausência de pulso
  vigiados nativamente; GPU com fence e referência assíncrona, um lote em voo; perfil
  inicial móvel menor com opções completas; proteção por queda persistente; estado térmico,
  bateria e fontes sem confundir CPU/GPU. Busca térmica/sysfs/hwmon ampliada. POCO e A52
  informados pelo dono como sem root; permissões variam por fabricante, sem garantia de
  sensor bloqueado. Versão preparada: APK 1.3.0/code 4, plugin permanece 1.2.0.
  Até aqui: 50 testes JS/SQLite, cargas/guarda/classificação Java, build/lint Android e
  assinatura/alinhamento 16 KB passaram. Chrome: cinco testes de 2 min, JSON/PDF/capturas.
  Firefox em conferência; corrigida exportação JSON com âncora anexada ao documento.
  Fixtures apenas locais: A52 quente dispara; POCO sem sensor mantém null; inicialização
  sem pronto termina no prazo; queda de desempenho móvel interrompe com texto correto.
  AVD Android 16 iniciado para conferir integração nativa; nenhum celular físico em ADB.
  Interrupção anterior por limite da revisão automática de aprovação; retomado após
  “Continue” do dono, sem contornar aprovação. Ainda faltam concluir QA, PR/CI/merge,
  publicação e backup de 24/10/2026. Artefatos em .local/verificacao/celulares-2026-10-24/.

## Conferência em aparelho físico pendente

- Conferir sensores de diferentes fabricantes, modo root opcional e fluxo de PDF/JSON no celular real. Os testes funcionais completos foram feitos em emulador Android 16.

## Ideias futuras (não aprovadas)

- Teste WebGPU compute como alternativa ao WebGL2.

## Histórico

- 23/10/2026 — PRs #7 e #8 integrados e publicados com CI verde; APK 1.2.1 em download
  direto, plugin 1.2.0 com PawnIO, licenças/fontes e controles de privacidade. Verificações
  e limites registrados no Estado atual. Backup final de fontes, Git, releases e D1
  na pasta de 23/10/2026 do Drive, com hashes conferidos.


- 23/10/2026 — README e seção Sobre do GitHub atualizados para refletir a entrega Android e
  ranking, com descrição em português, downloads e tópicos; alteração somente documental.
- 23/10/2026 — Backup privado da chave e senha Android concluído por autorização expressa
  do dono, em `2026-10-23/privado/assinatura-android/` na pasta de backup do Drive.
  Cópias conferidas por hash, sem exibir segredos; material permanece fora do Git e da release.
- 23/10/2026 — Android/APK e ranking D1 entregues no PR #6, merge `ac241d5`, CI verde nos três
  jobs, 40/40 testes JS/SQLite, cargas Java e MAX STRESS Android com memória NDK conferidos.
  Release v1.1.0, produção e backup no Drive atualizados. Sem dados sintéticos em produção.
- 22/10/2026 — Criação do projeto (AGENTS.md, contexto.md, site completo, testes Node).
