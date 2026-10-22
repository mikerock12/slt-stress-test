using LibreHardwareMonitor.Hardware;

namespace SLTStressTest.Plugin;

/// <summary>
/// Lê os sensores reais da máquina com a LibreHardwareMonitorLib.
///
/// A leitura roda numa thread própria, uma vez por segundo, e só enquanto o site está
/// pedindo dados: parado, o plugin não gasta CPU. O site sempre recebe a última foto pronta,
/// sem esperar o hardware responder.
/// </summary>
public sealed class Sensores : IDisposable
{
    private readonly Computer computador = new()
    {
        IsCpuEnabled = true,
        IsGpuEnabled = true,
        IsMemoryEnabled = true,
        IsStorageEnabled = true,
        IsMotherboardEnabled = true,
    };

    private readonly Thread thread;
    private volatile bool ligado = true;
    private volatile FotoSensores? ultima;
    private long ultimoPedidoTicks = Environment.TickCount64;

    public Sensores()
    {
        computador.Open();
        thread = new Thread(Laco) { IsBackground = true, Name = "Sensores" };
        thread.Start();
    }

    /// <summary>Nomes fixos do hardware, para a apresentação do plugin.</summary>
    public string NomeCpu => computador.Hardware.FirstOrDefault(h => h.HardwareType == HardwareType.Cpu)?.Name ?? "não identificado";

    public IReadOnlyList<string> NomesGpu => computador.Hardware.Where(EhGpu).Select(h => h.Name).ToArray();

    public FotoSensores Atual()
    {
        Interlocked.Exchange(ref ultimoPedidoTicks, Environment.TickCount64);
        return ultima ?? Ler();
    }

    private void Laco()
    {
        while (ligado)
        {
            // Sem pedidos há mais de 30 s: só confere de vez em quando se voltaram.
            var ocioso = Environment.TickCount64 - Interlocked.Read(ref ultimoPedidoTicks) > 30_000;
            if (!ocioso)
            {
                try { ultima = Ler(); } catch { /* um sensor ruim não derruba o plugin */ }
            }
            Thread.Sleep(ocioso ? 500 : 1000);
        }
    }

    private FotoSensores Ler()
    {
        lock (computador)
        {
            foreach (var h in computador.Hardware) Atualizar(h);

            var cpu = computador.Hardware.FirstOrDefault(h => h.HardwareType == HardwareType.Cpu);
            var mem = computador.Hardware.FirstOrDefault(h => h.HardwareType == HardwareType.Memory);

            return new FotoSensores
            {
                Instante = DateTimeOffset.Now,
                Cpu = cpu is null ? null : LerCpu(cpu),
                Gpus = computador.Hardware.Where(EhGpu).Select(LerGpu).ToArray(),
                Memoria = mem is null ? null : LerMemoria(mem),
                Discos = computador.Hardware.Where(h => h.HardwareType == HardwareType.Storage).Select(LerDisco).ToArray(),
            };
        }
    }

    private static void Atualizar(IHardware h)
    {
        h.Update();
        foreach (var sub in h.SubHardware) Atualizar(sub);
    }

    private static bool EhGpu(IHardware h) =>
        h.HardwareType is HardwareType.GpuNvidia or HardwareType.GpuAmd or HardwareType.GpuIntel;

    private static IEnumerable<ISensor> TodosSensores(IHardware h) =>
        h.Sensors.Concat(h.SubHardware.SelectMany(TodosSensores));

    /// <summary>
    /// Sensor do tipo pelo nome, na ordem de preferência: primeiro o nome exato, depois o que
    /// contém o nome ("Memory Used" não pode pegar "Virtual Memory Used"). Potência e clock
    /// zerados contam como "sem leitura" (é o que a biblioteca devolve sem o driver).
    /// </summary>
    private static float? Achar(IHardware h, SensorType tipo, params string[] nomes)
    {
        var sensores = TodosSensores(h)
            .Where(s => s.SensorType == tipo && s.Value.HasValue)
            .Where(s => s.Value > 0 || tipo is not (SensorType.Power or SensorType.Clock))
            .ToList();
        foreach (var nome in nomes)
        {
            var s = sensores.FirstOrDefault(x => x.Name.Equals(nome, StringComparison.OrdinalIgnoreCase))
                    ?? sensores.FirstOrDefault(x => x.Name.Contains(nome, StringComparison.OrdinalIgnoreCase));
            if (s is not null) return s.Value;
        }
        return null;
    }

    private static CpuSensores LerCpu(IHardware cpu)
    {
        var todos = TodosSensores(cpu).ToList();
        var clocks = todos
            .Where(s => s.SensorType == SensorType.Clock && s.Value > 0 && s.Name.StartsWith("Core", StringComparison.OrdinalIgnoreCase))
            .Select(s => s.Value!.Value)
            .ToList();
        var tempsNucleo = todos
            .Where(s => s.SensorType == SensorType.Temperature && s.Value > 0 && s.Name.StartsWith("Core #", StringComparison.OrdinalIgnoreCase))
            .Select(s => s.Value!.Value)
            .ToList();

        // Sem o driver PawnIO não há clock por núcleo: usa o mesmo cálculo do Gerenciador de
        // Tarefas (clock base × "% de desempenho do processador").
        var fonteClock = "sensor";
        if (clocks.Count == 0 && ClockPeloWindows() is { } mhz)
        {
            clocks.Add(mhz);
            fonteClock = "windows";
        }

        return new CpuSensores
        {
            Nome = cpu.Name,
            FonteClock = clocks.Count > 0 ? fonteClock : null,
            TempC = Achar(cpu, SensorType.Temperature, "Package", "Tctl/Tdie", "Tdie", "Core (Tctl", "Core Average", "Core Max")
                    ?? (tempsNucleo.Count > 0 ? tempsNucleo.Max() : null),
            ClockMHz = clocks.Count > 0 ? clocks.Average() : null,
            ClockMaxMHz = clocks.Count > 0 ? clocks.Max() : null,
            CargaPct = Achar(cpu, SensorType.Load, "CPU Total"),
            PotenciaW = Achar(cpu, SensorType.Power, "Package", "CPU Cores"),
            TensaoV = Achar(cpu, SensorType.Voltage, "Core (SVI2", "Vcore", "Core"),
        };
    }

    private static readonly Lazy<double?> ClockBase = new(() =>
    {
        try
        {
            using var busca = new System.Management.ManagementObjectSearcher("SELECT MaxClockSpeed FROM Win32_Processor");
            return busca.Get().Cast<System.Management.ManagementObject>().Select(o => Convert.ToDouble(o["MaxClockSpeed"])).FirstOrDefault();
        }
        catch { return null; }
    });

    private static float? ClockPeloWindows()
    {
        try
        {
            if (ClockBase.Value is not > 0) return null;
            using var busca = new System.Management.ManagementObjectSearcher(
                "SELECT PercentProcessorPerformance FROM Win32_PerfFormattedData_Counters_ProcessorInformation WHERE Name='_Total'");
            var pct = busca.Get().Cast<System.Management.ManagementObject>().Select(o => Convert.ToDouble(o["PercentProcessorPerformance"])).FirstOrDefault();
            return pct > 0 ? (float)(ClockBase.Value * pct / 100) : null;
        }
        catch { return null; }
    }

    private static GpuSensores LerGpu(IHardware gpu) => new()
    {
        Nome = gpu.Name,
        TempC = Achar(gpu, SensorType.Temperature, "GPU Core", "GPU"),
        HotspotC = Achar(gpu, SensorType.Temperature, "Hot Spot"),
        ClockMHz = Achar(gpu, SensorType.Clock, "GPU Core"),
        ClockMemoriaMHz = Achar(gpu, SensorType.Clock, "GPU Memory"),
        CargaPct = Achar(gpu, SensorType.Load, "GPU Core", "D3D 3D"),
        PotenciaW = Achar(gpu, SensorType.Power, "GPU Package", "GPU Power", "GPU Core", "GPU"),
        VentoinhaRpm = Achar(gpu, SensorType.Fan, "GPU", "Fan"),
        MemoriaUsadaMB = Achar(gpu, SensorType.SmallData, "GPU Memory Used", "D3D Dedicated Memory Used"),
    };

    private static MemoriaSensores LerMemoria(IHardware mem)
    {
        // Os pentes (via SPD) aparecem como sub-hardware quando o driver PawnIO está instalado.
        var pentes = mem.SubHardware
            .Select(p => Achar(p, SensorType.Temperature, "Temperature", "DIMM"))
            .Where(t => t.HasValue)
            .Select(t => t!.Value)
            .ToList();
        return new MemoriaSensores
        {
            CargaPct = Achar(mem, SensorType.Load, "Memory"),
            UsadaGB = Achar(mem, SensorType.Data, "Memory Used", "Used"),
            LivreGB = Achar(mem, SensorType.Data, "Memory Available", "Available"),
            TempC = pentes.Count > 0 ? pentes.Max() : null,
        };
    }

    private static DiscoSensores LerDisco(IHardware disco) => new()
    {
        Nome = disco.Name,
        TempC = Achar(disco, SensorType.Temperature, "Temperature", "Composite"),
        VidaRestantePct = Achar(disco, SensorType.Level, "Remaining Life", "Available Spare"),
        UsoPct = Achar(disco, SensorType.Load, "Total Activity", "Used Space"),
        LeituraMBs = Achar(disco, SensorType.Throughput, "Read Rate") is { } l ? l / 1e6f : null,
        EscritaMBs = Achar(disco, SensorType.Throughput, "Write Rate") is { } e ? e / 1e6f : null,
    };

    public void Dispose()
    {
        ligado = false;
        thread.Join(2000);
        lock (computador) computador.Close();
    }
}

public sealed record FotoSensores
{
    public DateTimeOffset Instante { get; init; }
    public CpuSensores? Cpu { get; init; }
    public GpuSensores[] Gpus { get; init; } = [];
    public MemoriaSensores? Memoria { get; init; }
    public DiscoSensores[] Discos { get; init; } = [];
}

public sealed record CpuSensores
{
    public string Nome { get; init; } = "";
    public float? TempC { get; init; }
    public float? ClockMHz { get; init; }
    public float? ClockMaxMHz { get; init; }
    /// <summary>"sensor" (por núcleo, via driver) ou "windows" (contador de desempenho).</summary>
    public string? FonteClock { get; init; }
    public float? CargaPct { get; init; }
    public float? PotenciaW { get; init; }
    public float? TensaoV { get; init; }
}

public sealed record GpuSensores
{
    public string Nome { get; init; } = "";
    public float? TempC { get; init; }
    public float? HotspotC { get; init; }
    public float? ClockMHz { get; init; }
    public float? ClockMemoriaMHz { get; init; }
    public float? CargaPct { get; init; }
    public float? PotenciaW { get; init; }
    public float? VentoinhaRpm { get; init; }
    public float? MemoriaUsadaMB { get; init; }
}

public sealed record MemoriaSensores
{
    public float? CargaPct { get; init; }
    public float? UsadaGB { get; init; }
    public float? LivreGB { get; init; }
    public float? TempC { get; init; }
}

public sealed record DiscoSensores
{
    public string Nome { get; init; } = "";
    public float? TempC { get; init; }
    public float? VidaRestantePct { get; init; }
    public float? UsoPct { get; init; }
    public float? LeituraMBs { get; init; }
    public float? EscritaMBs { get; init; }
}
