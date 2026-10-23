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
- Sensores: CPU por núcleo via cpufreq, GPU KGSL, zonas térmicas identificadas, devfreq,
  estado térmico do PowerManager e bateria (temperatura, tensão, corrente). Cada fonte é
  identificada. Temperatura da bateria e do SoC não viram temperatura da CPU/GPU.

As APIs de temperatura do Android normalmente exigem proprietário do dispositivo/serviço
autorizado. O app também tenta os arquivos que o fabricante disponibiliza. Sem leitura,
informa a causa; frequência da RAM, modelo do chip de memória e SMART não são inventados.

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
- Interrompe em estado térmico crítico do Android ou bateria a 45 °C; limites CPU/GPU do site
  também valem quando há leituras correspondentes.
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

Release do GitHub `v1.1.0`, asset `SLTStressTest.apk` e `SHA256SUMS.txt`. A mesma release deve
ter `SLTStressTestPlugin.exe`, pois o download Windows usa `releases/latest/download/`.

Referências: [HardwarePropertiesManager](https://developer.android.com/reference/android/os/HardwarePropertiesManager),
[PowerManager](https://developer.android.com/reference/android/os/PowerManager),
[segurança da bridge WebView](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges).
