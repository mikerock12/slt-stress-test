using System.Diagnostics;
using System.Windows.Forms;

namespace SLTStressTest.Plugin;

/// <summary>
/// O plugin do SLT Stress Test: liga o site aos sensores reais desta máquina (temperatura,
/// clocks, potência, frequência da memória, SMART) e roda o benchmark de disco sem cache.
/// Não abre janela: fica um ícone perto do relógio.
/// </summary>
internal static class Program
{
    private const string Site = "https://stresstest.smellsliketech.com.br";

    [STAThread]
    private static int Main()
    {
        // Duas cópias disputariam a mesma porta: a segunda só abre o site e sai.
        using var trava = new Mutex(true, @"Local\SLTStressTestPlugin", out var primeira);
        if (!primeira)
        {
            Abrir(Site);
            return 0;
        }

        ApplicationConfiguration.Initialize();

        Sensores? sensores = null;
        Servidor? servidor = null;
        var benchmark = new BenchmarkDisco();
        NotifyIcon? icone = null;

        try
        {
            sensores = new Sensores();
            servidor = new Servidor(sensores, benchmark);
            servidor.IniciarAsync().GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Não foi possível iniciar o plugin.\n\n{ex.Message}\n\nSe outro programa estiver usando a porta {Servidor.Porta}, feche-o e tente de novo.",
                "SLT Stress Test Plugin", MessageBoxButtons.OK, MessageBoxIcon.Error);
            sensores?.Dispose();
            return 1;
        }

        var menu = new ContextMenuStrip();
        menu.Items.Add("Abrir o SLT Stress Test", null, (_, _) => Abrir(Site));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add($"Conectado em 127.0.0.1:{Servidor.Porta}").Enabled = false;
        if (!Inventario.PawnIoInstalado())
        {
            menu.Items.Add("Instalar driver PawnIO (temperatura da CPU)…", null, (_, _) => Abrir("https://pawnio.eu/"));
        }
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Sair", null, (_, _) => Application.Exit());

        using var stream = typeof(Program).Assembly.GetManifestResourceStream("icone.ico");
        icone = new NotifyIcon
        {
            Icon = stream is null ? SystemIcons.Application : new Icon(stream),
            Text = "SLT Stress Test Plugin — ligado",
            Visible = true,
            ContextMenuStrip = menu,
        };
        icone.DoubleClick += (_, _) => Abrir(Site);
        icone.BalloonTipTitle = "SLT Stress Test Plugin ligado";
        icone.BalloonTipText = Inventario.PawnIoInstalado()
            ? "Volte ao site: os sensores reais já aparecem no teste."
            : "Volte ao site. Para a temperatura da CPU, instale o driver PawnIO pelo menu deste ícone.";
        icone.ShowBalloonTip(6000);

        Application.Run();

        icone.Visible = false;
        icone.Dispose();
        benchmark.Cancelar();
        servidor.DisposeAsync().AsTask().GetAwaiter().GetResult();
        sensores.Dispose();
        return 0;
    }

    private static void Abrir(string endereco)
    {
        try { Process.Start(new ProcessStartInfo(endereco) { UseShellExecute = true })?.Dispose(); }
        catch { /* sem navegador padrão */ }
    }
}
