# SLT Stress Test — Plano Mestre de Evolução Técnica v1.4.0

> **Documento de execução multiagente** · Smells Like Tech Informática  
> **Data de elaboração:** 30/10/2026 · **Idioma obrigatório:** português do Brasil  
> **Repositório:** https://github.com/mikerock12/slt-stress-test  
> **Branch-base de referência:** `main` · **Versão observada:** site/APK 1.3.0; plugin Windows 1.2.0  
> **Estado:** PLANO — nenhuma alteração de código, build, publicação ou deploy foi realizada por este documento.  
> **Objetivo de entrega:** v1.4.0, condicionada à implementação, validação e aprovação do mantenedor.

---

## 0. COMO UM AGENTE DEVE USAR ESTE DOCUMENTO

Este documento funciona como especificação de trabalho, roteiro de execução, matriz de testes e contrato de entrega. Pode ser utilizado por **Codex, Claude, Gemini ou agentes humanos**, sem depender da conversa em que foi elaborado.

### 0.1. Ordem obrigatória de leitura

1. Ler `AGENTS.md`, `contexto.md`, `README.md`, `RANKING.md`, `android/README.md` e, se envolver Windows, `plugin/README.md` **na versão atual da `main`**.
2. Confirmar `git status`, branch, SHA atual, versão do APK e da API. Não assumir que os arquivos permanecem iguais aos observados em 30/10/2026.
3. Ler a seção **1. Diagnóstico confirmado** e confrontar cada achado com o código atual antes de alterar.
4. Escolher **uma tarefa identificada por ID** da seção 6; verificar dependências e reservar arquivos compartilhados em `contexto.md`.
5. Implementar apenas o escopo da tarefa, com testes automatizados e validação manual proporcional ao impacto.
6. Atualizar `contexto.md` **durante** a execução (em andamento, branch, arquivos, pendências) e depois registrar resultado, comandos executados, evidências e PR.
7. Não publicar nem modificar produção, release, banco remoto ou assinatura sem autorização explícita do mantenedor.

**Em caso de conflito:** seguir nesta ordem: instrução expressa e atual do mantenedor > regras de segurança e privacidade > `AGENTS.md` atualizado > documentação técnica atual do repositório > este plano. Divergências devem ser registradas antes de executar.

### 0.2. Regras do proprietário já existentes em `AGENTS.md`

- Todos os textos, commits, PRs e mensagens em **pt-BR**.
- Não inserir `Co-Authored-By` nem mensagens como `Generated with...`.
- Não exibir, mover, versionar, divulgar nem copiar chaves de assinatura Android, tokens, credenciais ou segredos.
- Código via branch de trabalho → PR → CI verde → merge; documentação isolada pode seguir a política atual do repositório.
- Não falsificar dados de sensores. Se o SO não fornece a medição, registrar **`não disponível`**, origem do dado e limitação.
- Não modificar política de consentimento, permissões, firewall, autenticação ou retenção sem avaliação explícita e testes.
- Não instalar o driver PawnIO, solicitar privilégios extras, habilitar root nem contornar recusas de UAC automaticamente.
- Nunca rodar benchmarks reais com cargas perigosas ou extensas em máquina de cliente sem consentimento e mecanismos de interrupção.

### 0.3. Entregável esperado de cada tarefa

Uma tarefa somente termina se entregar: (a) código versionado, (b) testes verificáveis, (c) instruções de reprodução, (d) resultado nos ambientes acessíveis, (e) atualização documental e (f) PR revisável. A ausência de dispositivo físico deve constar como **validação pendente**, jamais como validação presumida.

---

## 1. CONTEXTO, ARQUITETURA E DIAGNÓSTICO CONFIRMADO

### 1.1. Visão do produto

O SLT Stress Test permite rodar testes de **CPU, GPU, memória e disco** isolados ou combinados, produzir relatório HTML/PDF/JSON e oferecer comparação comunitária opcional. Seus ambientes têm capacidades diferentes:

| Plataforma | Motor principal | Restrições essenciais |
|---|---|---|
| Navegador PC/celular | JavaScript, Web Workers, WebGL2, OPFS | Sensores e I/O físico dependem de APIs e permissões; métricas não são equivalentes às nativas. |
| Android APK | CPU Java, RAM C++/NDK, armazenamento Java, GPU WebGL2 | Termômetros/clocks podem ser bloqueados; RAM e arquivos privados são apenas subconjuntos do hardware. |
| Windows + plugin | Site + plugin .NET, sensores, SMART, benchmark de disco | Plugin deve ficar restrito a `127.0.0.1`, com origens autorizadas; não ampliar acesso silenciosamente. |
| Cloudflare Workers + D1 | API, consentimento, comparação e ranking | Não misturar motores/metodologias nem publicar novos campos sem revisão de privacidade. |

### 1.2. Mapa real de arquivos relevantes

```text
slt-stress-test/
├── AGENTS.md                     # regras para agentes
├── contexto.md                   # histórico, andamento e coordenação
├── README.md / RANKING.md        # produto, metodologia e ranking
├── index.html                    # configuração, painéis e relatório
├── css/style.css                 # interface e responsividade
├── js/
│   ├── app.js                    # orquestrador; parâmetros; timer; amostras 1 s
│   ├── android.js                # ponte JS ↔ APK
│   ├── avaliacao.js              # métricas; status por componente; resultado geral
│   ├── benchmark.js              # contrato de dados e agrupamento do ranking
│   ├── metricas.js               # estatística das séries
│   ├── ranking.js                # pacote de benchmark, comparação e UI
│   ├── relatorio.js              # análise; HTML/PDF/JSON
│   ├── seguranca-movel.js         # proteção por queda; limpeza com prazo
│   ├── protecao.js               # limites térmicos
│   ├── sistema.js / dispositivo.js / plugin.js
│   ├── testes/
│   │   ├── cpu.js / gpu.js / memoria.js / disco.js
│   │   ├── disco-plugin.js / pressao.js
│   └── workers/
│       ├── cpu.worker.js / memoria.worker.js / disco.worker.js
├── android/
│   ├── README.md
│   └── app/
│       ├── build.gradle
│       └── src/main/
│           ├── java/br/com/smellsliketech/stresstest/
│           │   ├── Cargas.java
│           │   ├── PonteAndroid.java
│           │   ├── MemoriaNativa.java
│           │   ├── ColetaHardware.java
│           │   ├── SensoresTermicos.java
│           │   ├── GuardaExecucao.java
│           │   ├── LeituraAvancada.java
│           │   └── MainActivity.java
│           └── cpp/memoria.cpp
├── plugin/SLTStressTest.Plugin/  # motor e sensores do Windows
├── worker/index.js               # validação/API/ranking/consultas
├── worker/privacidade.js
├── migrations/0001_benchmarks.sql / 0002_privacidade.sql
├── tests/*.test.mjs              # testes JS/SQLite
├── scripts/testar-cargas-android.mjs
├── scripts/montar-site.mjs / publicar-android.ps1
└── .github/workflows/ci.yml
```

### 1.3. Evidência de campo: relatório do POCO X7 Pro

Relatório gerado **30/10/2026, 13:17:27**, no dispositivo `Xiaomi 2412DPC0AG`, Android 16, SoC `MT6899`, GPU `Mali-G720 MC7`:

- Modo `MAX STRESS`, duração **2 minutos**, com CPU **4 threads**, GPU **640×360 / 64 passos**, RAM **256 MiB**, armazenamento **arquivo de 256 MiB**.
- CPU: FFT média **2,90 GFLOPS**; Lucas–Lehmer **13.568 iterações/s** com **CV 38,5%**; zero erros detectados.
- GPU: **1.904,2 “FPS”**; CV da métrica gráfica ~**6,8%**; zero divergências de referência detectadas.
- RAM: banda de cópia **20,7 GB/s**, volume acumulado verificado **139,9 GB**, zero erros na área alocada.
- Armazenamento: leitura sequencial **793 MB/s**; leitura aleatória 4 KiB **490,1 MB/s** (~119.657 IOPS); escrita aleatória **10,1 MB/s**; zero divergências de verificação.
- Bateria no momento da leitura: **37,3 °C**, não equivalente a temperatura da CPU ou GPU.
- Resultado global atual: **“Aprovado: sistema estável”**; sem grupo comunitário equivalente suficiente.

**Interpretação obrigatória:** este relatório é um **fixture histórico de investigação**, não padrão de desempenho, não prova de ausência de defeito e não atesta benchmarking físico sem cache. A v1.4.0 deve explicar claramente o escopo e a qualidade de cada medição.

### 1.4. Defeitos e limitações observados na implementação (não presumidos)

| ID | Local | Evidência no código observado | Risco | Direção de solução |
|---|---|---|---|---|
| D-01 | `js/testes/gpu.js`, `amostra()` | `fps = passadas / seg`; `frameMs = 1000 / fps`. As passadas são unidades de trabalho, não frames reais exibidos. | Relatório superinterpreta “FPS” e “tempo por quadro”. | Renomear para trabalho/seg e medir separadamente lotes, RAF e, se possível, tempo GPU. |
| D-02 | `js/benchmark.js`, `PRINCIPAL_RANKING` | Ranking GPU usa `fps` como principal; `VERSAO_BENCHMARK = 1`. | Resultados antigos e novos podem ficar incompatíveis. | Protocolo/motor novos, grupos isolados, teste de migração. |
| D-03 | `js/avaliacao.js`, `vereditoGeral` | Qualquer `ok` pode gerar aprovação geral mesmo se outros componentes forem `na`; `avaliar()` conta a maior quantidade de amostras de qualquer métrica. | Aprovação parcial com dados insuficientes. | Elegibilidade por componente, duração/cobertura, estados separados para falhas e inconclusões. |
| D-04 | `js/metricas.js` | `resumir()` usa CV e janela de 20% por número de amostras; aquecimento de 5% por contagem. | Jitter, lacunas e mudanças durante o teste são pouco representados. | Timestamp monotônico, janelas temporais, percentis e detecção de declínio sustentado. |
| D-05 | `PonteAndroid.java` | Executor de carga criado com `THREAD_PRIORITY_BACKGROUND`. | Pode limitar/alterar o throughput sob teste. | Usar prioridade apropriada à tarefa em foreground; medir antes/depois e preservar proteções. |
| D-06 | `Cargas.java` (CPU) | Threads alternam FFT e Lucas–Lehmer; expoentes Lucas–Lehmer variam entre 3217, 4253, 4423, 9689, 9941 e 11213. | `llps` não é comparável entre janelas que usam custos matemáticos distintos. | Workload fixo e versionado, ou métrica normalizada por unidades de trabalho, ou excluir `llps` como indicador de estabilidade. |
| D-07 | `Cargas.java` (disco) | Leitura por `FileChannel` de arquivo pequeno e potencialmente cacheado; `ch.force(true)` a cada escrita. | Velocidades não representam necessariamente flash físico; escrita inclui custo de sincronização. | Modos cacheado/sincronizado/sem cache quando possível, amostras rotuladas, QD controlada. |
| D-08 | `Cargas.java` + `memoria.cpp` | RAM acessada só na alocação privada e teste de latência usa índices pseudoaleatórios sem dependência de dados. | Cobertura limitada e “latência” não equivale a latência de DRAM independente do cache. | Documentar cobertura; latência por ponteiros encadeados com prevenção de otimização. |
| D-09 | `js/app.js` | No celular, padrão 4 threads (quando 8 disponíveis), GPU leve/360p, RAM/disco 256 MiB e 2 min. | Configuração de segurança pode parecer teste máximo de hardware. | Perfis claramente descritos e critérios distintos para estresse rápido/sustentado. |
| D-10 | `js/testes/gpu.js` | Artefatos verificados por comparação com **primeiro frame de referência do mesmo dispositivo**. | Zero divergências significa autoconsistência no escopo testado, não correção absoluta da GPU. | Relatório com linguagem correta, limiar de tolerância e testes positivos de detecção. |
| D-11 | `ColetaHardware.java` | `cpuClockMHz` é média simples das frequências dos núcleos acessíveis. | Pode ocultar clusters heterogêneos ou núcleos não legíveis. | Série por núcleo/cluster, médias contextualizadas e nulos explícitos. |
| D-12 | `js/ranking.js`/`worker/index.js` | Elegibilidade depende de `concluido`, duração >=115 s, 10 amostras, zero erros, modelo identificado. | Amostras inconsistentes/insuficientes ou carga distinta podem entrar no ranking. | Elegibilidade ampliada com qualidade de medição e validação do perfil. |

**Classificação de certeza:** D-01 a D-12 são observações de implementação + consequências plausíveis; não são alegações de falha física do aparelho. Efeitos reais sobre desempenho devem ser confirmados por testes controlados.

---

## 2. OBJETIVOS, NÃO OBJETIVOS E REQUISITOS

### 2.1. Objetivos verificáveis

1. Cada métrica precisa indicar **o que mede, unidade, origem, carga e método**.
2. O resultado deve discriminar **erro de hardware detectado**, **erro da própria ferramenta**, **carga concluída**, **carga interrompida** e **insuficiência de dados**.
3. Comparações só ocorrerão entre **mesmo motor, versão metodológica, perfil e hardware suficientemente equivalente**.
4. A detecção de perda de desempenho deverá mostrar tempo, percentuais e possível causa; jamais inferir temperatura sem sensor.
5. Android deve coletar dados nativos com menor interferência possível, mantendo ciclo de vida, proteção térmica, limite de memória, watchdog e limpeza.
6. Benchmark de armazenamento deve explicitar se é **cacheável, sincronizado, direto ou indeterminado**; não usar “sem cache” sem confirmação técnica.
7. Teste de RAM deve informar **alocação física acessível ao processo** e **volume acumulado verificado** separadamente.
8. Site, APK, plugin e API devem permanecer operacionais durante a migração, sem misturar dados antigos.
9. Testes unitários/integração, validação manual e relatórios reproduzíveis devem acompanhar toda mudança.

### 2.2. Fora do escopo obrigatório da v1.4.0

- Criar hardware diagnóstico certificado ou substituir MemTest86/Prime95/FurMark/CrystalDiskMark.
- Prometer identificação absoluta de defeitos ou avaliação de 100% da RAM em Android.
- Exigir root, alterar kernel, desbloquear bootloader, instalar drivers adicionais no Android.
- Alterar plugin Windows sem necessidade técnica demonstrada.
- Refazer totalmente layout, identidade visual, site ou infraestrutura do banco.
- Introduzir métricas sintéticas sem definição e método reproduzível.
- Distribuir novos binários ou promover deploy automático a partir deste plano.

### 2.3. Requisitos não funcionais

- **Segurança:** temperatura e proteções com prioridade sobre benchmark; abortar antes de memória crítica, espaço insuficiente, armazenamento cheio, estado térmico grave ou perda de primeiro plano.
- **Desempenho da ferramenta:** UI responsiva, progressos não bloqueantes e encerramento previsível; medições isoladas do trabalho de renderização de interface sempre que viável.
- **Privacidade:** consentimento opt-in; sem novos identificadores persistentes sem análise; não enviar caminhos, números de série, endereços, logs livres ou dados sensíveis ao ranking.
- **Compatibilidade:** manter browser sem APK, APK Android 8+, Windows plugin 1.2.0, nas restrições já documentadas.
- **Auditabilidade:** incluir commit, build, motor, versão de metodologia, runtime, parâmetros, motivos de exclusão e flags de qualidade no JSON local.
- **Offline:** testes locais e relatório no APK devem continuar possíveis sem conexão.

---

## 3. ARQUITETURA ALVO

```text
[HTML/CSS]  Seleção de perfil, consentimento e monitoramento
    │
    ▼
[js/app.js]  Orquestrador + state machine explícita
    │  {perfil, componentes, parâmetros, duração, limites, fontes}
    ├── Navegador → JS Workers (CPU/RAM/OPFS) + WebGL2 (GPU)
    ├── Android → [js/android.js] → WebView Bridge → PonteAndroid.java
    │                                     ├── Cargas.java (CPU/disco)
    │                                     ├── memoria.cpp (NDK)
    │                                     ├── ColetaHardware/SensoresTermicos
    │                                     └── watchdog + proteção + limpeza
    └── Windows → [js/plugin.js] → Plugin local .NET (sensores/I-O)
                    │
                    ▼
            [Medidas canônicas versionadas]
                    │
             [js/metricas.js]
                    │  janelas/percentis/queda/cobertura
             [js/avaliacao.js]
                    │  status de execução + status técnico
           ┌────────┴───────────┐
           ▼                    ▼
   [js/relatorio.js]       [js/benchmark.js + ranking.js]
    HTML/PDF/JSON                       │ somente após opt-in
                                       ▼
                            [Cloudflare Worker + D1]
                            schema v1 isolado de v2
```

### 3.1. Máquina de estados recomendada

Estados por componente: `nao_iniciado`, `preparando`, `aquecendo`, `executando`, `finalizando`, `concluido`, `interrompido_usuario`, `interrompido_protecao`, `falha_motor`, `erro_verificacao`, `sem_dados`. O estado global deriva dos componentes selecionados e da conclusão do prazo; sensores auxiliares sem dados **não** equivalem a componente reprovado.

### 3.2. Contrato mínimo de uma amostra v2

```js
{
  tMs: 15342,                   // tempo MONOTÔNICO relativo ao início; nunca relógio de parede
  componente: 'gpu',           // cpu | gpu | memoria | disco
  motor: 'webgl2-fence-v3',
  metrica: 'passadasPorSegundo',
  valor: 1904.2,
  unidade: 'passadas/s',
  origem: 'gpu-webgl2',
  flags: ['trabalho-equivalente', 'gpu-timing-indisponivel'],
  valido: true
}
```

**Decisão de arquitetura:** preservar temporariamente o formato legado `{ metrica: [valores] }` onde necessário, mas armazenar tempo e indicadores de validade em estrutura paralela `medicoesV2`. Criar adaptador explícito para relatório e API. Não mudar todos os componentes e endpoints num único commit.

### 3.3. Separar dois eixos de veredito

- `execucao`: `concluida` | `incompleta` | `interrompida` | `falha_motor`.
- `diagnostico`: `sem_erros_detectados` | `atencao_desempenho` | `erros_verificados` | `inconclusivo`.
- `confiabilidadeMedicao`: `alta_relativa` | `moderada` | `baixa` | `indisponivel` (**não é certificado de precisão metrológica**).

**Exemplos:** “2 minutos concluídos; nenhum erro encontrado na RAM alocada; não cobre toda a RAM”; “GPU estável em passadas/s; tempo GPU indisponível”; “disco cacheável; não comparar com I/O direto”.

---

## 4. METODOLOGIA DE BENCHMARKS v2

### 4.1. CPU

**Estado atual:** FFT 4096 ida/volta com conferência; Lucas–Lehmer com resultados conhecidos; threads Android dedicadas e configuráveis; sincronização periódica das métricas. O cálculo `GFLOPS` é estimado a partir da contagem teórica de operações da FFT, não de um contador físico de FLOPs.

**Alvo:**

1. Separar **CPU desempenho (single-thread)**, **CPU desempenho multi-thread** e **CPU stress sustentado**.
2. Padronizar carga, tamanho da FFT, tamanho do lote, critério de validação e custo lógico; documentar a fórmula de FLOP estimado.
3. Não usar `llps` bruto com expoentes variáveis para concluir estabilidade. Escolher expoente fixo por subteste ou publicar `llps` por expoente/etapa e utilizar a FFT padronizada como referência de estabilidade.
4. Iniciar threads com prioridade padrão apropriada ao app em primeiro plano; registrar `threadsSolicitadas`, `threadsAtivas`, contagem de núcleos e, quando legível, clocks por cluster.
5. Guardar desempenho por janela temporal (ex.: 5 s) e registrar ocupação observável; não presumir uso de CPU em 100% sem sensor.
6. Não atribuir automaticamente queda ao calor; considerar energia, escalonador, disputa de recursos e estado térmico.
7. Validar os testes de Lucas–Lehmer com expoentes e respostas conhecidos e injetar corrupção para verificar detecção.

**Atenção:** não fixar afinidade de CPU em Android indiscriminadamente. Big.LITTLE/DVFS são relevantes; permitir execução natural e informar as limitações.

### 4.2. GPU

**Estado atual confirmado:** `passadas/segundo` é rotulado `fps`; `frameMs=1000/fps`; fence GL garante término de lote; número de passadas é adaptativo; referências visuais comparadas no próprio dispositivo.

**Novas métricas e nomes:**

| Chave v2 | Unidade | Definição |
|---|---|---|
| `passadasPorSegundo` | passadas/s | Quantidade de execuções da cena concluídas por segundo; principal do ranking WebGL2 novo. |
| `lotesConcluidosPorSegundo` | lotes/s | Quantos lotes de renderização chegaram ao estado concluído; **não** prometer ser taxa de apresentação ao display. |
| `rafPorSegundo` | callbacks/s | Frequência observada de `requestAnimationFrame`, identificada como ritmo de UI, não renderização física. |
| `tempoGpuMs` | ms | Tempo efetivo de GPU medido por timer query quando extensão suportada e resultado confiável. |
| `tempoParedeLoteMs` | ms | Tempo decorrido de parede entre início e conclusão observada do lote; inclui espera/escalonamento. |
| `mpixPorSegundo` | Mpix/s | Pixel-shading equivalente; fórmula explícita e invariável para o perfil. |
| `divergenciasReferencia` | contagem | Divergências superiores ao limiar entre imagens fixas no **mesmo** ambiente de referência. |

**Passos:**

1. Atualizar `js/testes/gpu.js` para renomear a saída atual sem alterar inicialmente a carga do shader.
2. Coletar métricas de RAF, lotes concluídos e passadas concluídas como séries distintas.
3. Tentar `EXT_disjoint_timer_query_webgl2`; tratar extensão ausente, indisponibilidade, `GPU_DISJOINT_EXT`, queries pendentes e resultado inválido sem bloquear a UI.
4. Guardar tempo medido da GPU apenas quando a query disser que o resultado está disponível e não houve disjoint. Consultar as capacidades antes de criar queries.
5. Evitar múltiplos lotes simultâneos; manter `fenceSync`, timeout, proteção contra `webglcontextlost` e parada.
6. Testar cenas e resoluções fixas: 360p leve, 720p normal, 1080p pesado (somente se viável); quando há ajuste adaptativo de passadas, registrar essa variável em cada intervalo.
7. Validar o frame de referência com tolerância explícita; em vez de chamar qualquer diferença de “defeito GPU”, informar “divergência na autoconsistência visual”, com causa indeterminada.
8. Atualizar `METRICAS`, painel, relatório, exportação, ranking e testes juntos.

**Proibição importante:** não chamar `lotesConcluidosPorSegundo` de FPS real de tela. Um `blitFramebuffer` concluído não é prova de apresentação no display. Não calcular “tempo de um frame da GPU” como `1000/passadasPorSegundo`.

### 4.3. Memória RAM

1. Preservar alocação NDK fora do heap e liberação explícita; controlar OOM antes e durante o teste.
2. Informar RAM total do Android, RAM disponível no início, bytes solicitados, bytes alocados, bytes efetivamente verificados e passadas completas.
3. Expandir padrões: zeros, uns, alternado, endereço, pseudoaleatório com semente fixa/versionada, walking 1/0, cópia + verificação. Não depender de apenas um padrão para aprovar.
4. Testar múltiplos blocos/endereços e percorrer regiões de forma versionada; registrar quantos blocos realmente tiveram todas as etapas concluídas.
5. Para latência, acrescentar **pointer chasing com dependência real** entre acessos, buffers de tamanho suficiente para explorar além do cache, proteção antiotimização e benchmark dedicado. Não rotular latência de loop pseudoaleatório como DRAM medida fisicamente.
6. Separar `bandwidthRead`, `bandwidthWrite`, `bandwidthCopy` de latência; também separar resultado isolado do resultado de MAX STRESS.
7. Interrupção imediata via controle atômico no C++; não eliminar verificações de cancelamento para ganhar desempenho.
8. Respeitar limite conservador: `min(memória disponível/3, solicitado, teto seguro por dispositivo)`. Documentar ajuste real; não tentar alocar a RAM inteira.
9. Testar alocação parcial, dados corrompidos, cancelamento, múltiplas execuções e liberação JNI sem double-free.

### 4.4. Armazenamento

**Problema atual:** caminho Java com `FileChannel`, arquivo temporário pequeno, leitura possivelmente cacheada; cada operação de escrita usa `force(true)`, inclusive blocos 4 KiB.

Criar **três perfis de semântica**, separados no ranking:

- `java_cacheavel_seq_rnd_v2`: arquivos privados, cache do SO permitido, sem alegar velocidade física do flash.
- `java_fsync_v2`: escrita explicitamente sincronizada; latência/throughput com `force` **incluído**, rotulado como operação durável do ponto de vista da API (sem garantia de comportamento interno do controlador).
- `native_direct_v1` (opcional e condicionado a protótipo): `O_DIRECT` via NDK somente quando sistema de arquivos/dispositivo/alinhamento suportarem; fallback explícito para modo cacheável, nunca silencioso.

**Requisitos de execução:**

1. Separar fase de preparação do arquivo, warm-up, leitura, escrita e verificação. Não misturar bytes de preparação ao score.
2. Fazer cada fase retornar `bytesCompletos`, `operacoesCompletas`, `tempoNs`, `IOPS`, `MB/s`, `erroVerificacao`, `modoCache`, `sincronizacao`, `tamanhoArquivo`, `tamanhoBloco`, `qd`, `semente`.
3. QD=1 quando não houver múltiplas operações realmente simultâneas; não rotular QD8/QD32 sem submissão/conclusão concorrente.
4. Para 4 KiB, contar **operações completas**, não apenas bytes planejados. Nunca somar uma operação abortada/incompleta.
5. Aumentar tamanho de arquivo apenas conforme espaço livre e consentimento; manter reserva de segurança. Preferir testes progressivos em vez de ocupar muitos GB no celular.
6. Para escritas, apresentar cacheável e sincronizada em linhas independentes. Não adicionar `force` ao teste rotulado como simples escrita bufferizada.
7. `FileChannel`/fsync não garantem desativação do cache de leitura. Se `O_DIRECT` não estiver disponível, marcar `cache=possivel`.
8. Garantir exclusão do arquivo de teste em `finally` e no próximo startup, sem apagar arquivos estranhos. Usar nome único por execução para evitar colisão; validar diretório privado.
9. Medir temperatura térmica se disponível, mas nunca inventar temperatura NAND/UFS. Não apresentar SMART ausente como “saudável”.
10. Reduzir carga de escrita desnecessária: aviso de desgaste e limites seguros em perfis longos.

### 4.5. Temperatura, energia e clocks

- Coletar `PowerManager.getCurrentThermalStatus` e `getThermalHeadroom` quando disponíveis; preservar significado próprio de cada um.
- Temperatura da bateria = **bateria**, nunca CPU/GPU; clocks por núcleo do `/sys/.../cpufreq` podem ser parciais.
- Expor séries por núcleo/cluster e campos separados para valor médio dos núcleos acessíveis; não representar média como frequência de todo o SoC.
- Mostrar percentual de amostras válidas, fontes de cada sensor, timestamp e motivo de indisponibilidade.
- Proteções devem agir **mesmo se** o sensor da CPU/GPU não estiver disponível: status térmico Android, bateria, interrupção do foreground, queda persistente e watchdog continuam ativos.
- Limites térmicos específicos por hardware não podem ser generalizados; valores sugeridos são guardrails iniciais, não prova de dano ou throttling.

---

## 5. PERFIS DO USUÁRIO E REGRAS DE VALIDADE

| Perfil | Duração inicial | CPU | GPU | RAM | Disco | Resultado máximo permitido |
|---|---:|---|---|---|---|---|
| **Rápido** | 120 s | Moderada, configuração explícita | 360p / leve | 256 MiB | 256 MiB cacheável | “Triagem preliminar”; não atesta desempenho sustentado. |
| **Completo** | 900 s | Threads selecionadas (recomendar todas) | 720p / normal, quando suportado | 512 MiB–1 GiB conforme disponibilidade | tamanho progressivo seguro | “Estabilidade sustentada na configuração”; sempre informar cobertura. |
| **Extremo** | 1800 s | Todas as threads disponíveis | carga escalonada com cap | até limite conservador | limitado por desgaste/espaco | “Estresse prolongado”; requer aviso e interrupções. |

**Os valores são propostas, não defaults implementados.** Em aparelhos com pouco recurso, oferecer perfil reduzido/indisponível em vez de mudar configuração silenciosamente. No modo MAX STRESS, CPU, GPU, RAM e disco disputam recursos; benchmarks isolados e combinados devem ficar em grupos diferentes.

### 5.1. Política de duração e cobertura

- Marcar configuração solicitada e configuração efetivamente executada; qualquer diferença precisa constar no relatório.
- `concluido` exige todos os componentes selecionados encerrados normalmente, dentro de duração de tolerância documentada e com cobertura suficiente.
- Componentes podem ser `sem_dados` se não houver métricas centrais, mesmo que existam sensores ou contadores de erros zerados.
- Definir um **mínimo por perfil**, não um limiar universal de 10 amostras. Exemplo a validar: Rápido >=100 s úteis e >=80% de janelas esperadas; Completo/Extremo >=90% da duração escolhida e cobertura >=80%. Ajustar com experimentos e testes; números provisórios não são padrão de certificação.
- Amostras contaminadas por pausa, aba oculta, suspend/resume, foreground perdido, shader compilando ou falta de dados entram com `valido=false` e **não** na média principal.
- Pré-aquecimento removido por **tempo real**, e não apenas pelo índice da amostra.

---

## 6. BACKLOG DE IMPLEMENTAÇÃO: TAREFAS EXECUTÁVEIS

### FASE 0 — BASELINE E ISOLAMENTO (sem mudanças funcionais)

#### T00 — Preparar ambiente e evidências

**Dependências:** nenhuma.  
**Arquivos:** `AGENTS.md`, `contexto.md`, `README.md`, `RANKING.md`; eventualmente `docs/` novo.  
**Passos:**

1. `git fetch --all`; registrar `git status --short`, `git rev-parse HEAD`, branch e versões.
2. `npm run check`, `npm run build` e `node scripts/testar-cargas-android.mjs` (com JDK 17+); registrar saídas, falhas pré-existentes e ambiente.
3. Confirmar disponibilidade de SDK/NDK/Gradle para `cd android && ./gradlew assembleDebug lintDebug` (Windows: `gradlew.bat`).
4. Salvar fixtures **locais** do JSON exportado da v1.3.0, sem subir contribuições sintéticas ao ranking de produção.
5. Atualizar `contexto.md` com baseline, dono da tarefa e branch.

**Aceite:** estado inicial reproduzível, sem alteração de comportamento e sem vazamento de dados.

### FASE 1 — EXATIDÃO DE MÉTRICAS E STATUS

#### T01 — Renomear GPU e distinguir tipos de medição [CRÍTICA]

**Dependências:** T00.  
**Arquivos:** `js/testes/gpu.js`, `js/avaliacao.js`, `js/relatorio.js`, `js/app.js`, `tests/`.

1. Introduzir chaves v2 `passadasPorSegundo`, `lotesConcluidosPorSegundo`, `rafPorSegundo`, `tempoParedeLoteMs`; manter adaptador de leitura de JSON legado.
2. Trocar texto “FPS” por descrição fiel. Preservar `fps` v1 somente nos relatórios históricos.
3. Medir separadamente intervalos RAF, início/conclusão de lotes e número de passadas reais.
4. Implementar timer query condicional (`EXT_disjoint_timer_query_webgl2`), com tratamento de disjoint/timeout/context loss sem bloqueio.
5. Registrar `passadasPorLote`, resolução, passos do shader, renderer e método de cálculo.
6. Reescrever testes de unidade e de integração visual; confirmar que `tempoGpuMs` não aparece quando ausente.

**Aceite:** relatório não afirma 1.904 “FPS reais”; passadas, lotes e timing apresentam unidades corretas; UI mantém responsividade; WebGL2 sem extensão funciona.

#### T02 — Veredito com validade por componente [CRÍTICA]

**Dependências:** T00 (pode ser paralela a T01, mas reservar `avaliacao.js`).  
**Arquivos:** `js/avaliacao.js`, `js/relatorio.js`, `tests/avaliacao.test.mjs`.

1. Criar predicado `medicaoSuficiente(componente, resumo, execucao, perfil)` com **métrica principal válida, cobertura, tempo útil e erros observados**.
2. Tratar `sem_dados`, `erro_motor`, `abortado_por_protecao`, `concluido_sem_erros`, `atencao_de_desempenho`, `erro_verificado` separadamente.
3. Não exigir sensores auxiliares para aprovar um componente cujo teste principal foi válido.
4. Não declarar aprovação global se um componente selecionado não foi concluído ou não tem medições suficientes.
5. Preservar regra: erro de cálculo/verificação confirmado reprova a carga correspondente; falha de alocação, timeout ou contexto perdido não prova defeito físico.
6. Adicionar mensagens de escopo/limitação por plataforma.

**Aceite:** todos os casos da matriz de estados (seção 8) passam; zero falsos “Aprovado” para execução incompleta.

#### T03 — Estatística temporal e qualidade das amostras

**Dependências:** T00, contrato de T02 estabilizado.  
**Arquivos:** `js/metricas.js`, `js/app.js`, `js/relatorio.js`, `tests/metricas.test.mjs`.

1. Acrescentar tempo monotônico por amostra sem mudar a interface pública abruptamente.
2. Implementar média, mediana, mínimo, máximo, desvio, CV, P5/P50/P95, cobertura, tempo útil, taxa de queda sustentada.
3. Calcular janelas por **segundos**, não por quantidade de pontos; detectar intervalo irregular e gaps.
4. Separar `quedaInicioFimPct`, `quedaPicoSustentadaPct` e `regressoesIntermediarias`.
5. Devolver `null/indisponível` quando n ou cobertura não sustentam uma métrica; jamais converter falta de dados em 0.
6. Não marcar jitter como falha de hardware sem erro verificado.

**Aceite:** séries constantes, aquecimento, queda tardia, recuperação, lacunas e amostras inválidas produzem resumos coerentes e testes determinísticos.

### FASE 2 — CARGAS NATIVAS ANDROID

#### T04 — Prioridade, escalonamento e CPU padronizada

**Dependências:** T00; idealmente T03.  
**Arquivos:** `PonteAndroid.java`, `Cargas.java`, `ColetaHardware.java`, `scripts/testar-cargas-android.mjs`, `android/README.md`.

1. Criar executor de carga com prioridade adequada de execução foreground (considerar `THREAD_PRIORITY_DEFAULT`) e separar executor de observabilidade/guarda.
2. Garantir que mudar prioridade não atrapalhe watchdog, coleta de sensores, cancelamento e responsividade WebView.
3. Versionar workloads FFT/LL; registrar `fftN`, iterações, expoente ativo, número de threads e núcleo/cluster observado quando disponível.
4. Corrigir `llps` para custo constante/normalizado ou retirá-lo como base de avaliação de estabilidade.
5. Rodar ensaios isolados com 1, metade e todas as threads em hardware acessível; comparar com baseline sem impor “melhoria obrigatória” em resultado bruto.
6. Preservar checagem de resultado e injeção de erro em ambiente de teste.

**Aceite:** nenhum thread nativo recebe prioridade de background indevida em teste foreground; números têm carga padronizada e a parada continua segura.

#### T05 — RAM NDK: cobertura, latência e cancelamento

**Dependências:** T00, interfaces T03.  
**Arquivos:** `memoria.cpp`, `MemoriaNativa.java`, `Cargas.java`, `scripts/testar-cargas-android.mjs`, `android/README.md`.

1. Separar contadores: `mibSolicitados`, `mibAlocados`, `mibCompletamenteVerificados`, `bytesAcumulados`, `rodadasCompletas`.
2. Implementar padrões adicionais selecionados e trilha da cobertura de endereço/bloco.
3. Criar subteste independente de pointer-chasing com tamanho de trabalho configurável, dependência verdadeira, semente reproduzível e sumidouro de otimização.
4. Reutilizar buffers alocados com controle de tamanho e verificar antes de liberar; nunca liberar buffer ainda em uso.
5. Simular alocação parcial/falha e cancelamento em cada fase, verificando liberação completa.
6. Não alterar limite conservador de memória sem ensaio e revisão de proteção OOM.

**Aceite:** leitura, escrita, cópia, latência e cobertura são descritas separadamente; zero leak/double-free nos ensaios; cancelamento responsivo.

#### T06 — Disco Android: semântica de cache e escrita

**Dependências:** T00; contrato de T03.  
**Arquivos:** `Cargas.java`, nova implementação `android/app/src/main/cpp/disco.cpp` **se viável**, CMake/JNI, `android/README.md`.

1. Refatorar a função `disco()` em fases e modos explicitamente versionados.
2. Separar throughput de escrita cacheável de escrita sincronizada; não `force(true)` por operação no modo cacheável.
3. Medir `bytesCompletos/tempoNs` e `operacoesCompletas/tempoNs` com operações verificadas.
4. Experimentar `O_DIRECT` apenas em branch/protótipo isolado, testando alinhamento, suporte e resultados; não tornar obrigatório se hardware/FS não permitir.
5. Implementar fallback rotulado, controles de espaço livre, cota de escrita e limpeza de temporários.
6. Validar 1 MiB SEQ Q1, 4 KiB RND Q1; não anunciar Q8/Q32 sem concorrência verdadeira.
7. Tratar `ENOSPC`, I/O lento, cancelamento, processo encerrado e recuperação no próximo lançamento.

**Aceite:** resultados rotulados por política de cache e sync; arquivos temporários removidos; zero risco de escrita fora de diretório próprio; resultados não confundem cache com UFS física.

#### T07 — Telemetria térmica e clocks

**Dependências:** T00; pode acompanhar T04–T06 com propriedade exclusiva de `ColetaHardware.java`.  
**Arquivos:** `ColetaHardware.java`, `SensoresTermicos.java`, `PonteAndroid.java`, `js/android.js`, `js/relatorio.js`.

1. Preservar sensores e fontes já utilizados, normalizar timestamp e qualidade das leituras.
2. Coletar clocks por núcleo; reportar mínimo, máximo e média apenas dos núcleos efetivamente legíveis.
3. Não prometer que todas as APIs ou arquivos sysfs serão acessíveis em Android sem root.
4. Publicar estados térmicos, bateria e disponibilidade separadamente; não trocar “desconhecido” por média do grupo.
5. Persistir proteção: estado térmico grave, headroom, bateria, limites configurados, saída do foreground e watchdog.
6. Testar sensores ausentes e leituras inválidas sem derrubar UI ou criar falsos números.

**Aceite:** fontes legíveis, limites respeitados, ausência de sensor sem falso “CPU fria”.

### FASE 3 — EXPERIÊNCIA, RELATÓRIO E PERFIS

#### T08 — Perfis de execução controlados

**Dependências:** T01–T03; motores nativos conforme disponibilidade.  
**Arquivos:** `index.html`, `css/style.css`, `js/app.js`, `js/seguranca-movel.js`, `js/relatorio.js`.

1. Implementar seleção `Rápido`, `Completo`, `Extremo`, com modos manual/avançado já existentes preservados.
2. Mostrar duração e alocação **solicitadas e efetivas** antes de começar.
3. Pedir aceite adicional antes de estresse longo/altas escritas; sem caixas de diálogo repetitivas desnecessárias.
4. Garantir cancelamento único, terminação por segurança e retorno da UI mesmo após atraso de thread.
5. Mostrar no painel em tempo real status de componentes, tempo útil, origem de sensores, indicador de cache e cobertura.
6. Manter wake lock condicional; não impedir usuário de parar nem produzir resultados válidos após suspensão.

**Aceite:** perfis reproduzíveis; parâmetros visíveis; não há autoescalonamento silencioso; o perfil extremo não pula proteções.

#### T09 — Relatório técnico v2 e JSON auditável

**Dependências:** T01–T08 pertinentes.  
**Arquivos:** `js/relatorio.js`, `js/avaliacao.js`, `js/metricas.js`, `js/graficos.js` e testes.

1. Acrescentar seção de **escopo** por componente: o que foi verificado e o que não foi.
2. Trocar “Aprovado: sistema estável” genérico por resultado que identifique duração, componentes, cobertura e qualidade.
3. Discriminar `latencia aproximada`, `passadas/s`, lotes/s, tempo GPU, dados de cache, FFT teórica e sensores ausentes.
4. Mostrar séries com janelas e P5/P50/P95, queda sustentada e fontes das temperaturas.
5. JSON exportado com `schemaVersion`, `benchmarkMethodVersion`, `buildVersion`, parâmetros, flags e timestamps monotônicos.
6. Cuidar de legibilidade e impressão mobile/PDF (sem valores truncados); manter exportação offline.
7. Adicionar seção “Comparabilidade” e avisar se uma métrica mudou de metodologia.

**Aceite:** relatório não contém afirmações técnicas mais fortes que as evidências; PDF/JSON fiéis ao resultado e mesmos estados.

### FASE 4 — BANCO, RANKING E PRIVACIDADE

#### T10 — Contrato do benchmark v2 sem misturar séries [CRÍTICA]

**Dependências:** T01, T02, T03, T09 (contratos estabilizados).  
**Arquivos:** `js/benchmark.js`, `js/ranking.js`, `worker/index.js`, `RANKING.md`, `tests/benchmark.test.mjs`, `tests/api.test.mjs` e `migrations/` **somente se necessário**.

1. Criar `VERSAO_BENCHMARK = 2` **após** definir novo formato e compatibilidade do servidor.
2. Preservar leitura/consulta dos registros v1 e mantê-los em grupos `v1` isolados; decidir explicitamente se clientes v1 ainda poderão enviar novos dados durante transição.
3. Atualizar `PRINCIPAL_RANKING.gpu` para `passadasPorSegundo` apenas em v2; os dados v1 continuam com `fps` histórico, sem reinterpretação.
4. Versionar motor por componente (`webgl2-fence-v3`, `android-cpu-v2`, `android-mem-v2`, `android-disco-cache-v2`, etc.) **quando** houver alteração real de metodologia; não inventar nomes de motores que não existem no código.
5. Incluir perfil, tempo útil, parâmetros concorrentes, política de cache e qualidade da amostra na chave de agrupamento.
6. Validar v2 no servidor e recalcular médias/percentis a partir de amostras aceitas. Nunca confiar apenas em status do cliente para elegibilidade.
7. Reforçar regras de duração e cobertura sem excluir arbitrariamente testes legítimos. Registrar motivo de inelegibilidade.
8. Preservar opt-in, chave de privacidade, exportação/exclusão, retenção, pseudonimização e limites de requisição.
9. Consultar schema D1 real antes de aplicar migração; não sobrescrever dados nem deletar ranking histórico.
10. Testar API local: POST válido/ inválido, payload grande, consentimento, grupos v1/v2, idempotência e exclusão.

**Aceite:** nenhum valor v1 de GPU aparece no mesmo grupo ou estatística de v2; resultados sintéticos ficam fora do banco público; rollback viável.

### FASE 5 — TESTE FINAL, RELEASE E HANDOFF

#### T11 — Matriz de validação e regressão

**Dependências:** T01–T10; responsável de QA independente dos implementadores se possível.  
**Arquivos:** `tests/`, `scripts/testar-cargas-android.mjs`, `.github/workflows/ci.yml`, documentação.

1. Executar todos os testes automatizados e builds (seção 8).
2. Validar navegação e resultados em Chrome e Firefox desktop; WebView APK; dispositivo físico Android quando disponível; plugin Windows se houver alterações.
3. Validar rápido isolado e MAX, completo, cancelamento, fundo/aba oculta, sensor indisponível, falha de memória e rede offline.
4. Comparar JSON/PDF com cálculos reproduzidos; conferir que “sem dados” não é zero e que nada é enviado ao ranking sem consentimento.
5. Fazer revisão de segurança, licenças, tamanho do APK, compatibilidade e impacto térmico/escrita.
6. Produzir relatório de validação com testes PASS/FAIL/SKIP e justificativa dos SKIP.

**Aceite:** suíte verde, testes manuais obrigatórios concluídos ou documentados como bloqueio; nenhuma falha crítica pendente.

#### T12 — Preparar v1.4.0 para revisão/publicação

**Dependências:** T11.  
**Arquivos:** `README.md`, `contexto.md`, `AGENTS.md` se processo mudou, `RANKING.md`, `android/README.md`, `android/app/build.gradle`, `js/android.js`, checksums e release notes.

1. Planejar incremento de `versionName` e `versionCode` do APK; **nunca** alterar chave de assinatura.
2. Atualizar URLs versionadas de download, hashes, assets e notas públicas conforme `android/README.md` e `scripts/publicar-android.ps1`.
3. Preservar plugin Windows 1.2.0 se não houve alteração nele; não forçar atualização.
4. Fazer PR com changelog, critérios de aceite e riscos residuais.
5. **Somente após aprovação expressa:** merge; empacotar/sinar via processo privado existente; registrar SHA256; testar pacote; criar release; migrar D1 se necessário; fazer deploy a partir da `main`; smoke test.
6. Reabrir issues se houver regressão; rollback usando release/build anterior e plano de schema compatível.

**Aceite:** release reprodutível e rastreável, sem exposição de segredo, sem mudança não autorizada em produção.

---

## 7. DIVISÃO DO TRABALHO ENTRE AGENTES

| Agente/papel sugerido | Tarefas | Arquivos exclusivos durante execução | Integração |
|---|---|---|---|
| Coordenador | T00, controle de dependências e revisão | `contexto.md` (ou única pessoa autorizada a consolidar) | Confere PRs e contratos. |
| Estatística/Vereditos | T02 + T03 | `metricas.js`, `avaliacao.js`, respectivos testes | Define contrato de medição para os demais. |
| GPU WebGL2 | T01 | `js/testes/gpu.js`, testes de GPU | Entrega chaves e semântica ao coordenador de UI/ranking. |
| Android CPU/Telemetria | T04 + T07 | `PonteAndroid.java`, `ColetaHardware.java`, `SensoresTermicos.java` | Negociar alterações comuns de `Cargas.java`. |
| Android RAM | T05 | `memoria.cpp`, `MemoriaNativa.java` | Alterar `Cargas.java` em janela exclusiva. |
| Android disco | T06 | `disco.cpp` opcional e `Cargas.java` em janela exclusiva | Não concorrer com RAM/CPU no mesmo arquivo. |
| UI/Relatório | T08 + T09 | `app.js`, `relatorio.js`, HTML/CSS | Esperar contrato de métricas estável. |
| Backend/Ranking | T10 | `benchmark.js`, `ranking.js`, `worker/index.js`, migrations | Reconciliar compatibilidade v1/v2. |
| QA/Release | T11 + T12 | CI, documentação e binários de release | Não publicar antes de autorização. |

**Regra operacional:** dois agentes **nunca** escrevem simultaneamente em `js/app.js`, `js/avaliacao.js`, `js/relatorio.js`, `Cargas.java` ou `contexto.md`. Quando houver conflito, criar PR separado e integrar sequencialmente.

### 7.1. Ordem sugerida de PRs

```text
PR-00 docs/baseline-v140              -> T00
PR-01 fix/gpu-metricas-v2             -> T01
PR-02 fix/veredito-cobertura          -> T02
PR-03 feat/estatistica-temporal       -> T03
PR-04 fix/android-cpu-scheduler       -> T04
PR-05 feat/android-ram-validacao      -> T05
PR-06 feat/android-disco-modos        -> T06
PR-07 feat/android-telemetria         -> T07
PR-08 feat/perfis-stress              -> T08
PR-09 feat/relatorio-metodologia-v2   -> T09
PR-10 feat/ranking-protocolo-v2       -> T10
PR-11 test/qa-crossplatform-v140      -> T11
PR-12 chore/release-v140              -> T12 (após aprovação)
```

**Esta ordem é uma proposta de integração, não indicação de PRs existentes.** Ajustar dependências quando o código atual divergir.

---

## 8. TESTES OBRIGATÓRIOS E MATRIZ DE ACEITAÇÃO

### 8.1. Comandos existentes (confirmar na branch atual)

```bash
# na raiz
npm test
npm run check
npm run build
node scripts/testar-cargas-android.mjs

# API e D1 locais (não publicar em produção)
npm run dev:api

# Android (Linux/macOS)
cd android && ./gradlew assembleDebug lintDebug

# Android (Windows PowerShell)
cd android
.\gradlew.bat assembleDebug lintDebug

# plugin Windows, somente se alterado
dotnet publish plugin/SLTStressTest.Plugin -c Release -o plugin/publicado
```

### 8.2. Casos de teste unitário novos

| Caso | Entrada/cenário | Resultado esperado |
|---|---|---|
| U-01 | CPU com 100 amostras válidas, erro=0, duração suficiente | `execucao=concluida`, diagnóstico sem erros, escopo explícito. |
| U-02 | CPU com erro matemático injetado | `erro_verificado`, sem confundir com falha da UI. |
| U-03 | GPU só com 1 componente válido e outros selecionados sem dados | Resultado geral **inconclusivo/incompleto**, não aprovação plena. |
| U-04 | GPU 20 passadas por lote, 60 lotes/s | `passadasPorSegundo≈1200` e `lotesConcluidosPorSegundo≈60`; não “1200 FPS”. |
| U-05 | Sem `EXT_disjoint_timer_query_webgl2` | `tempoGpuMs=null`, ainda executa normalmente. |
| U-06 | `GPU_DISJOINT_EXT` verdadeiro | Descartar medição afetada. |
| U-07 | Contexto WebGL perdido | Falha do motor/incompleto e limpeza; não afirmar GPU defeituosa. |
| U-08 | Medidas [100, 100, 80, 100] com gaps | Janelas por tempo, cobertura e percentis corretos. |
| U-09 | 256 MiB alocados, 140 GB acumulados | Dois números distintos; cobertura reportada sobre **256 MiB**. |
| U-10 | RAM corrompida em um padrão | Detectar erro e apontar bloco/padrão sem expor dados do usuário. |
| U-11 | Falha JNI/alocação parcial ou cancelamento | Recursos liberados, estado incompleto/erro motor. |
| U-12 | Disco cacheável vs fsync | Etiquetas e agrupamentos distintos; ambos verificados. |
| U-13 | I/O 4 KiB parcialmente executado no cancelamento | Apenas bytes/operações concluídos contam no score. |
| U-14 | Sensor CPU indisponível, bateria 38 °C | CPU `não disponível`, bateria independente. |
| U-15 | Android reporta estado térmico grave | Interromper cargas e não aprovar execução como concluída. |
| U-16 | Benchmark v1 `fps` + v2 `passadasPorSegundo` | `chaveGrupo` distinta; nenhuma média cruzada. |
| U-17 | Envio sem consentimento | Não persistir dados; comparação local/efêmera conforme contrato. |
| U-18 | Payload com valores inválidos, séries extensas ou caminho local | Rejeitar/sanitizar pelo schema; sem vazamentos. |
| U-19 | Benchmark emulado | Fora das médias físicas, podendo aparecer apenas em contextos explicitamente separados. |
| U-20 | Perfil completo interrompido aos 2 min | Não receber status “completo aprovado”. |

### 8.3. Matriz de teste manual

| Ambiente | CPU | GPU | RAM | Disco | MAX | PDF/JSON | Segurança |
|---|---|---|---|---|---|---|---|
| Chrome desktop | Rápido | Rápido | Rápido | Rápido | Rápido | Sim | aba oculta, cancelar |
| Firefox desktop | Rápido | Rápido | Rápido | Rápido | Rápido | Sim | sem APIs opcionais |
| Android APK em aparelho físico | Rápido + Completo conforme condições | idem | idem | idem | Rápido/Completo | Sim | temperatura, foreground, OOM, pausa |
| Android com sensor bloqueado | Sim | Sim | Sim | Sim | Sim | Sim | sem leituras inventadas |
| Android AVD/emulador | Smoke | Smoke | Smoke | Smoke | Smoke | Sim | nunca validar desempenho físico no emulador |
| Windows + plugin já instalado | Rápido | Rápido | Rápido | Real | Rápido | Sim | loopback, CORS, admin/driver sem reinstalação |
| Navegador sem plugin/APK | Rápido | WebGL2 conforme suporte | OPFS conforme suporte | OPFS conforme suporte | conforme suporte | Sim | recursos indisponíveis explícitos |

**Nota:** Testes de 15/30 min somente em ambiente controlado, com consentimento, proteção de aquecimento e monitoramento. Não fazer “teste extremo” automatizado em CI ou aparelhos remotos desconhecidos.

### 8.4. Critérios de aceite da versão (Definition of Done)

- [ ] Não há “FPS” falsamente definido como número de passadas da GPU.
- [ ] Nenhum “tempo de quadro GPU” é derivado de passadas/s.
- [ ] Falha da ferramenta e falha de verificação são reportadas distintamente.
- [ ] Todas as execuções incompletas estão fora do ranking de testes concluídos.
- [ ] CPU Lucas–Lehmer tem método fixo/normalizado ou limitação declarada.
- [ ] Prioridade de threads Android revisada e testada sem quebrar proteção/cancelamento.
- [ ] RAM mostra capacidade alocada, cobertura real e volume acumulado em campos diferentes.
- [ ] Armazenamento identifica cache/sync e nunca sugere “flash físico sem cache” sem comprovação.
- [ ] Sensores ausentes aparecem como ausentes, com fonte e motivo quando disponível.
- [ ] WebGL2 sem timer query continua funcional, sem números fabricados.
- [ ] Rankings v1 e v2 separados; histórico e consentimento preservados.
- [ ] Testes JS, validação Java, build e lint Android passam.
- [ ] PDF/JSON e interfaces mobile/desktop validados.
- [ ] Nenhuma chave/credencial/arquivo temporário indevido entra em commit.
- [ ] `AGENTS.md` e `contexto.md` refletem estado final e pendências.
- [ ] Release/deploy só se houver autorização.

---

## 9. CONTRATO DE API, MIGRAÇÃO E ROLLBACK

### 9.1. Campos recomendados para payload v2

```json
{
  "versao": 2,
  "id": "UUIDv4",
  "contribuinte": "UUIDv4",
  "perfil": "rapido",
  "duracaoAlvoS": 120,
  "duracaoRealS": 120,
  "concluido": true,
  "qualidade": {
    "tempoUtilS": 112,
    "cobertura": 0.93,
    "pausas": 0,
    "motivosInelegibilidade": []
  },
  "componentes": {
    "gpu": {
      "configuracao": {
        "motor": "webgl2-fence-v3",
        "largura": 640,
        "altura": 360,
        "intensidade": 64
      },
      "series": {
        "passadasPorSegundo": [1800, 1850, 1900]
      },
      "metadadosMedicao": {
        "passadasPorSegundo": {
          "unidade": "passadas/s",
          "origem": "webgl2",
          "comparavel": true
        }
      }
    }
  }
}
```

**É exemplo ilustrativo de schema alvo, NÃO payload aceito hoje.** O contrato completo v2 precisará manter todos os campos v1 obrigatórios, política de consentimento, validação de identificadores e hardware, com campos novos aprovados pelos testes de API.

### 9.2. Estratégia de migração sem corrupção histórica

1. Servidor lê v1 e v2 com validadores separados durante a transição ou bloqueia v1 explicitamente depois de verificar atualização de todos os clientes suportados.
2. Dados v1 nunca são reetiquetados como v2 por migração de banco sem recomputação justificada.
3. Grupos contêm versão global e versão do motor: ao mudar significado da métrica, mudar grupo, nome e documentação.
4. Manter consultas de ranking v1 visíveis como **“metodologia anterior”** quando cabível.
5. Adicionar migrations D1 **apenas se o schema exigir**; revisar índices, compatibilidade, custo e retenção.
6. Ensaiar migrations e rollback em D1 **local**, com dados fictícios, antes de operação remota.
7. Em produção, ter plano de rollback do Worker/asset + schema compatível; nunca depender de `DROP` para voltar a versão anterior.
8. A comparação e o ranking continuam condicionados à política de consentimento, exclusão e retenção existentes.

### 9.3. Segurança do plugin e do Android

- Plugin Windows: preservar somente `127.0.0.1:5299`, origens autorizadas, cabeçalho `X-SLT-Plugin` para ações mutáveis e ausência de CORS universal.
- Android: bridge WebView apenas para conteúdo confiável embutido e ações permitidas, sem expor interface JNI a conteúdo remoto não confiável.
- Testes nativos utilizam apenas diretório privado e arquivos de propriedade da execução; proibir alteração/remoção de arquivos pessoais.
- Root permanece opção avançada separada e **não é requisito**; nunca habilitar automaticamente.
- Dados de ranking são pseudonimizados; a publicação opt-in não autoriza novos dados pessoais.

---

## 10. RISCOS, DECISÕES EM ABERTO E PRIORIZAÇÃO

| Risco / decisão | Tratamento obrigatório | Responsável |
|---|---|---|
| Timer query indisponível ou valores disjoint | `tempoGpuMs=null`; manter carga GL, não estimar. | GPU |
| `O_DIRECT` não suportado em armazenamento interno | Fallback **rotulado**, não alegar leitura sem cache. | Android disco |
| Temperatura CPU/GPU bloqueada | Mostrar indisponibilidade; usar ThermalStatus/bateria/queda como fontes separadas. | Android telemetria |
| Resultados v2 não comparáveis com v1 | Grupos/versões distintos; sem converter v1 por simples renomeação. | Backend |
| Carga extrema acelera desgaste/bateria | Consentimento; limite de escrita; duração; proteção e desligamento. | UI/Segurança |
| Bateria e carregador influenciam benchmark | Registrar contexto e separar ranking; não obrigar carregamento como padrão mobile. | Ranking |
| ALU/GPU sob escalonamento diferente | Perfil explícito, duração útil, prioridade foreground; comparabilidade limitada. | CPU/GPU |
| Testes Android geram OOM/ANR | Alocação conservadora, watchdog independente, worker e JNI canceláveis. | Android |
| Agentes atuam nos mesmos arquivos | Reservar arquivo e PR por tarefa no `contexto.md`. | Coordenador |
| CI verde sem dispositivo físico | Não declarar validação física; release bloqueada se depender dessa cobertura. | QA |

**Ordem de prioridade sugerida:** T00 → T01/T02 → T03 → T04/T05/T06/T07 → T08/T09 → T10 → T11 → T12. A correção **semântica** de resultados vem antes de otimização de performance.

---

## 11. MODELO DE HANDOFF ENTRE AGENTES

Ao terminar uma sessão, deixar no final de `contexto.md` um registro seguindo este modelo:

```md
### Em andamento — [AAAA-MM-DD HH:MM]
- Agente: [identificador]
- Tarefa: T0X — [nome]
- Branch: [nome]
- Base SHA: [hash]
- Arquivos sob responsabilidade: [lista]
- O que foi feito: [itens concretos]
- Testes executados: [comando e PASS/FAIL/SKIP]
- Evidências / logs não sensíveis: [caminhos/links]
- Problemas encontrados: [descrição]
- Pendente para continuar: [próximo passo exato]
- PR: [número/link se houver]
- Ambiente físico usado: [modelo/Android/navegador; sem IDs pessoais]
- Observações de segurança: [confirmar proteção e recursos liberados]
```

**Prompt de início para qualquer agente** — copiar juntamente com este documento:

> Você vai trabalhar no repositório `mikerock12/slt-stress-test`. Leia primeiro `AGENTS.md`, `contexto.md`, `README.md`, `RANKING.md` e o arquivo `SLT_Stress_Test_Plano_Mestre_v1.4.0.md`. Inspecione a `main` atual e informe SHA e divergências relevantes antes de começar. Execute exclusivamente a próxima tarefa desbloqueada do plano, respeitando dependências e arquivos em uso por outros agentes. Faça mudanças pequenas com testes reproduzíveis, branch e PR. Atualize `contexto.md` durante o trabalho. Nunca invente sensor, frequência, FPS ou resultado de desempenho; nunca misture métricas v1/v2 no ranking. Não exponha segredos, não instale drivers/root nem publique release ou deploy sem autorização explícita. No encerramento, entregue resumo de arquivos mudados, testes PASS/FAIL/SKIP, riscos e próximo passo.

---

## 12. REFERÊNCIAS INTERNAS E ORIGEM DAS DECISÕES

**Fontes primárias de projeto consultadas (repositório em 30/10/2026):**

- https://github.com/mikerock12/slt-stress-test/blob/main/AGENTS.md
- https://github.com/mikerock12/slt-stress-test/blob/main/contexto.md
- https://github.com/mikerock12/slt-stress-test/blob/main/README.md
- https://github.com/mikerock12/slt-stress-test/blob/main/RANKING.md
- https://github.com/mikerock12/slt-stress-test/blob/main/js/app.js
- https://github.com/mikerock12/slt-stress-test/blob/main/js/avaliacao.js
- https://github.com/mikerock12/slt-stress-test/blob/main/js/metricas.js
- https://github.com/mikerock12/slt-stress-test/blob/main/js/testes/gpu.js
- https://github.com/mikerock12/slt-stress-test/blob/main/js/relatorio.js
- https://github.com/mikerock12/slt-stress-test/blob/main/js/benchmark.js
- https://github.com/mikerock12/slt-stress-test/blob/main/js/ranking.js
- https://github.com/mikerock12/slt-stress-test/blob/main/worker/index.js
- https://github.com/mikerock12/slt-stress-test/blob/main/android/README.md
- https://github.com/mikerock12/slt-stress-test/blob/main/android/app/src/main/java/br/com/smellsliketech/stresstest/Cargas.java
- https://github.com/mikerock12/slt-stress-test/blob/main/android/app/src/main/java/br/com/smellsliketech/stresstest/PonteAndroid.java
- https://github.com/mikerock12/slt-stress-test/blob/main/android/app/src/main/java/br/com/smellsliketech/stresstest/ColetaHardware.java
- https://github.com/mikerock12/slt-stress-test/blob/main/android/app/src/main/cpp/memoria.cpp
- https://github.com/mikerock12/slt-stress-test/blob/main/scripts/testar-cargas-android.mjs
- https://github.com/mikerock12/slt-stress-test/blob/main/.github/workflows/ci.yml

**Fonte de campo:** PDF “Relatório · MAX STRESS”, gerado por SLT Stress Test em 30/10/2026 às 13:17:27, três páginas, fornecido pelo mantenedor na conversa. Os números foram transcritos como exemplo histórico; não existe aqui uma auditoria por instrumentação externa nem teste físico independente.

**Fontes auxiliares de implementação:** documentação oficial do Android (`Process`, `PowerManager`, `HardwarePropertiesManager`, segurança WebView), OpenGL/WebGL2 (`EXT_disjoint_timer_query_webgl2`, `fenceSync`), Java NIO (`FileChannel.force`) e Linux `open(2)`/`O_DIRECT`. Agentes devem confirmar suporte e semântica nas versões de SDK/API relevantes antes de implementar.

---

## 13. PRÓXIMA AÇÃO EXATA

Iniciar **T00 — baseline**, criar registro no `contexto.md`, confirmar SHA do repositório e executar `npm run check`, `npm run build` e `node scripts/testar-cargas-android.mjs`. Depois, abrir **T01 (GPU)** e **T02 (veredito)** em branches distintas, com reserva de `js/avaliacao.js` para evitar conflito. Nenhum agente deve iniciar release/deploy enquanto T11 não for concluída e T12 não for expressamente autorizada.

**Fim do plano mestre.**
