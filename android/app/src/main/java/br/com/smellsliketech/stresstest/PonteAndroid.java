package br.com.smellsliketech.stresstest;

import android.app.ActivityManager;
import android.os.StatFs;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;

final class PonteAndroid {
    private final MainActivity activity;
    private final ColetaHardware hardware;
    private final ExecutorService pool=Executors.newCachedThreadPool(r -> new Thread(() -> {
        android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND); r.run();
    }, "SLT-carga"));
    private final ScheduledExecutorService guarda=Executors.newSingleThreadScheduledExecutor();
    private final ScheduledExecutorService vigia=Executors.newSingleThreadScheduledExecutor();
    private final GuardaExecucao prazo=new GuardaExecucao();
    private final Map<String,Cargas.Estado> estados=new ConcurrentHashMap<>();
    private volatile JSONObject sensores=ColetaHardware.obj();
    private volatile String paradaTermica, interrupcao;
    private volatile boolean avancada, preparada;
    private volatile double limiteCpu=80, limiteGpu=80;
    private volatile boolean protecaoAtiva=true;
    void leituraAvancada(boolean ativa){avancada=ativa;}
    private void pararTodos(String motivo) {
        preparada=false; prazo.parar();
        for(Cargas.Estado e:estados.values())e.pararAgora();
        activity.notificarParada(motivo);
    }
    PonteAndroid(MainActivity activity) {
        this.activity=activity;hardware=new ColetaHardware(activity);
        new java.io.File(activity.getFilesDir(),"slt-benchmark.tmp").delete();
        vigia.scheduleWithFixedDelay(() -> {
            String motivo=prazo.verificar(SystemClock.elapsedRealtime());
            if(motivo!=null){interrupcao=motivo;pararTodos(motivo);}
        },250,250,TimeUnit.MILLISECONDS);
        guarda.scheduleWithFixedDelay(() -> {
            try {
                JSONObject s=hardware.sensores();
                if(avancada){
                    JSONObject r=LeituraAvancada.ler();s.put("leituraAvancada",r);
                    for(String k:Arrays.asList("cpuTempC","gpuTempC","cpuClockMHz","gpuClockMHz"))if(r.has(k)&&!r.isNull(k)){s.put(k,r.get(k));if(s.optJSONObject("ausencias")!=null)s.getJSONObject("ausencias").put(k,JSONObject.NULL);if(r.optJSONObject("fontes")!=null&&r.getJSONObject("fontes").has(k))s.getJSONObject("fontes").put(k,r.getJSONObject("fontes").get(k));}
                }
                s.put("lidoEmMs",SystemClock.elapsedRealtime());
                String motivo=null;
                if(s.optInt("estadoTermico",-1)>=3) motivo="Android informou estado térmico grave ou superior.";
                if(s.optDouble("indiceTermico",0)>=1) motivo="O índice térmico Android atingiu o limite de estado grave (não é leitura em °C).";
                JSONObject bateria=s.optJSONObject("bateria");
                if(bateria!=null && bateria.optDouble("tempC",0)>=43) motivo="Bateria chegou a 43 °C. Não é temperatura da CPU/GPU.";
                if(protecaoAtiva && s.optDouble("cpuTempC",0)>=limiteCpu) motivo="CPU atingiu o limite de "+limiteCpu+" °C.";
                if(protecaoAtiva && s.optDouble("gpuTempC",0)>=limiteGpu) motivo="GPU atingiu o limite de "+limiteGpu+" °C.";
                if(motivo!=null && preparada){paradaTermica=motivo;pararTodos(motivo);}
                if(paradaTermica!=null)s.put("paradaTermica",paradaTermica);
                sensores=s;
            }catch(Exception ignored) { }
        },0,1,TimeUnit.SECONDS);
    }
    private boolean tarefasPendentes(){return estados.values().stream().anyMatch(e -> e.tarefas.stream().anyMatch(f -> !f.isDone()));}
    @JavascriptInterface public synchronized String preparar(String opcoes){
        try{
            if(tarefasPendentes())throw new Exception("Aguarde a limpeza do teste anterior terminar.");
            JSONObject o=new JSONObject(opcoes);double segundos=o.optDouble("duracaoS",120);
            if(!Double.isFinite(segundos)||segundos<0||segundos>86400)throw new Exception("Duração inválida.");
            JSONObject l=o.optJSONObject("limites");
            protecaoAtiva=l==null||l.optBoolean("ativa",true);
            limiteCpu=l==null?80:Math.max(60,Math.min(105,l.optDouble("cpu",80)));
            limiteGpu=l==null?80:Math.max(60,Math.min(100,l.optDouble("gpu",80)));
            if(sensores.optInt("estadoTermico",-1)>=2 || sensores.optJSONObject("bateria")!=null && sensores.optJSONObject("bateria").optDouble("tempC",0)>=40 || sensores.optDouble("cpuTempC",0)>=limiteCpu-5 || sensores.optDouble("gpuTempC",0)>=limiteGpu-5)
                throw new Exception("Aguarde o aparelho esfriar antes de iniciar outra carga.");
            estados.clear();paradaTermica=null;interrupcao=null;preparada=true;
            prazo.iniciar(SystemClock.elapsedRealtime(),(long)(segundos*1000));
            return ColetaHardware.obj("pronto",true).toString();
        }catch(Exception e){return ColetaHardware.obj("erro",e.getMessage()).toString();}
    }
    @JavascriptInterface public String inventario(){return hardware.inventario().toString();}
    @JavascriptInterface public String sensores(){
        prazo.pulsar(SystemClock.elapsedRealtime());
        try{
            JSONObject s=new JSONObject(sensores.toString());
            if(interrupcao!=null)s.put("interrupcao",interrupcao);else s.remove("interrupcao");
            if(paradaTermica!=null)s.put("paradaTermica",paradaTermica);else s.remove("paradaTermica");
            return s.toString();
        }catch(Exception e){return "{}";}
    }
    @JavascriptInterface public synchronized String iniciar(String id,String opcoes) {
        try {
            if(!Arrays.asList("cpu","memoria","disco").contains(id))throw new Exception("Componente inválido.");
            if(!preparada)throw new Exception("Prepare a execução antes de iniciar as cargas.");
            if(paradaTermica!=null)throw new Exception("Aguarde o aparelho esfriar antes de repetir.");
            if(estados.containsKey(id))throw new Exception("Componente já iniciado nesta execução.");
            JSONObject o=new JSONObject(opcoes);Cargas.Estado e=new Cargas.Estado();
            int mib=o.optInt("mib",256);if(mib<64||mib>4096)throw new Exception("Quantidade inválida (64–4096 MiB).");
            estados.put(id,e);
            if(id.equals("cpu")){
                int n=o.optInt("threads",Runtime.getRuntime().availableProcessors());
                if(n<1||n>Runtime.getRuntime().availableProcessors())throw new Exception("Quantidade de threads inválida.");
                Cargas.cpu(e,n,pool);
            }else if(id.equals("memoria")){
                ActivityManager.MemoryInfo m=new ActivityManager.MemoryInfo();((ActivityManager)activity.getSystemService(MainActivity.ACTIVITY_SERVICE)).getMemoryInfo(m);
                int real=Math.min(mib,(int)(m.availMem/3/1048576));
                if(real<64)throw new Exception("Memória livre insuficiente para alocar 64 MiB com segurança.");
                Cargas.memoria(e,real,pool,new MemoriaNativa());e.info.put("solicitadoMiB",mib);e.info.put("avisoAlocacao","Blocos NDK fora do heap Java. Alocação até um terço da memória disponível; o relatório informa o total real.");
            }else{
                if(new StatFs(activity.getFilesDir().getPath()).getAvailableBytes()<mib*1048576L+128*1048576L)throw new Exception("Armazenamento livre insuficiente.");
                Cargas.disco(e,activity.getFilesDir(),mib,pool);
            }
            return new JSONObject(e.info).toString();
        }catch(Exception ex){return ColetaHardware.obj("erro",ex.getMessage()).toString();}
    }
    @JavascriptInterface public String amostra(String id) {
        Cargas.Estado e=estados.get(id);return e==null?"{}":ColetaHardware.obj("metricas",new JSONObject(e.metricas),"info",new JSONObject(e.info),"falha",e.falha,"encerrado",e.tarefas.stream().allMatch(Future::isDone)).toString();
    }
    // Apenas sinaliza. Nenhum Future.get ou espera dentro da chamada síncrona do WebView.
    @JavascriptInterface public void parar(String id) {
        prazo.parar();preparada=false;
        Cargas.Estado e=estados.get(id);if(e!=null)e.pararAgora();
    }
    @JavascriptInterface public void imprimir(){activity.imprimir();}
    @JavascriptInterface public void exportar(String json){if(json!=null)activity.exportar(json);}
    void suspender(){if(preparada){interrupcao="Aplicativo saiu do primeiro plano; cargas nativas encerradas.";pararTodos(interrupcao);}}
    void fechar(){prazo.parar();for(Cargas.Estado e:estados.values())e.pararAgora();vigia.shutdownNow();guarda.shutdownNow();pool.shutdownNow();}
}
