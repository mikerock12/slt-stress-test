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

O texto da MPL-2.0 está em https://mozilla.org/MPL/2.0/.

O driver **PawnIO** (https://pawnio.eu/), usado pela LibreHardwareMonitorLib para ler
temperatura e clock da CPU, **não** é distribuído com o plugin: o usuário o instala à parte,
se quiser.
