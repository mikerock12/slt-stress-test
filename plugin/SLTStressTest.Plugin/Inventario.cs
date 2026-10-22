using System.Management;
using System.Security.Principal;
using Microsoft.Win32;

namespace SLTStressTest.Plugin;

/// <summary>
/// Dados fixos e de saúde vindos do próprio Windows (WMI): pentes de memória com frequência,
/// e discos com o estado de saúde e os contadores de confiabilidade (o SMART que o Windows
/// já interpreta). Não precisa do driver PawnIO, só de administrador para os contadores.
/// </summary>
public static class Inventario
{
    public static bool EhAdministrador()
    {
        using var id = WindowsIdentity.GetCurrent();
        return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
    }

    /// <summary>O PawnIO é o driver que libera temperatura e clock da CPU e o SPD da memória.</summary>
    public static bool PawnIoInstalado()
    {
        using var chave = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\PawnIO");
        return chave is not null;
    }

    public static PenteMemoria[] Pentes()
    {
        var lista = new List<PenteMemoria>();
        try
        {
            using var busca = new ManagementObjectSearcher(
                "SELECT BankLabel, DeviceLocator, Manufacturer, PartNumber, Capacity, Speed, ConfiguredClockSpeed, SMBIOSMemoryType FROM Win32_PhysicalMemory");
            foreach (var o in busca.Get().Cast<ManagementObject>())
            {
                lista.Add(new PenteMemoria
                {
                    Slot = Texto(o["DeviceLocator"]) ?? Texto(o["BankLabel"]) ?? "?",
                    Fabricante = Texto(o["Manufacturer"]),
                    Modelo = Texto(o["PartNumber"]),
                    CapacidadeGB = Numero(o["Capacity"]) / 1024d / 1024 / 1024,
                    VelocidadeMTs = (int?)Numero(o["Speed"]),
                    ConfiguradaMTs = (int?)Numero(o["ConfiguredClockSpeed"]),
                    Tipo = TipoMemoria((int?)Numero(o["SMBIOSMemoryType"])),
                });
            }
        }
        catch { /* WMI indisponível: segue sem os pentes */ }
        return [.. lista];
    }

    public static DiscoFisico[] Discos()
    {
        var discos = new List<DiscoFisico>();
        var escopo = new ManagementScope(@"\\.\root\Microsoft\Windows\Storage");
        try
        {
            var letras = LetrasPorDisco(escopo);
            using var busca = new ManagementObjectSearcher(escopo, new ObjectQuery(
                "SELECT ObjectId, DeviceId, FriendlyName, MediaType, BusType, HealthStatus, Size, FirmwareVersion FROM MSFT_PhysicalDisk"));
            foreach (var o in busca.Get().Cast<ManagementObject>())
            {
                var id = Texto(o["DeviceId"]) ?? "";
                var c = LerContador(o);
                var saude = (int?)Numero(o["HealthStatus"]) switch { 0 => "saudavel", 1 => "aviso", 2 => "ruim", _ => "desconhecida" };
                discos.Add(new DiscoFisico
                {
                    Numero = id,
                    Nome = Texto(o["FriendlyName"]) ?? "Disco",
                    Tipo = (int?)Numero(o["MediaType"]) switch { 3 => "HDD", 4 => "SSD", 5 => "SCM", _ => "desconhecido" },
                    Barramento = (int?)Numero(o["BusType"]) switch { 17 => "NVMe", 11 => "SATA", 7 => "USB", 8 => "RAID", 10 => "SAS", _ => "outro" },
                    Firmware = Texto(o["FirmwareVersion"]),
                    TamanhoGB = Numero(o["Size"]) / 1e9,
                    Letras = letras.TryGetValue(id, out var l) ? [.. l] : [],
                    SaudeWindows = saude,
                    TempC = c?.Temp,
                    TempMaxC = c?.TempMax,
                    DesgastePct = c?.Desgaste,
                    HorasLigado = c?.Horas,
                    ErrosLeitura = c?.ErrosLeitura,
                    ErrosEscrita = c?.ErrosEscrita,
                    ErrosNaoCorrigidos = c?.NaoCorrigidos,
                });
            }
        }
        catch { /* sem acesso ao namespace de armazenamento */ }

        foreach (var d in discos) d.Avaliacao = Avaliar(d);
        return [.. discos.OrderBy(d => d.Numero)];
    }

    /// <summary>
    /// Mesma ideia do CrystalDiskInfo: Bom / Cuidado / Ruim, a partir do que o disco relata.
    /// </summary>
    public static AvaliacaoDisco Avaliar(DiscoFisico d)
    {
        var motivos = new List<string>();
        var estado = "bom";
        void Piorar(string novo, string motivo)
        {
            motivos.Add(motivo);
            if (novo == "ruim" || estado == "bom") estado = novo;
        }

        if (d.SaudeWindows == "ruim") Piorar("ruim", "O próprio disco informa que está com falha (SMART). Faça backup imediatamente.");
        else if (d.SaudeWindows == "aviso") Piorar("cuidado", "O disco emitiu um aviso de saúde (SMART). Faça backup e acompanhe.");
        if (d.ErrosNaoCorrigidos > 0) Piorar("ruim", $"{d.ErrosNaoCorrigidos} erro(s) de leitura não corrigidos: há setores que perderam dados.");
        if (d.DesgastePct >= 100) Piorar("ruim", "O SSD passou da vida útil estimada pelo fabricante.");
        else if (d.DesgastePct >= 90) Piorar("cuidado", $"O SSD já usou {d.DesgastePct}% da vida útil estimada.");
        if (d.TempMaxC >= 70) Piorar("cuidado", $"Temperatura máxima registrada de {d.TempMaxC} °C: o disco já trabalhou muito quente.");
        if (motivos.Count == 0) motivos.Add("Nenhum alerta de saúde informado pelo disco.");
        return new AvaliacaoDisco(estado, motivos.ToArray());
    }

    private sealed record Contador(int? Temp, int? TempMax, int? Desgaste, long? Horas, long? ErrosLeitura, long? ErrosEscrita, long? NaoCorrigidos);

    // Os contadores só aparecem pela associação com o disco (é o que o
    // Get-StorageReliabilityCounter faz); listar a classe direto volta vazio.
    private static Contador? LerContador(ManagementObject disco)
    {
        try
        {
            foreach (var o in disco.GetRelated("MSFT_StorageReliabilityCounter").Cast<ManagementObject>())
            {
                // Zero em temperatura significa "o disco não informa".
                return new Contador(
                    Opcional(o["Temperature"]) is > 0 and var t ? (int)t : null,
                    Opcional(o["TemperatureMax"]) is > 0 and var tm ? (int)tm : null,
                    (int?)Opcional(o["Wear"]),
                    (long?)Opcional(o["PowerOnHours"]),
                    (long?)Opcional(o["ReadErrorsTotal"]),
                    (long?)Opcional(o["WriteErrorsTotal"]),
                    (long?)Opcional(o["ReadErrorsUncorrected"]));
            }
        }
        catch { /* contadores exigem administrador */ }
        return null;
    }

    private static Dictionary<string, List<string>> LetrasPorDisco(ManagementScope escopo)
    {
        var mapa = new Dictionary<string, List<string>>();
        using var busca = new ManagementObjectSearcher(escopo, new ObjectQuery("SELECT DiskNumber, DriveLetter FROM MSFT_Partition"));
        foreach (var o in busca.Get().Cast<ManagementObject>())
        {
            var letra = o["DriveLetter"] is char c && c != '\0' ? $"{c}:" : null;
            if (o["DriveLetter"] is ushort u && u != 0) letra = $"{(char)u}:";
            if (letra is null) continue;
            var disco = Numero(o["DiskNumber"]).ToString("0");
            (mapa.TryGetValue(disco, out var l) ? l : mapa[disco] = []).Add(letra);
        }
        return mapa;
    }

    private static string TipoMemoria(int? smbios) => smbios switch
    {
        20 => "DDR", 21 => "DDR2", 24 => "DDR3", 26 => "DDR4", 30 => "LPDDR4", 34 => "DDR5", 35 => "LPDDR5",
        _ => "desconhecido",
    };

    private static string? Texto(object? valor)
    {
        var t = valor?.ToString()?.Trim();
        return string.IsNullOrEmpty(t) ? null : t;
    }

    private static double Numero(object? valor) => valor is null ? 0 : Convert.ToDouble(valor);

    private static double? Opcional(object? valor) => valor is null ? null : Convert.ToDouble(valor);
}

public sealed record PenteMemoria
{
    public string Slot { get; init; } = "";
    public string? Fabricante { get; init; }
    public string? Modelo { get; init; }
    public double CapacidadeGB { get; init; }
    public int? VelocidadeMTs { get; init; }
    public int? ConfiguradaMTs { get; init; }
    public string Tipo { get; init; } = "";
}

public sealed class DiscoFisico
{
    public string Numero { get; init; } = "";
    public string Nome { get; init; } = "";
    public string Tipo { get; init; } = "";
    public string Barramento { get; init; } = "";
    public string? Firmware { get; init; }
    public double TamanhoGB { get; init; }
    public string[] Letras { get; init; } = [];
    public string SaudeWindows { get; init; } = "";
    public int? TempC { get; init; }
    public int? TempMaxC { get; init; }
    public int? DesgastePct { get; init; }
    public long? HorasLigado { get; init; }
    public long? ErrosLeitura { get; init; }
    public long? ErrosEscrita { get; init; }
    public long? ErrosNaoCorrigidos { get; init; }
    public AvaliacaoDisco? Avaliacao { get; set; }
}

public sealed record AvaliacaoDisco(string Estado, string[] Motivos);
