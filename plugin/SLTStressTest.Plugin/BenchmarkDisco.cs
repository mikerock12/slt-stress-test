using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace SLTStressTest.Plugin;

/// <summary>
/// Benchmark de disco de verdade, no estilo do CrystalDiskMark: arquivo temporário aberto
/// sem o cache do Windows (FILE_FLAG_NO_BUFFERING + WRITE_THROUGH), então cada leitura e
/// escrita vai até o disco. A fila (Q) é simulada com threads que fazem pedidos ao mesmo tempo.
///
/// Cada página de 4 KiB leva um carimbo com o próprio número; toda leitura confere o carimbo.
/// O arquivo é apagado no fim, inclusive se o teste for cancelado ou der erro.
/// </summary>
public sealed unsafe class BenchmarkDisco
{
    private const int Pagina = 4096;
    private const int Bloco = 1024 * 1024;
    private const FileOptions SemCache = (FileOptions)0x20000000;
    private const ulong Magico = 0x534C545354524553; // "SLTSTRES"

    public static readonly Fase[] Fases =
    [
        new("seq1mq8Leitura", "SEQ 1 MiB Q8 leitura", Bloco, 8, false, false),
        new("seq1mq8Escrita", "SEQ 1 MiB Q8 escrita", Bloco, 8, false, true),
        new("seq1mq1Leitura", "SEQ 1 MiB Q1 leitura", Bloco, 1, false, false),
        new("seq1mq1Escrita", "SEQ 1 MiB Q1 escrita", Bloco, 1, false, true),
        new("rnd4kq32Leitura", "RND 4 KiB Q32 leitura", Pagina, 32, true, false),
        new("rnd4kq32Escrita", "RND 4 KiB Q32 escrita", Pagina, 32, true, true),
        new("rnd4kq1Leitura", "RND 4 KiB Q1 leitura", Pagina, 1, true, false),
        new("rnd4kq1Escrita", "RND 4 KiB Q1 escrita", Pagina, 1, true, true),
    ];

    public sealed record Fase(string Id, string Nome, int Tamanho, int Fila, bool Aleatorio, bool Escrita);

    private readonly object trava = new();
    private CancellationTokenSource? cancelamento;
    private EstadoBenchmark estado = new() { Situacao = "ocioso" };
    private readonly byte[] modelo = new byte[Bloco];

    public BenchmarkDisco() => Random.Shared.NextBytes(modelo);

    public EstadoBenchmark Estado { get { lock (trava) return estado; } }

    public string? Iniciar(string unidade, int mib, int segundos, int ciclos)
    {
        unidade = unidade.TrimEnd('\\', '/');
        if (unidade.Length != 2 || unidade[1] != ':' || !char.IsLetter(unidade[0])) return "Unidade inválida.";
        var drive = DriveInfo.GetDrives().FirstOrDefault(d => d.IsReady && d.Name.StartsWith(unidade, StringComparison.OrdinalIgnoreCase));
        if (drive is null || drive.DriveType is not (DriveType.Fixed or DriveType.Removable)) return $"A unidade {unidade} não está disponível.";
        mib = Math.Clamp(mib, 64, 16 * 1024);
        segundos = Math.Clamp(segundos, 2, 60);
        ciclos = Math.Clamp(ciclos, 0, 10_000); // 0 = até cancelar
        if (drive.AvailableFreeSpace < (long)mib * Bloco + 1024L * Bloco) return $"Espaço livre insuficiente em {unidade} para um arquivo de {mib} MiB.";

        lock (trava)
        {
            if (estado.Situacao == "rodando") return "Já existe um benchmark em andamento.";
            cancelamento = new CancellationTokenSource();
            estado = new EstadoBenchmark { Situacao = "rodando", Unidade = unidade.ToUpperInvariant(), ArquivoMiB = mib, Fase = "preparando" };
        }
        var token = cancelamento.Token;
        _ = Task.Factory.StartNew(() => Rodar(unidade, mib, segundos, ciclos, token), TaskCreationOptions.LongRunning);
        return null;
    }

    public void Cancelar() => cancelamento?.Cancel();

    private void Atualizar(Func<EstadoBenchmark, EstadoBenchmark> mudar)
    {
        lock (trava) estado = mudar(estado);
    }

    private void Rodar(string unidade, int mib, int segundos, int ciclos, CancellationToken token)
    {
        var pasta = Path.Combine(unidade + Path.DirectorySeparatorChar, "SLTStressTest-temp");
        var caminho = Path.Combine(pasta, "teste.bin");
        long erros = 0;
        try
        {
            Directory.CreateDirectory(pasta);
            var tamanho = (long)mib * Bloco;
            using var arquivo = File.OpenHandle(caminho, FileMode.Create, FileAccess.ReadWrite, FileShare.None,
                FileOptions.WriteThrough | SemCache, tamanho);
            RandomAccess.SetLength(arquivo, tamanho);

            Preparar(arquivo, mib, token);

            for (var ciclo = 1; ciclos == 0 || ciclo <= ciclos; ciclo++)
            {
                foreach (var fase in Fases)
                {
                    token.ThrowIfCancellationRequested();
                    var (mbs, iops, errosFase) = Medir(arquivo, tamanho, fase, segundos, token);
                    erros += errosFase;
                    var c = ciclo;
                    Atualizar(e => e with
                    {
                        Ciclo = c,
                        Erros = erros,
                        Resultados = new Dictionary<string, ResultadoFase>(e.Resultados) { [fase.Id] = new(fase.Nome, mbs, iops) },
                    });
                }
            }
            Atualizar(e => e with { Situacao = "concluido", Fase = null, AtualMBs = null });
        }
        catch (OperationCanceledException)
        {
            Atualizar(e => e with { Situacao = "cancelado", Fase = null, AtualMBs = null });
        }
        catch (Exception ex)
        {
            Atualizar(e => e with { Situacao = "erro", Fase = null, AtualMBs = null, Erro = ex.Message });
        }
        finally
        {
            try { File.Delete(caminho); } catch { /* tenta de novo abaixo */ }
            try { Directory.Delete(pasta, recursive: true); } catch { /* pasta em uso */ }
        }
    }

    /// <summary>Escreve o arquivo inteiro uma vez, com os carimbos, antes de medir.</summary>
    private void Preparar(SafeFileHandle arquivo, int mib, CancellationToken token)
    {
        var buffer = (byte*)NativeMemory.AlignedAlloc(Bloco, Pagina);
        try
        {
            for (var b = 0; b < mib; b++)
            {
                token.ThrowIfCancellationRequested();
                Montar(buffer, Bloco, (long)b * Bloco);
                RandomAccess.Write(arquivo, new ReadOnlySpan<byte>(buffer, Bloco), (long)b * Bloco);
                if (b % 16 == 0)
                {
                    var pct = b * 100.0 / mib;
                    Atualizar(e => e with { Fase = "preparando", Progresso = pct });
                }
            }
        }
        finally { NativeMemory.AlignedFree(buffer); }
    }

    private void Montar(byte* buffer, int tamanho, long offset)
    {
        var inicioModelo = (int)(offset % Bloco);
        new ReadOnlySpan<byte>(modelo, inicioModelo, tamanho).CopyTo(new Span<byte>(buffer, tamanho));
        for (var p = 0; p < tamanho; p += Pagina) *(ulong*)(buffer + p) = (ulong)((offset + p) / Pagina) ^ Magico;
    }

    private static int Conferir(byte* buffer, int tamanho, long offset)
    {
        var ruins = 0;
        for (var p = 0; p < tamanho; p += Pagina)
            if (*(ulong*)(buffer + p) != ((ulong)((offset + p) / Pagina) ^ Magico)) ruins++;
        return ruins;
    }

    private (double mbs, double iops, long erros) Medir(SafeFileHandle arquivo, long tamanho, Fase fase, int segundos, CancellationToken token)
    {
        var unidades = tamanho / fase.Tamanho;
        long proximo = -1;
        long bytes = 0;
        long ops = 0;
        long erros = 0;
        var relogio = Stopwatch.StartNew();
        var limite = TimeSpan.FromSeconds(segundos);

        var threads = Enumerable.Range(0, fase.Fila).Select(i => new Thread(() =>
        {
            var buffer = (byte*)NativeMemory.AlignedAlloc((nuint)fase.Tamanho, Pagina);
            var aleatorio = new Random(Environment.TickCount ^ (i * 7919));
            try
            {
                while (relogio.Elapsed < limite && !token.IsCancellationRequested)
                {
                    var indice = fase.Aleatorio
                        ? aleatorio.NextInt64(unidades)
                        : Interlocked.Increment(ref proximo) % unidades;
                    var offset = indice * fase.Tamanho;
                    if (fase.Escrita)
                    {
                        Montar(buffer, fase.Tamanho, offset);
                        RandomAccess.Write(arquivo, new ReadOnlySpan<byte>(buffer, fase.Tamanho), offset);
                    }
                    else
                    {
                        RandomAccess.Read(arquivo, new Span<byte>(buffer, fase.Tamanho), offset);
                        var ruins = Conferir(buffer, fase.Tamanho, offset);
                        if (ruins > 0) Interlocked.Add(ref erros, ruins);
                    }
                    Interlocked.Add(ref bytes, fase.Tamanho);
                    Interlocked.Increment(ref ops);
                }
            }
            finally { NativeMemory.AlignedFree(buffer); }
        }) { IsBackground = true }).ToList();

        foreach (var t in threads) t.Start();
        while (threads.Any(t => t.IsAlive))
        {
            Thread.Sleep(250);
            var s = relogio.Elapsed.TotalSeconds;
            var parcial = s > 0 ? Interlocked.Read(ref bytes) / s / 1e6 : 0;
            Atualizar(e => e with { Fase = fase.Id, NomeFase = fase.Nome, AtualMBs = parcial, Progresso = Math.Min(100, s * 100 / segundos) });
        }
        token.ThrowIfCancellationRequested();
        var total = relogio.Elapsed.TotalSeconds;
        return (bytes / total / 1e6, ops / total, erros);
    }
}

public sealed record EstadoBenchmark
{
    public string Situacao { get; init; } = "ocioso";
    public string? Unidade { get; init; }
    public int ArquivoMiB { get; init; }
    public string? Fase { get; init; }
    public string? NomeFase { get; init; }
    public double Progresso { get; init; }
    public double? AtualMBs { get; init; }
    public int Ciclo { get; init; }
    public long Erros { get; init; }
    public string? Erro { get; init; }
    public Dictionary<string, ResultadoFase> Resultados { get; init; } = [];
}

public sealed record ResultadoFase(string Nome, double Mbs, double Iops);
