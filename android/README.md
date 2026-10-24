# SLT Stress Test — Android

APK para Android 8+ com Android System WebView/Chrome 110 ou superior. O app verifica o motor
antes de abrir a interface. Não exige conta nem root. A interface fica dentro do APK e funciona
offline; só ranking e contribuição precisam de internet.

## O que mede

- CPU: uma thread Java por núcleo selecionado, FFT complexa 4096 ida/volta e Lucas-Lehmer em
  primos de Mersenne conhecidos. Verifica respostas e informa GFLOPS/iterações por segundo.
- GPU: a mesma cena WebGL2 do site, resolução fixa, FPS, vazão e verificação de artefatos.
- Memória: buffers alocados pelo NDK fora do heap ART/Java, oito padrões, leitura, escrita,
  cópia e latência aproximada. Blocos segmentados e liberados explicitamente ao encerrar.
  Verifica o conteúdo de ambos os buffers. O total alocado e o solicitado aparecem no JSON;
  até um terço da memória disponível evita que o Android mate o app. Isso não cobre a RAM
  de outros processos nem equivale a um teste antes do boot.
- Armazenamento: arquivo privado temporário, SEQ1M/RND4K Q1, leitura/escrita verificadas,
  `force(true)` após as escritas. Leitura pode incluir o cache do Android; nunca comparar
  com o teste Windows sem cache. Arquivo apagado ao parar e sobra removida ao reabrir o app.
- Identificação: fabricante/modelo, SoC, ABI, núcleos, RAM que o Android informa, limite do
  processo e capacidade do sistema de arquivos. Não lê IMEI, número de série ou contatos.
- Sensores: CPU por núcleo via cpufreq, GPU KGSL, zonas térmicas identificadas, hwmon, devfreq,
  estado térmico do PowerManager e bateria (temperatura, tensão, corrente). Cada fonte é
  identificada. Temperatura da bateria e do SoC não viram temperatura da CPU/GPU.

As APIs de temperatura do Android normalmente exigem proprietário do dispositivo/serviço
autorizado. O app também tenta os arquivos que o fabricante disponibiliza. Sem leitura,
informa a causa; frequência da RAM, modelo do chip de memória e SMART não são inventados.
Não ter root não impede toda leitura: alguns fabricantes expõem arquivos que outros
bloqueiam. A busca tenta os caminhos thermal de classe e virtual, inclusive índices diretos
quando listar diretórios é negado, além de hwmon com rótulo. Reconhece nomes CPU, GPU/Mali
e MFG; bateria, carcaça, PMIC e sensores genéricos ficam separados. A interface mostra
leituras, fontes e motivos de ausência mesmo antes de iniciar uma carga. No POCO sem root,
a nova busca precisa ser conferida no aparelho; não há garantia de acesso a um sensor bloqueado.

## Leitura avançada opcional

O botão **nativo** “Sensores avançados” habilita consulta por `su` em aparelho que **já tenha
root** e exige autorização no gerenciador de root da pessoa. Não instala root nem muda
permissões. O comando é fixo, sem parâmetros vindos do site; só consulta zonas térmicas,
cpufreq, devfreq, informações DDR expostas, clocks e modelos dos controladores. Também tenta
indicadores de vida útil eMMC/UFS expostos pelo kernel (valores brutos, diferentes de SMART).
Valores sem unidade
documentada ficam brutos. Controlador visível não é automaticamente atribuído ao arquivo
testado. O modo não garante que o fabricante disponibilize todos os sensores.

## Proteção e segurança

- Cargas encerradas ao sair do primeiro plano; relatório registra a interrupção.
- Interrompe em estado térmico grave (3) ou superior, índice térmico Android >= 1, ou bateria
  a 43 °C. Índice térmico é relativo ao limite de redução de desempenho, não graus Celsius;
  consulta a cada 10 s em Android 11+, quando suportado. Limites CPU/GPU também valem quando
  há leituras correspondentes (padrão móvel 80 °C, ajustável na interface).
- Prazo monotônico nativo independente do WebView; se a página não consulta sensores por
  10 s, encerra cargas. Monitor de prazo separado da coleta/root. Parar só sinaliza e retorna:
  o site consulta a limpeza por até 3,5 s, sem Future.get dentro da bridge síncrona.
  Nova execução aguarda o término real das tarefas anteriores. Arquivo/buffers têm confirmação.
- Cargas nativas usam prioridade de fundo para preservar a interface. Se o Android encerrar
  o renderizador WebView, cargas recebem parada e o app oferece reabrir sem reiniciar testes.
- GPU com no máximo um lote em voo, conclusão por fence sem bloquear a página, leitura de
  referência assíncrona por PBO e parada em perda de contexto ou quadro sem conclusão por 5 s.
  Motor `webgl2-fence-v2` separado do anterior no ranking; só conta quadros concluídos.
- No celular, padrão de metade das threads (1 em aparelhos com até 2), GPU 360p/leve e
  memória 256 MiB com menos workers. Opções completas continuam selecionáveis. Queda >= 50%
  persistente em CPU/GPU interrompe a carga após a janela inicial; é um sinal de proteção,
  sem afirmar temperatura medida. A mesma proteção de desempenho vale no iPhone pelo site.
- Bridge só para a interface embarcada. Recursos de outros domínios bloqueados no WebView;
  links HTTPS externos abrem no navegador. API apenas no domínio oficial, TLS sem exceções.
- Sem permissões amplas de arquivos. JSON usa seletor de documentos; PDF usa impressão nativa.
- Depuração WebView somente em APK debug. Release assinada localmente, sem segredos no Git/CI.

## Compilar e distribuir

JDK 17, SDK Android 35, NDK 27.0.12077973, CMake 3.22.1 e licenças já aceitas pela pessoa que
prepara a máquina. APK universal ARM/ARM64/x86/x86_64:

```powershell
$env:ANDROID_HOME = 'caminho/do/sdk'
./android/gradlew.bat -p android assembleDebug lintDebug
node scripts/testar-cargas-android.mjs
./scripts/publicar-android.ps1
```

O wrapper é Gradle 8.11.1. Em Linux, usar `android/gradlew`. O CI publica APK **de teste** como
artefato, nunca a chave de distribuição. `publicar-android.ps1` cria chave e senha aleatória em
`.local/assinatura-android/` (ignorada pelo Git) e gera `.local/release/SLTStressTest.apk`.
Preservar essa pasta privada em backup para futuras atualizações do mesmo aplicativo.

A biblioteca C++ usa alinhamento ELF de 16 KB (LOAD e RELRO), compatível também com
dispositivos de 4 KB. Validar o APK com `zipalign -c -P 16 4` e os segmentos das quatro ABIs.
Isso não comprova a execução em todos os aparelhos; sensores e root ainda exigem teste físico.

Release do GitHub `v1.3.0`, asset `SLTStressTest.apk` e `SHA256SUMS.txt`. A mesma release deve
ter `SLTStressTestPlugin.exe`, pois o download Windows usa `releases/latest/download/`.

O botão do site baixa uma cópia idêntica do APK diretamente do domínio oficial, em
`/assets/downloads/SLTStressTest-v1.3.0.apk`, sem redirecionamento para o GitHub. A cópia
pública e seu `SHA256SUMS.txt` ficam em `assets/downloads/`; o build confere a integridade
antes de publicar. Em uma atualização, substituir por um novo nome versionado, atualizar
o checksum, `js/android.js`, o link HTML, `_headers` e o README. Nunca colocar a chave ou
a senha nessa pasta pública. A release continua sendo a origem e a alternativa de download.

Referências: [HardwarePropertiesManager](https://developer.android.com/reference/android/os/HardwarePropertiesManager),
[PowerManager](https://developer.android.com/reference/android/os/PowerManager),
[segurança da bridge WebView](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges).
