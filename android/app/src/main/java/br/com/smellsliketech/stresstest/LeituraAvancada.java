package br.com.smellsliketech.stresstest;

import org.json.*;
import java.io.*;
import java.util.concurrent.*;

// Comando fixo, somente leitura. Ativação pelo botão nativo; sem parâmetros do JavaScript.
final class LeituraAvancada {
    private static final String COMANDO =
        "for d in /sys/class/thermal/thermal_zone*; do t=$(cat \"$d/type\" 2>/dev/null); v=$(cat \"$d/temp\" 2>/dev/null); [ -n \"$v\" ] && echo \"T|$t|$v\"; done; " +
        "for d in /sys/devices/system/cpu/cpu[0-9]*; do v=$(cat \"$d/cpufreq/scaling_cur_freq\" 2>/dev/null); [ -n \"$v\" ] && echo \"C|${d##*/}|$v\"; done; " +
        "for d in /sys/class/devfreq/*; do for f in cur_freq max_freq available_frequencies; do v=$(cat \"$d/$f\" 2>/dev/null); [ -n \"$v\" ] && echo \"F|${d##*/}/$f|$v\"; done; done; " +
        "for f in /proc/ddr_info /sys/kernel/ddr/ddr_info /sys/kernel/debug/clk/clk_summary; do [ -f \"$f\" ] && v=$(head -c 2048 \"$f\" 2>/dev/null | tr '\\n' ' ') && echo \"M|$f|$v\"; done; " +
        "for d in /sys/block/mmcblk*/device; do for f in name manfid life_time pre_eol_info fwrev; do v=$(cat \"$d/$f\" 2>/dev/null); [ -n \"$v\" ] && echo \"S|$d/$f|$v\"; done; done; " +
        "for d in /sys/class/scsi_device/*/device/health_descriptor; do for f in life_time_estimation_a life_time_estimation_b eol_info; do v=$(cat \"$d/$f\" 2>/dev/null); [ -n \"$v\" ] && echo \"S|$d/$f|$v\"; done; done; " +
        "for d in /sys/block/*; do m=$(cat \"$d/device/model\" 2>/dev/null); v=$(cat \"$d/device/vendor\" 2>/dev/null); [ -n \"$m\" ] && echo \"D|${d##*/}|$v $m\"; done; " +
        "v=$(cat /sys/class/kgsl/kgsl-3d0/gpuclk 2>/dev/null); [ -n \"$v\" ] && echo \"G|KGSL|$v\"; echo SLT_FIM";
    static JSONObject ler() {
        Process p = null;
        try {
            p = new ProcessBuilder("su", "-c", COMANDO).redirectErrorStream(true).start();
            final InputStream in=p.getInputStream(); ExecutorService leitor=Executors.newSingleThreadExecutor();
            Future<String> saida=leitor.submit(() -> {
                ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] buf=new byte[1024];int n;
                while((n=in.read(buf))!=-1){if(b.size()+n>65536)throw new IOException("Saída excessiva");b.write(buf,0,n);}
                return b.toString("UTF-8");
            });
            try {
                if(!p.waitFor(4,TimeUnit.SECONDS)){p.destroyForcibly();throw new IOException("Sem autorização root");}
                String texto=saida.get(1,TimeUnit.SECONDS);
                if(p.exitValue()!=0||!texto.contains("SLT_FIM"))throw new IOException("Root indisponível");
                JSONArray sensores=new JSONArray();Double cpu=null,gpu=null,clockGpu=null;double soma=0;int n=0;
                for(String linha:texto.split("\\r?\\n")) {
                    String[] c=linha.split("\\|",3);if(c.length!=3)continue;
                    sensores.put(ColetaHardware.obj("categoria",c[0],"sensor",c[1].trim(),"valorBruto",c[2].trim(),"fonte","sysfs via root já instalado"));
                    try {
                        double valor=Double.parseDouble(c[2].trim());
                        if(c[0].equals("T")&&valor>1000&&valor<150000){double t=valor/1000;String nome=c[1].toLowerCase(java.util.Locale.ROOT);if(nome.contains("cpu"))cpu=cpu==null?t:Math.max(cpu,t);if(nome.contains("gpu"))gpu=gpu==null?t:Math.max(gpu,t);}
                        if(c[0].equals("C")&&valor>0){soma+=valor/1000;n++;}
                        if(c[0].equals("G")&&valor>0)clockGpu=valor/1e6;
                    }catch(NumberFormatException ignored) { }
                }
                return ColetaHardware.obj("estado","Leitura avançada autorizada","leituras",sensores,"cpuTempC",cpu,"gpuTempC",gpu,"cpuClockMHz",n>0?soma/n:null,"gpuClockMHz",clockGpu);
            }finally{leitor.shutdownNow();}
        }catch(Exception e){return ColetaHardware.obj("estado","Não disponível: root ausente, negado ou sem acesso às fontes. O teste normal continua.");}
        finally{if(p!=null)p.destroy();}
    }
}
