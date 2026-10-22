# SLT Stress Test Plugin (Windows)

Programa de bandeja que liga o site aos sensores reais do computador. Escuta só em
`http://127.0.0.1:5299` e só responde às origens do site (`https://stresstest.smellsliketech.com.br`
e `http://localhost:5173` em desenvolvimento).

## Rotas (protocolo 1)

| Rota | O que devolve |
| --- | --- |
| `GET /v1/ola` | Versão, protocolo, admin/PawnIO, CPU, GPUs, pentes de memória (MT/s) e unidades físicas |
| `GET /v1/sensores` | Foto do último segundo: CPU (temp, clock, potência, uso), GPUs, memória, discos |
| `GET /v1/discos` | SMART via Windows: saúde, temperatura, horas, desgaste, erros e avaliação Bom/Cuidado/Ruim |
| `GET /v1/disco/benchmark` | Estado do benchmark de disco |
| `POST /v1/disco/benchmark` | `{unidade, mib, segundos, ciclos}`; `ciclos: 0` repete até cancelar |
| `POST /v1/disco/benchmark/cancelar` | Cancela e apaga o arquivo temporário |

Os `POST` exigem o cabeçalho `X-SLT-Plugin` (força o preflight CORS).

## Compilar

```bash
dotnet publish plugin/SLTStressTest.Plugin -c Release -o plugin/publicado
```

Gera um único `SLTStressTestPlugin.exe` (~60 MB, .NET embutido). Pede administrador ao abrir,
porque o Windows exige isso para SMART e sensores. Temperatura e clock por núcleo da CPU
precisam do driver PawnIO instalado à parte; sem ele, o clock vem do contador de desempenho
do Windows.

## Publicar uma versão

O site baixa de `https://github.com/mikerock12/slt-stress-test/releases/latest/download/SLTStressTestPlugin.exe`.
Suba o `.exe` como asset de uma release com exatamente esse nome. Licenças de terceiros em
[TERCEIROS.md](TERCEIROS.md).
