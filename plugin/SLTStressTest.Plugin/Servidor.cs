using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace SLTStressTest.Plugin;

/// <summary>
/// O servidor que o site enxerga, só em 127.0.0.1.
///
/// Três travas: só aceita conexões do próprio computador; só responde às origens do site
/// (qualquer outra é recusada antes de executar algo); e as rotas que mudam algo exigem um
/// cabeçalho próprio, o que obriga o navegador a pedir permissão antes (preflight).
/// </summary>
public sealed class Servidor(Sensores sensores, BenchmarkDisco benchmark) : IAsyncDisposable
{
    public const int Porta = 5299;
    public const int Protocolo = 1;
    public const string CabecalhoObrigatorio = "X-SLT-Plugin";

    private static readonly HashSet<string> Origens = new(StringComparer.OrdinalIgnoreCase)
    {
        "https://stresstest.smellsliketech.com.br",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    };

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
    };

    private WebApplication? app;

    public async Task IniciarAsync()
    {
        var construtor = WebApplication.CreateSlimBuilder();
        construtor.Logging.ClearProviders();
        construtor.WebHost.ConfigureKestrel(k => k.Listen(IPAddress.Loopback, Porta));
        construtor.Services.AddRouting();
        construtor.Services.ConfigureHttpJsonOptions(o =>
        {
            o.SerializerOptions.DefaultIgnoreCondition = Json.DefaultIgnoreCondition;
            o.SerializerOptions.NumberHandling = Json.NumberHandling;
        });

        app = construtor.Build();
        app.Use(Guarda);

        app.MapGet("/v1/ola", () => Results.Ok(new
        {
            // Só unidades que estão num disco físico: Google Drive, OneDrive e afins são
            // virtuais e não fazem sentido no teste de disco.
            unidades = Unidades(),
            nome = "SLT Stress Test Plugin",
            versao = typeof(Servidor).Assembly.GetName().Version?.ToString(3),
            protocolo = Protocolo,
            administrador = Inventario.EhAdministrador(),
            pawnio = Inventario.PawnIoInstalado(),
            cpu = sensores.NomeCpu,
            cpuDetalhes = Inventario.Cpu(),
            gpus = sensores.NomesGpu,
            memoria = Inventario.Pentes(),
        }));
        app.MapGet("/v1/sensores", () => Results.Ok(sensores.Atual()));
        app.MapGet("/v1/discos", () => Results.Ok(Inventario.Discos()));
        app.MapGet("/v1/disco/benchmark", () => Results.Ok(benchmark.Estado));
        app.MapPost("/v1/disco/benchmark", (PedidoBenchmark pedido) =>
        {
            var unidade = (pedido.Unidade ?? "C:").TrimEnd('\\');
            if (!Unidades().Any(u => string.Equals(u.Letra, unidade, StringComparison.OrdinalIgnoreCase)))
                return Results.BadRequest(new { erro = $"{unidade} não é um disco físico deste computador." });
            var erro = benchmark.Iniciar(unidade, pedido.Mib ?? 1024, pedido.Segundos ?? 5, pedido.Ciclos ?? 1);
            return erro is null ? Results.Accepted("/v1/disco/benchmark", benchmark.Estado) : Results.BadRequest(new { erro });
        });
        app.MapPost("/v1/disco/benchmark/cancelar", () =>
        {
            benchmark.Cancelar();
            return Results.Ok(benchmark.Estado);
        });

        await app.StartAsync();
    }

    public sealed record Unidade(string Letra, string? Rotulo, double LivreGB, double TotalGB);

    private static Unidade[] Unidades()
    {
        var fisicas = Inventario.Discos().SelectMany(d => d.Letras).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return DriveInfo.GetDrives()
            .Where(d => d.IsReady && d.DriveType is DriveType.Fixed or DriveType.Removable)
            .Where(d => fisicas.Count == 0 || fisicas.Contains(d.Name.TrimEnd('\\')))
            .Select(d => new Unidade(d.Name.TrimEnd('\\'), d.VolumeLabel, d.AvailableFreeSpace / 1e9, d.TotalSize / 1e9))
            .ToArray();
    }

    public sealed record PedidoBenchmark(string? Unidade, int? Mib, int? Segundos, int? Ciclos);

    private static async Task Guarda(HttpContext ctx, Func<Task> proximo)
    {
        ctx.Response.Headers.CacheControl = "no-store";
        ctx.Response.Headers.XContentTypeOptions = "nosniff";

        var remoto = ctx.Connection.RemoteIpAddress;
        if (remoto is not null && !IPAddress.IsLoopback(remoto))
        {
            await Recusar(ctx, 403, "O plugin só atende pedidos feitos neste computador.");
            return;
        }

        // Host diferente de 127.0.0.1/localhost indica DNS rebinding: recusa.
        var host = ctx.Request.Host.Host;
        if (host is not ("127.0.0.1" or "localhost" or "[::1]" or "::1"))
        {
            await Recusar(ctx, 403, "Endereço não autorizado.");
            return;
        }

        var origem = ctx.Request.Headers.Origin.ToString();
        var autorizada = origem.Length > 0 && Origens.Contains(origem);
        if (origem.Length > 0 && !autorizada)
        {
            await Recusar(ctx, 403, "Este site não tem permissão para usar o plugin.");
            return;
        }

        if (autorizada)
        {
            ctx.Response.Headers.AccessControlAllowOrigin = origem;
            ctx.Response.Headers.Append("Vary", "Origin");
            // Chrome: página pública acessando a rede local precisa desta confirmação.
            if (string.Equals(ctx.Request.Headers["Access-Control-Request-Private-Network"], "true", StringComparison.OrdinalIgnoreCase))
                ctx.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
        }

        if (HttpMethods.IsOptions(ctx.Request.Method))
        {
            if (!autorizada) { ctx.Response.StatusCode = 403; return; }
            ctx.Response.Headers.AccessControlAllowMethods = "GET, POST, OPTIONS";
            ctx.Response.Headers.AccessControlAllowHeaders = $"Content-Type, {CabecalhoObrigatorio}";
            ctx.Response.Headers.AccessControlMaxAge = "600";
            ctx.Response.StatusCode = 204;
            return;
        }

        if (!HttpMethods.IsGet(ctx.Request.Method) && !ctx.Request.Headers.ContainsKey(CabecalhoObrigatorio))
        {
            await Recusar(ctx, 400, $"Falta o cabeçalho {CabecalhoObrigatorio}.");
            return;
        }

        await proximo();
    }

    private static async Task Recusar(HttpContext ctx, int status, string mensagem)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json; charset=utf-8";
        await ctx.Response.Body.WriteAsync(JsonSerializer.SerializeToUtf8Bytes(new { erro = mensagem }, Json));
    }

    public async ValueTask DisposeAsync()
    {
        if (app is not null) await app.DisposeAsync();
    }
}
