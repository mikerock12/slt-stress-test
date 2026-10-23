using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SLTStressTest.Plugin;

/// <summary>Driver oficial x64 assinado, sem modificar binários ou segurança do Windows.</summary>
internal static class PawnIoEmbutido
{
    private const string Prefixo = "PawnIO.";
    internal static string Pasta => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Smells Like Tech", "SLT Stress Test", "PawnIO-2.2.0");
    private static byte[] Recurso(string nome)
    {
        using var s = typeof(PawnIoEmbutido).Assembly.GetManifestResourceStream(Prefixo + nome) ?? throw new IOException("Recurso do PawnIO ausente: " + nome);
        using var m = new MemoryStream(); s.CopyTo(m); return m.ToArray();
    }
    internal static void VerificarPacote()
    {
        var manifesto = JsonSerializer.Deserialize<Dictionary<string, string>>(Recurso("SHA256SUMS.json"))!;
        string[] obrigatorios = ["PawnIO.sys", "PawnIO.inf", "pawnio.cat", "fontes.zip", "COPYING", "AVISO-ORIGINAL.md", "LGPL-2.1.txt"];
        if (!manifesto.Keys.ToHashSet().SetEquals(obrigatorios)) throw new IOException("Manifesto do PawnIO incompleto.");
        if (Convert.ToHexString(SHA256.HashData(Recurso("PawnIO.sys"))).ToLowerInvariant() != "fca6e7d58b0cf38dbb913a2b9e532f48629145d395f454b16a9f58e97b8d3940") throw new IOException("Driver diferente da distribuição oficial x64 2.2.0.");
        foreach (var (nome, hash) in manifesto)
            if (!string.Equals(Convert.ToHexString(SHA256.HashData(Recurso(nome))), hash, StringComparison.OrdinalIgnoreCase)) throw new IOException("Integridade do PawnIO inválida: " + nome);
    }
    private static void Extrair()
    {
        VerificarPacote();
        Directory.CreateDirectory(Pasta);
        for (var dir = new DirectoryInfo(Pasta); dir is not null; dir = dir.Parent)
            if ((dir.Attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("Pasta do driver não pode ser um redirecionamento.");
        var manifesto = JsonSerializer.Deserialize<Dictionary<string, string>>(Recurso("SHA256SUMS.json"))!;
        foreach (var nome in manifesto.Keys)
        {
            if (Path.GetFileName(nome) != nome) throw new IOException("Nome de recurso inválido.");
            var caminho = Path.Combine(Pasta, nome);
            if (File.Exists(caminho) && (File.GetAttributes(caminho) & FileAttributes.ReparsePoint) != 0) throw new IOException("Arquivo do driver não pode ser um link.");
            File.WriteAllBytes(caminho, Recurso(nome));
        }
        File.WriteAllBytes(Path.Combine(Pasta, "SHA256SUMS.json"), Recurso("SHA256SUMS.json"));
    }
    internal static void OferecerInstalacao()
    {
        if (Inventario.PawnIoInstalado()) return;
        using var janela = new Form { Text = "PawnIO incluído — licença e instalação", Width = 760, Height = 620, StartPosition = FormStartPosition.CenterScreen };
        var texto = new TextBox { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill,
            Text = "O plugin inclui o driver oficial PawnIO 2.2.0 x64, de namazso, assinado pela Microsoft. Ao continuar, o Windows instalará e configurará o driver localmente, sem download separado. Exige Windows 10 1809 ou posterior. Não desativa assinatura de drivers nem proteção do Windows. O driver permanece instalado ao fechar o plugin; pode ser removido pelo Gerenciador de Dispositivos (Dispositivos de software > PawnIO).\r\n\r\n" +
                   "Copyright (C) 2026 namazso. Driver GPL-2.0 ou posterior com exceção de ligação; módulos PawnIO 0.1.6 usados pela biblioteca sob LGPL-2.1 ou posterior. Fontes completos, submódulo, avisos e licenças serão preservados junto ao driver em Arquivos de Programas. O código do plugin continua MIT.\r\n\r\n" +
                   Encoding.UTF8.GetString(Recurso("AVISO-ORIGINAL.md")) + "\r\n\r\n" + Encoding.UTF8.GetString(Recurso("COPYING")) };
        var acoes = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 55, FlowDirection = FlowDirection.RightToLeft };
        var instalar = new Button { Text = "Aceitar e instalar", AutoSize = true, DialogResult = DialogResult.OK };
        var pular = new Button { Text = "Continuar sem driver", AutoSize = true, DialogResult = DialogResult.Cancel };
        acoes.Controls.Add(instalar); acoes.Controls.Add(pular); janela.Controls.Add(texto); janela.Controls.Add(acoes); janela.CancelButton = pular;
        if (janela.ShowDialog() != DialogResult.OK) return;
        try
        {
            var reiniciar = InstalarComAceite();
            MessageBox.Show(reiniciar ? "Driver instalado. Reinicie o Windows para concluir; o plugin continuará com os sensores disponíveis." : "Driver instalado e configurado. O plugin iniciará a leitura dos sensores disponíveis.", "PawnIO", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception erro) { MessageBox.Show("Não foi possível instalar o PawnIO. O plugin continuará sem esse driver.\r\n\r\n" + erro.Message, "PawnIO", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }
    // A opção de linha de comando só deve ser usada após aceitação expressa da licença.
    internal static bool InstalarComAceite()
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 17763) || RuntimeInformation.OSArchitecture != Architecture.X64) throw new PlatformNotSupportedException("O driver incluído exige Windows x64 10 1809 ou posterior.");
        if (!Inventario.EhAdministrador()) throw new UnauthorizedAccessException("A instalação exige administrador.");
        Extrair();
        return !Inventario.PawnIoInstalado() && InstalarDispositivo(Path.Combine(Pasta, "PawnIO.inf"));
    }
    internal static void AbrirCreditos()
    {
        try { Extrair(); Process.Start(new ProcessStartInfo(Pasta) { UseShellExecute = true })?.Dispose(); }
        catch (Exception erro) { MessageBox.Show(erro.Message, "Licenças e fontes do PawnIO"); }
    }

    // Equivalente à instalação PnP normal do Windows. Mantém INF/CAT/SYS originais e ACL do INF.
    private static bool InstalarDispositivo(string inf)
    {
        Guid classe = new("62f9c741-b25a-46ce-b54c-9bccce08b6f2");
        var lista = SetupDiCreateDeviceInfoList(ref classe, IntPtr.Zero);
        if (lista == new IntPtr(-1)) throw new Win32Exception();
        var dispositivo = new DadosDispositivo { Tamanho = (uint)Marshal.SizeOf<DadosDispositivo>() };
        var registrado = false;
        try
        {
            if (!SetupDiCreateDeviceInfo(lista, "PawnIO", ref classe, "PawnIO", IntPtr.Zero, 1, ref dispositivo)) throw new Win32Exception();
            var id = Encoding.Unicode.GetBytes("ROOT\\PawnIO\0\0");
            if (!SetupDiSetDeviceRegistryProperty(lista, ref dispositivo, 1, id, (uint)id.Length)) throw new Win32Exception();
            if (!SetupDiCallClassInstaller(0x19, lista, ref dispositivo)) throw new Win32Exception();
            registrado = true;
            if (!UpdateDriverForPlugAndPlayDevices(IntPtr.Zero, @"ROOT\PawnIO", inf, 0, out var reiniciar)) throw new Win32Exception();
            return reiniciar;
        }
        catch
        {
            if (registrado) SetupDiCallClassInstaller(5, lista, ref dispositivo); // remove só o dispositivo criado nesta tentativa
            throw;
        }
        finally { SetupDiDestroyDeviceInfoList(lista); }
    }
    [StructLayout(LayoutKind.Sequential)] private struct DadosDispositivo { public uint Tamanho; public Guid Classe; public uint DevInst; public UIntPtr Reservado; }
    [DllImport("setupapi.dll", SetLastError = true)] private static extern IntPtr SetupDiCreateDeviceInfoList(ref Guid classe, IntPtr janela);
    [DllImport("setupapi.dll", EntryPoint = "SetupDiCreateDeviceInfoW", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetupDiCreateDeviceInfo(IntPtr lista, string nome, ref Guid classe, string descricao, IntPtr janela, uint flags, ref DadosDispositivo dados);
    [DllImport("setupapi.dll", EntryPoint = "SetupDiSetDeviceRegistryPropertyW", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetupDiSetDeviceRegistryProperty(IntPtr lista, ref DadosDispositivo dados, uint propriedade, byte[] valor, uint tamanho);
    [DllImport("setupapi.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetupDiCallClassInstaller(uint funcao, IntPtr lista, ref DadosDispositivo dados);
    [DllImport("setupapi.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetupDiDestroyDeviceInfoList(IntPtr lista);
    [DllImport("newdev.dll", EntryPoint = "UpdateDriverForPlugAndPlayDevicesW", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool UpdateDriverForPlugAndPlayDevices(IntPtr janela, string id, string inf, uint flags, [MarshalAs(UnmanagedType.Bool)] out bool reiniciar);
}
