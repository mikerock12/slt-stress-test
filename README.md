# SLT Stress Test

Teste de estresse e benchmark de **CPU, GPU, memória e armazenamento**, da
[Smells Like Tech](https://smellsliketech.com.br), com site, aplicativo Android, plugin
Windows e ranking comunitário persistente.

**[Abrir o site](https://stresstest.smellsliketech.com.br)** ·
[Baixar APK Android](https://stresstest.smellsliketech.com.br/assets/downloads/SLTStressTest-v1.3.0.apk) ·
[Baixar plugin Windows](https://github.com/mikerock12/slt-stress-test/releases/latest/download/SLTStressTestPlugin.exe) ·
[Release e checksums](https://github.com/mikerock12/slt-stress-test/releases/tag/v1.3.0)

## Escolha sua plataforma

| Plataforma | Recursos |
| --- | --- |
| Navegador desktop ou celular | CPU por Web Workers, GPU WebGL2, memória e armazenamento OPFS; não exige instalação |
| Windows com plugin opcional | Sensores disponíveis de CPU/GPU, inventário da memória, SMART e benchmark de disco sem cache |
| Android com APK | CPU Java, memória C++/NDK fora do heap Java, armazenamento nativo e GPU WebGL2; interface embarcada, PDF e JSON |

O site identifica desktop, Android e iOS e apresenta os downloads correspondentes.
O APK exige Android 8+ e Android System WebView/Chrome 110 ou superior. Os testes do app
funcionam offline; ranking e contribuição precisam de internet. No iOS, os testes são
executados no navegador.

## Testes

| Teste | Inspirado em | O que faz |
| --- | --- | --- |
| CPU | Prime95 | Lucas-Lehmer em primos de Mersenne conhecidos + FFT verificada, em todas as threads |
| GPU | FurMark | Rosquinha peluda em raymarching WebGL2, FPS, vazão de pixels e detecção de artefatos |
| Memória | MemTest86 | 8 padrões gravados e conferidos, banda de escrita/leitura/cópia e latência |
| Disco | CrystalDiskMark | Sequencial 1 MiB e aleatório 4 KiB (leitura/escrita) num arquivo temporário OPFS, com verificação |

A tabela descreve o motor do navegador. APK e plugin usam os métodos nativos documentados
em [Android](android/README.md) e [Windows](plugin/README.md); seus resultados ficam separados
no ranking.

Modos: um teste por vez ou **MAX STRESS** (todos juntos), por 2 min, 15 min, 30 min, 1 h ou
sem limite. No fim sai um relatório com médias, estabilidade, queda de desempenho (sinal de
throttling) e veredito por componente, exportável em PDF e JSON.

O navegador não expõe temperatura, clock real da GPU, frequência da RAM nem SMART.
O plugin Windows e o APK ampliam a coleta conforme o sistema e o fabricante permitem.
No Android, o modo avançado opcional consulta sensores por um comando fixo de somente
leitura em aparelhos que já tenham root. Leituras ausentes aparecem como “não disponível”;
estimativas são identificadas, e a temperatura da bateria nunca é apresentada como CPU/GPU.

## Ranking e comparação

Ao terminar um teste, o relatório compara os resultados com hardware e configurações
equivalentes. A contribuição ao banco é opcional: só ocorre quando a pessoa a autoriza.
O ranking separa CPU, GPU, memória e armazenamento, com filtros por tipo, marca, modelo e
frequência disponível, métricas detalhadas, séries dos testes e comparação lado a lado.

As médias são recalculadas no servidor e separam motores, parâmetros, frequências conhecidas
e desconhecidas, testes isolados e simultâneos. A referência exige ao menos cinco outros
identificadores anônimos; os próprios resultados ficam fora da comparação. Sem dados
suficientes, o relatório informa a ausência e agradece a contribuição, sem inventar uma média.
Emuladores não entram nas médias de hardware físico. Regras e limites em [RANKING.md](RANKING.md).

## Rodar localmente

Veja a [política de privacidade](https://stresstest.smellsliketech.com.br/privacidade.html)
para entender os dados publicados e exportar ou excluir suas contribuições. O plugin Windows
inclui o driver PawnIO assinado, licença e fontes, com instalação automática após a aceitação.

```bash
npm run dev       # site estático em http://localhost:5173
npm run dev:api   # site + API + banco D1 local em http://localhost:8787
npm run check     # sintaxe + testes, incluindo integração SQLite
npm run build     # monta dist/ para publicação
```

Frontend em HTML, CSS e JavaScript (ES modules), sem dependências de execução.
A API usa Cloudflare Workers e D1; o comando com API utiliza Wrangler. Use Node.js 22 ou
superior para a suíte com SQLite. Compilação do APK e do plugin nas respectivas documentações.

O CI verifica site/API, build e lint Android, algoritmos Java e publicação do plugin .NET.
Instruções de publicação e histórico de verificações em [contexto.md](contexto.md).

## Créditos

Ideias de Prime95 (GIMPS), FurMark (Geeks3D), MemTest86 (PassMark), Memtest86+,
CrystalDiskMark e CrystalDiskInfo (Crystal Dew World). Nenhum código desses projetos foi
usado. Veja a seção "Créditos" do site.

## Licença

MIT — veja [LICENSE](LICENSE). Para agentes de IA: leia [AGENTS.md](AGENTS.md) e
[contexto.md](contexto.md).
