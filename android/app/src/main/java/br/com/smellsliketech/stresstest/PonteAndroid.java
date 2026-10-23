package br.com.smellsliketech.stresstest;

import android.app.ActivityManager;
import android.os.StatFs;
import android.webkit.JavascriptInterface;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;

final class PonteAndroid {
    private final MainActivity activity;
    private final ColetaHardware hardware;
    private final ExecutorService pool=Executors.newCachedThreadPool();
    private final ScheduledExecutorService guarda=Executors.newSingleThreadScheduledExecutor();
    private final Map<String,Cargas.Estado> estados=new ConcurrentHashMap<>();
    private volatile JSONObject sensores=ColetaHardware.obj();
    private volatile String paradaTermica;
    private volatile String interrupcao;
    private volatile boolean avancada;
    void leituraAvancada(boolean ativa){avancada=ativa;}
    PonteAndroid(MainActivity activity) {
        this.activity=activity;hardware=new ColetaHardware(activity);
        new java.io.File(activity.getFilesDir(),"slt-benchmark.tmp").delete(); // limpa sobra de fechamento forçado anterior
        guarda.scheduleWithFixedDelay(() -> {
            try {
                JSONObject s=hardware.sensores();
                if(avancada){
                    JSONObject r=LeituraAvancada.ler();s.put("leituraAvancada",r);
                    for(String k:Arrays.asList("cpuTempC","gpuTempC","cpuClockMHz","gpuClockMHz"))if(r.has(k)&&!r.isNull(k)){s.put(k,r.get(k));if(s.optJSONObject("ausencias")!=null)s.getJSONObject("ausencias").put(k,JSONObject.NULL);}
                }
                if(s.optInt("estadoTermico",-1)>=4 || s.optJSONObject("bateria").optDouble("tempC",0)>=45) {
                    paradaTermica=s.optInt("estadoTermico",-1)>=4?"Android informou estado térmico crítico.":"Bateria chegou a 45 °C. Não é temperatura da CPU.";
                    for(Cargas.Estado e:estados.values())e.pararAgora();
                }
                if(paradaTermica!=null)s.put("paradaTermica",paradaTermica);
                sensores=s;
            }catch(Exception ignored) { }
        },0,1,TimeUnit.SECONDS);
    }
    @JavascriptInterface public String inventario(){return hardware.inventario().toString();}
    @JavascriptInterface public String sensores(){
        try{JSONObject s=new JSONObject(sensores.toString());if(interrupcao!=null)s.put("interrupcao",interrupcao);return s.toString();}catch(Exception e){return "{}";}
    }
    @JavascriptInterface public synchronized String iniciar(String id,String opcoes) {
        try {
            if(!Arrays.asList("cpu","memoria","disco").contains(id))throw new Exception("Componente inválido.");
            if(paradaTermica!=null)throw new Exception("Aguarde o aparelho esfriar e reabra o aplicativo.");
            interrupcao=null;
            if(estados.containsKey(id))parar(id);
            JSONObject o=new JSONObject(opcoes);Cargas.Estado e=new Cargas.Estado();
            int mib=o.optInt("mib",256);if(mib<64||mib>4096)throw new Exception("Quantidade inválida (64–4096 MiB).");
            if(id.equals("cpu")){
                int n=o.optInt("threads",Runtime.getRuntime().availableProcessors());
                if(n<1||n>Runtime.getRuntime().availableProcessors())throw new Exception("Quantidade de threads inválida.");
                Cargas.cpu(e,n,pool);
            }else if(id.equals("memoria")){
                ActivityManager.MemoryInfo m=new ActivityManager.MemoryInfo();((ActivityManager)activity.getSystemService(MainActivity.ACTIVITY_SERVICE)).getMemoryInfo(m);
                int real=Math.min(mib,(int)(m.availMem/3/1048576));
                if(real<64)throw new Exception("Memória livre insuficiente para alocar 64 MiB com segurança.");
                Cargas.memoria(e,real,pool,new MemoriaNativa());e.info.put("solicitadoMiB",mib);e.info.put("avisoAlocacao","Blocos NDK fora do heap Java. Alocação até um terço da memória disponível para manter o Android responsivo; o relatório informa o total real.");
            }else{
                if(new StatFs(activity.getFilesDir().getPath()).getAvailableBytes()<mib*1048576L+128*1048576L)throw new Exception("Armazenamento livre insuficiente.");
                Cargas.disco(e,activity.getFilesDir(),mib,pool);
            }
            estados.put(id,e);return new JSONObject(e.info).toString();
        }catch(Exception ex){return ColetaHardware.obj("erro",ex.getMessage()).toString();}
    }
    @JavascriptInterface public String amostra(String id) {
        Cargas.Estado e=estados.get(id);return e==null?"{}":ColetaHardware.obj("metricas",new JSONObject(e.metricas),"info",new JSONObject(e.info),"falha",e.falha).toString();
    }
    @JavascriptInterface public synchronized void parar(String id) {
        Cargas.Estado e=estados.get(id);if(e==null)return;e.pararAgora();
        for(Future<?> f:e.tarefas)try{f.get(8,TimeUnit.SECONDS);}catch(Exception ignored) {f.cancel(true);}
    }
    @JavascriptInterface public void imprimir(){activity.imprimir();}
    @JavascriptInterface public void exportar(String json){if(json!=null)activity.exportar(json);}
    void suspender(){for(Cargas.Estado e:estados.values())if(!e.parar){interrupcao="Aplicativo saiu do primeiro plano; cargas nativas encerradas.";e.pararAgora();}}
    void fechar(){for(String id:estados.keySet())parar(id);guarda.shutdownNow();pool.shutdownNow();}
}
