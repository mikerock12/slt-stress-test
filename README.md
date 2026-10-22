# SLT Stress Test

Teste de estresse de **CPU, GPU, memória e disco direto no navegador**, da
[Smells Like Tech](https://smellsliketech.com.br). Em produção:
<https://stresstest.smellsliketech.com.br>.

| Teste | Inspirado em | O que faz |
| --- | --- | --- |
| CPU | Prime95 | Lucas-Lehmer em primos de Mersenne conhecidos + FFT verificada, em todas as threads |
| GPU | FurMark | Rosquinha peluda em raymarching WebGL2, FPS, vazão de pixels e detecção de artefatos |
| Memória | MemTest86 | 8 padrões gravados e conferidos, banda de escrita/leitura/cópia e latência |
| Disco | CrystalDiskMark | Sequencial 1 MiB e aleatório 4 KiB (leitura/escrita) num arquivo temporário OPFS, com verificação |

Modos: um teste por vez ou **MAX STRESS** (todos juntos), por 2 min, 15 min, 30 min, 1 h ou
sem limite. No fim sai um relatório com médias, estabilidade, queda de desempenho (sinal de
throttling) e veredito por componente, exportável em PDF e JSON.

O navegador não deixa sites lerem temperatura, clock real da GPU, frequência da RAM nem
SMART. Para isso existe o **SLT Stress Test Plugin** (Windows, opcional, baixado pelo site):
um programa de bandeja que entrega ao site, só no próprio computador, temperatura, clocks e
potência reais, frequência da memória, SMART dos discos e um teste de disco sem cache. Veja
[plugin/README.md](plugin/README.md).

## Rodar localmente

```bash
npm run dev     # http://localhost:5173
npm run check   # sintaxe + testes
```

Sem dependências e sem build: é HTML, CSS e JavaScript (ES modules).

## Créditos

Ideias de Prime95 (GIMPS), FurMark (Geeks3D), MemTest86 (PassMark), Memtest86+,
CrystalDiskMark e CrystalDiskInfo (Crystal Dew World). Nenhum código desses projetos foi
usado. Veja a seção "Créditos" do site.

## Licença

MIT — veja [LICENSE](LICENSE). Para agentes de IA: leia [AGENTS.md](AGENTS.md) e
[contexto.md](contexto.md).
