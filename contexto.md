# Contexto do projeto — SLT Stress Test

Atualizado em 22/10/2026, horário de Brasília (America/Sao_Paulo).
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

## Em andamento

- (vazio)

## Próximos passos combinados

1. Dono revisa a prévia local (`npm run dev`).
2. Publicar no Cloudflare Pages + domínio `stresstest.smellsliketech.com.br`
   (CNAME na zona do Cloudflare; Registro.br só se necessário).
3. Repositório público no GitHub, commit, push, PR com CI, merge.
4. Backup no Google Drive.

## Ideias futuras (não aprovadas)

- Agente local opcional (ex.: lendo sensores do LibreHardwareMonitor) para temperatura e
  clocks reais no relatório.
- Teste WebGPU compute como alternativa ao WebGL2.

## Histórico

- 22/10/2026 — Criação do projeto (AGENTS.md, contexto.md, site completo, testes Node).
