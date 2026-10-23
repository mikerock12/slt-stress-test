# Componentes de terceiros do SLT Stress Test Plugin

O `SLTStressTestPlugin.exe` inclui, sem modificações, os componentes abaixo. Agradecemos aos
autores. O código-fonte de cada um está nos links.

| Componente | Licença | Fonte |
| --- | --- | --- |
| LibreHardwareMonitorLib 0.9.6 | MPL-2.0 | https://github.com/LibreHardwareMonitor/LibreHardwareMonitor |
| DiskInfoToolkit 1.1.2 | MPL-2.0 | https://github.com/Blacktempel/DiskInfoToolkit |
| RAMSPDToolkit-NDD 1.4.2 | MPL-2.0 | https://github.com/Blacktempel/RAMSPDToolkit |
| HidSharp 2.6.4 | Apache-2.0 | https://software.seekye.com/hidsharp |
| Mono.Posix.NETStandard 1.0.0 | MIT | https://github.com/mono/mono |
| .NET 10 (runtime, ASP.NET Core, Windows Forms, System.Management, System.IO.Ports) | MIT | https://github.com/dotnet |
| Módulos PawnIO 0.1.6 (namazso), usados pela LibreHardwareMonitorLib | LGPL-2.1 ou posterior | https://github.com/namazso/PawnIO.Modules/tree/0.1.6 |

O texto da MPL-2.0 está em https://mozilla.org/MPL/2.0/.

## PawnIO 2.2.0 incluído no exe

Copyright (C) 2026 namazso. Driver sob **GPL-2.0 ou posterior, com a exceção de ligação
publicada pelo autor**. O plugin MIT permanece independente e usa o acesso de hardware
da LibreHardwareMonitorLib. Não modificamos o driver nem seus arquivos INF/CAT.

Incluímos apenas a distribuição oficial x64 assinada pela Microsoft, sem a variante
unrestricted e sem o instalador de terceiros (cuja licença específica não é declarada
no repositório de releases). Nosso exe instala o pacote via APIs PnP do próprio Windows,
depois de apresentar a licença e pedir a aceitação da pessoa. Não desativa proteções.

Os arquivos originais, a GPL completa (`COPYING`), o aviso original com a exceção e o
arquivo `fontes.zip` estão em `SLTStressTest.Plugin/Terceiros/PawnIO/`, incorporados como
recursos do exe. São extraídos em `%ProgramFiles%/Smells Like Tech/SLT Stress Test/PawnIO-2.2.0/`.
As fontes incluem o commit `5cdf470831fdfff3f7f1d06363ca6b230f3bf35a` e o submódulo PawnPP
`e64e4c37b2d8ba0d8ee57205faf8183aee12c438`, com arquivos de compilação e licenças originais.
O mesmo arquivo inclui os módulos PawnIO 0.1.6, commit
`4aa792beb020a14c8261072e9786d2dfb38489d9`; `LGPL-2.1.txt` preserva sua licença completa.
`SHA256SUMS.json` permite verificar cada arquivo incluído. O menu da bandeja abre essa pasta.

Origem: [distribuição oficial 2.2.0](https://github.com/namazso/PawnIO.Setup/releases/tag/2.2.0),
instalador original SHA-256 `1f519a22e47187f70a1379a48ca604981c4fcf694f4e65b734aaa74a9fba3032`.
Os arquivos x64 assinados foram extraídos sem alterações desse pacote; o instalador não é
incluído. [Código e aviso do autor](https://github.com/namazso/PawnIO/tree/2.2.0).
