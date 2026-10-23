package br.com.smellsliketech.stresstest;

import android.app.ActivityManager;
import android.content.*;
import android.os.*;
import org.json.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;

final class ColetaHardware {
    private final Context ctx;
    ColetaHardware(Context ctx) { this.ctx = ctx; }
    static boolean emulado() { return "ranchu".equals(Build.HARDWARE) || "goldfish".equals(Build.HARDWARE); }
    static JSONObject obj(Object... pares) {
        JSONObject j = new JSONObject();
        for (int i = 0; i < pares.length; i += 2) try { j.put(String.valueOf(pares[i]), pares[i+1] == null ? JSONObject.NULL : pares[i+1]); } catch (JSONException ignored) { }
        return j;
    }
    static String ler(String path) {
        try { String s = new String(Files.readAllBytes(Paths.get(path)), java.nio.charset.StandardCharsets.UTF_8).trim(); return s.length() > 2048 ? s.substring(0, 2048) : s; } catch (Exception e) { return null; }
    }
    static Double num(String path, double divisor) {
        try { double n = Double.parseDouble(ler(path)) / divisor; return Double.isFinite(n) && n > 0 ? n : null; } catch (Exception e) { return null; }
    }
    private static String cpuInfo() {
        try (BufferedReader r = new BufferedReader(new FileReader("/proc/cpuinfo"))) {
            String line; while ((line = r.readLine()) != null) if (line.matches("(?i)^(hardware|model name)\\s*:.*")) return line.substring(line.indexOf(':') + 1).trim();
        } catch (Exception e) { }
        return Build.HARDWARE;
    }
    JSONObject inventario() {
        ActivityManager.MemoryInfo mem = new ActivityManager.MemoryInfo(); ((ActivityManager)ctx.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(mem);
        JSONArray nucleos = new JSONArray(); double max = 0;
        for (int i = 0; i < Runtime.getRuntime().availableProcessors(); i++) {
            String p = "/sys/devices/system/cpu/cpu" + i + "/cpufreq/";
            Double f = emulado() ? null : num(p + "cpuinfo_max_freq", 1000); if (f != null) max = Math.max(max, f);
            nucleos.put(obj("nucleo", i, "maxMHz", f, "fonte", p + "cpuinfo_max_freq"));
        }
        String soc = Build.VERSION.SDK_INT >= 31 ? Build.SOC_MODEL : cpuInfo();
        String fabricante = Build.VERSION.SDK_INT >= 31 ? Build.SOC_MANUFACTURER : null;
        String gpuFonte = "/sys/class/kgsl/kgsl-3d0/max_gpuclk";
        JSONObject disco = obj("tipo", "Flash", "modelo", null, "marca", null, "capacidadeGB", new StatFs(ctx.getFilesDir().getPath()).getTotalBytes()/1e9,
            "observacao", "Capacidade do sistema de arquivos de dados; modelo físico não exposto de forma confiável. Não inferimos UFS/eMMC pelo desempenho.");
        return obj("protocolo", 1, "versao", "1.0.0", "marca", Build.MANUFACTURER, "modelo", Build.MODEL, "produto", Build.PRODUCT,
            "android", Build.VERSION.RELEASE, "api", Build.VERSION.SDK_INT, "emulado", emulado(), "abis", new JSONArray(Arrays.asList(Build.SUPPORTED_ABIS)),
            "cpu", obj("marca", fabricante, "modelo", soc, "frequenciaMHz", max > 0 ? max : null, "nucleos", nucleos, "fonte", "Build.SOC_MODEL / proc cpuinfo / cpufreq"),
            "gpu", obj("frequenciaMaxMHz", num(gpuFonte, 1e6), "fonte", gpuFonte, "modelo", "Renderer WebGL2 informado no relatório"),
            "memoria", obj("totalGB", mem.totalMem / 1073741824d, "limiteHeapMiB", Runtime.getRuntime().maxMemory()/1048576,
                "modelo", null, "marca", null, "frequenciaMTs", null, "fonte", "ActivityManager.MemoryInfo",
                "observacao", "RAM total real do Android. Fabricante, SPD e frequência da RAM não são expostos em API pública; arquivos devfreq legíveis aparecem nos sensores."),
            "disco", disco, "disponibilidade", obj("temperaturas", "Tenta HardwarePropertiesManager e zonas térmicas sysfs legíveis, mantendo o nome de cada sensor.",
                "clock", "Tenta cpufreq por núcleo, KGSL e devfreq. Falta de permissão é indicada; não há estimativa.",
                "smart", "Não disponível sem acesso privilegiado ao controlador. Aplicativo não solicita root nem muda permissões do aparelho.",
                "memoriaFisica", "Android isola apps: o teste só pode verificar a memória que conseguiu alocar, sem acessar a RAM de outros processos."));
    }
    JSONObject sensores() {
        JSONArray zonas = new JSONArray(); Double cpu = null, gpu = null;
        File[] dirs = new File("/sys/class/thermal").listFiles((d, nome) -> nome.startsWith("thermal_zone"));
        if (dirs != null) for (File d : dirs) {
            String tipo = ler(d + "/type"); Double t = num(d + "/temp", 1000);
            if (tipo != null && t != null && t < 150) {
                zonas.put(obj("sensor", tipo, "tempC", t, "fonte", d + "/temp"));
                if (tipo.toLowerCase(Locale.ROOT).contains("cpu")) cpu = cpu == null ? t : Math.max(cpu, t);
                if (tipo.toLowerCase(Locale.ROOT).contains("gpu")) gpu = gpu == null ? t : Math.max(gpu, t);
            }
        }
        String apiTemp = "Sem acesso: API exige proprietário do dispositivo/serviço autorizado.";
        try {
            HardwarePropertiesManager hp = (HardwarePropertiesManager)ctx.getSystemService(Context.HARDWARE_PROPERTIES_SERVICE);
            float[] c = hp.getDeviceTemperatures(HardwarePropertiesManager.DEVICE_TEMPERATURE_CPU, HardwarePropertiesManager.TEMPERATURE_CURRENT);
            float[] g = hp.getDeviceTemperatures(HardwarePropertiesManager.DEVICE_TEMPERATURE_GPU, HardwarePropertiesManager.TEMPERATURE_CURRENT);
            for (float t : c) if (t > 0 && t < 150) cpu = cpu == null ? (double)t : Math.max(cpu, t);
            for (float t : g) if (t > 0 && t < 150) gpu = gpu == null ? (double)t : Math.max(gpu, t);
            apiTemp = "HardwarePropertiesManager acessível";
        } catch (Exception ignored) { }
        JSONArray clocks = new JSONArray(); double soma = 0; int lidos = 0;
        for (int i = 0; i < Runtime.getRuntime().availableProcessors(); i++) {
            String p = "/sys/devices/system/cpu/cpu" + i + "/cpufreq/scaling_cur_freq"; Double f = emulado() ? null : num(p, 1000);
            clocks.put(obj("nucleo", i, "MHz", f, "fonte", p)); if (f != null) { soma += f; lidos++; }
        }
        JSONArray devfreq = new JSONArray();
        File[] df = new File("/sys/class/devfreq").listFiles();
        if (df != null) for (File d : df) { String f = ler(d + "/cur_freq"); if (f != null) devfreq.put(obj("dispositivo", d.getName(), "valorBruto", f, "fonte", d + "/cur_freq", "unidade", "Consultar driver; não convertido para frequência da RAM")); }
        Intent b = ctx.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        Double tempB = b != null && b.hasExtra(BatteryManager.EXTRA_TEMPERATURE) ? b.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0)/10d : null;
        BatteryManager bm = (BatteryManager)ctx.getSystemService(Context.BATTERY_SERVICE);
        long corrente = bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW);
        PowerManager pm = (PowerManager)ctx.getSystemService(Context.POWER_SERVICE);
        int status = Build.VERSION.SDK_INT >= 29 ? pm.getCurrentThermalStatus() : -1;
        return obj("cpuTempC", cpu, "gpuTempC", gpu, "cpuClockMHz", lidos > 0 ? soma/lidos : null,
            "gpuClockMHz", num("/sys/class/kgsl/kgsl-3d0/gpuclk", 1e6), "clocksPorNucleo", clocks, "zonasTermicas", zonas, "devfreq", devfreq,
            "apiTemperatura", apiTemp, "ausencias", obj("cpuClockMHz", emulado() ? "Não disponível: emulador não expõe o clock real da CPU física." : null,
                "cpuTempC", cpu == null ? "Não disponível: fabricante não permite ler sensor identificado como CPU." : null,
                "gpuTempC", gpu == null ? "Não disponível: fabricante não permite ler sensor identificado como GPU." : null),
            "bateria", obj("tempC", tempB, "nivel", b == null ? null : b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1),
                "tensaoMV", b == null ? null : b.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1),
                "correnteUA", corrente == Long.MIN_VALUE ? null : corrente, "fonte", "BatteryManager; corrente da bateria, não potência da CPU"),
            "estadoTermico", status, "estadoTermicoFonte", "PowerManager: -1 indisponível, 0 normal, 1 leve, 2 moderado, 3 grave, 4 crítico, 5 emergência, 6 desligamento");
    }
}
