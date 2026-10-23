package br.com.smellsliketech.stresstest;

import java.math.BigInteger;
import java.nio.*;
import java.nio.channels.FileChannel;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

// Algoritmos independentes da UI, com verificação dos resultados em cada rodada.
final class Cargas {
    static final class Estado {
        volatile boolean parar;
        volatile String falha;
        final ConcurrentHashMap<String, Double> metricas = new ConcurrentHashMap<>();
        final Map<String, Object> info = new ConcurrentHashMap<>();
        final List<Future<?>> tarefas = new CopyOnWriteArrayList<>();
        volatile Runnable aoParar=()->{};
        void pararAgora(){parar=true;aoParar.run();}
        boolean ativo() { return !parar && !Thread.currentThread().isInterrupted(); }
        void erro() { metricas.merge("erros", 1d, Double::sum); }
    }
    private static volatile double sorvedouro;
    static final int N = 4096;
    static final int[] EXPOENTES = {3217, 4253, 4423, 9689, 9941, 11213};
    static final class FFT {
        final double[] re = new double[N], im = new double[N], original = new double[N], cos = new double[N/2], sin = new double[N/2];
        final int[] rev = new int[N];
        FFT() {
            for (int i=0; i<N; i++) { rev[i] = Integer.reverse(i) >>> 20; original[i] = Math.sin(i*.17) + Math.cos(i*.31); }
            for (int i=0; i<N/2; i++) { cos[i] = Math.cos(2*Math.PI*i/N); sin[i] = Math.sin(2*Math.PI*i/N); }
        }
        void aplicar(boolean inversa) {
            for (int i=0; i<N; i++) if (rev[i]>i) { int j=rev[i]; double t=re[i]; re[i]=re[j]; re[j]=t; t=im[i]; im[i]=im[j]; im[j]=t; }
            for (int tam=2; tam<=N; tam*=2) for (int i=0; i<N; i+=tam) for (int j=0; j<tam/2; j++) {
                int a=i+j,b=a+tam/2,k=j*N/tam; double c=cos[k],s=sin[k]*(inversa?-1:1);
                double tr=re[b]*c-im[b]*s,ti=im[b]*c+re[b]*s;
                re[b]=re[a]-tr; im[b]=im[a]-ti; re[a]+=tr; im[a]+=ti;
            }
            if (inversa) for (int i=0; i<N; i++) { re[i]/=N; im[i]/=N; }
        }
        boolean rodada() {
            System.arraycopy(original,0,re,0,N); Arrays.fill(im,0);
            aplicar(false); aplicar(true);
            for (int i=0; i<N; i++) if (!Double.isFinite(re[i]) || !Double.isFinite(im[i]) || Math.abs(re[i]-original[i])+Math.abs(im[i])>1e-9) return false;
            return true;
        }
    }
    static void cpu(Estado e, int threads, ExecutorService pool) {
        e.info.put("threads",threads); e.info.put("descricao","FFT 4096 ida/volta e Lucas-Lehmer com resposta conhecida");
        AtomicLong verificacoes = new AtomicLong(), erros = new AtomicLong();
        ConcurrentHashMap<Integer,double[]> ultimos = new ConcurrentHashMap<>();
        for (int t=0;t<threads;t++) { final int id=t;
            e.tarefas.add(pool.submit(() -> {
                try {
                    FFT fft=new FFT(); int indice=id,iter=0,p=EXPOENTES[indice%EXPOENTES.length]; BigInteger m=BigInteger.ONE.shiftLeft(p).subtract(BigInteger.ONE), s=BigInteger.valueOf(4);
                    long inicio=System.nanoTime(), flops=0,ll=0;
                    while(e.ativo()) {
                        long fim=System.nanoTime()+40000000L;
                        while(e.ativo() && System.nanoTime()<fim) {
                            s=s.multiply(s).subtract(BigInteger.valueOf(2)).mod(m); iter++;ll++;
                            if(iter==p-2) { verificacoes.incrementAndGet(); if(s.signum()!=0)erros.incrementAndGet(); p=EXPOENTES[(++indice)%EXPOENTES.length]; m=BigInteger.ONE.shiftLeft(p).subtract(BigInteger.ONE);s=BigInteger.valueOf(4);iter=0; }
                        }
                        fim=System.nanoTime()+40000000L;
                        while(e.ativo() && System.nanoTime()<fim) { if(!fft.rodada())erros.incrementAndGet();verificacoes.incrementAndGet();flops+=2L*5*N*12; }
                        long agora=System.nanoTime();
                        if(agora-inicio>=500000000L) {
                            double seg=(agora-inicio)/1e9;ultimos.put(id,new double[]{flops/seg/1e9,ll/seg}); flops=0;ll=0;inicio=agora;
                            double gf=0,it=0;for(double[] v:ultimos.values()){gf+=v[0];it+=v[1];}
                            e.metricas.put("gflops",gf);e.metricas.put("llps",it);e.metricas.put("erros",(double)erros.get());e.metricas.put("verificacoes",(double)verificacoes.get());
                        }
                    }
                } catch(Throwable ex) { e.falha="Falha na carga nativa de CPU: "+ex.getClass().getSimpleName();e.parar=true; }
            }));
        }
    }
    static int padrao(int tipo,int i) {
        return switch(tipo) { case 0 -> 0; case 1 -> -1; case 2 -> 0xaaaaaaaa; case 3 -> 0x55555555; case 4 -> 1<<(i&31); case 5 -> i; case 6 -> Integer.rotateLeft(i*1103515245+12345,13); default -> ~i; };
    }
    interface Alocador {
        ByteBuffer alocar(int bytes); void liberar(ByteBuffer buffer);
        default double[] processar(ByteBuffer a,ByteBuffer b,int tipo){return null;}
        default void cancelar(){} default void fechar(){}
    }
    static void memoria(Estado e,int mib,ExecutorService pool) {
        memoria(e,mib,pool,new Alocador(){public ByteBuffer alocar(int bytes){return ByteBuffer.allocateDirect(bytes);}public void liberar(ByteBuffer b){}});
    }
    static void memoria(Estado e,int mib,ExecutorService pool,Alocador alocador) {
        e.aoParar=alocador::cancelar;
        e.info.put("alocadoMiB",0);e.info.put("descricao",mib+" MiB solicitados; oito padrões verificados; banda e latência aproximada");
        e.tarefas.add(pool.submit(() -> {
            List<ByteBuffer> alocados=new ArrayList<>();
            try {
                long restante=mib*1048576L;List<IntBuffer[]> blocos=new ArrayList<>();
                while(restante>0 && e.ativo()) {
                    int bytes=(int)Math.min(64*1048576L,restante/2);
                    ByteBuffer a=alocador.alocar(bytes);alocados.add(a);ByteBuffer b=alocador.alocar(bytes);alocados.add(b);
                    blocos.add(new IntBuffer[]{a.order(ByteOrder.nativeOrder()).asIntBuffer(),b.order(ByteOrder.nativeOrder()).asIntBuffer()});
                    restante-=bytes*2L;
                    e.info.put("alocadoMiB",(mib*1048576L-restante)/1048576);
                }
                int tipo=0;double gb=0;long erros=0;
                while(e.ativo()) {
                    long tempoEscrita=0,tempoLeitura=0,tempoCopia=0,totalBytes=0;
                    int indice=0;
                    for(IntBuffer[] par:blocos) {
                    double[] med=alocador.processar(alocados.get(indice++),alocados.get(indice++),tipo);
                    if(med!=null){tempoEscrita+=(long)med[0];tempoLeitura+=(long)med[1];tempoCopia+=(long)med[2];e.metricas.put("latenciaNs",med[3]);erros+=(long)med[4];gb+=med[5]/1e9;totalBytes+=(long)med[5]/2;continue;}
                    IntBuffer a=par[0],b=par[1];int n=a.capacity();long bytes=n*4L;
                    long inicio=System.nanoTime();
                    for(int i=0;i<n && e.ativo();i++)a.put(i,padrao(tipo,i));
                    if(!e.ativo())break;
                    tempoEscrita+=System.nanoTime()-inicio;
                    long soma=0;inicio=System.nanoTime();
                    for(int i=0;i<n && e.ativo();i++){int v=a.get(i);soma+=v;if(v!=padrao(tipo,i))erros++;}
                    if(!e.ativo())break;
                    tempoLeitura+=System.nanoTime()-inicio;sorvedouro=soma;
                    inicio=System.nanoTime();
                    for(int i=0;i<n && e.ativo();i++)b.put(i,a.get(i));
                    if(!e.ativo())break;
                    tempoCopia+=System.nanoTime()-inicio;
                    for(int i=0;i<n && e.ativo();i++)if(b.get(i)!=padrao(tipo,i))erros++;
                    int pos=1;inicio=System.nanoTime();
                    for(int i=0;i<100000 && e.ativo();i++){pos=(int)(((long)pos*1664525+1013904223)&0x7fffffff)%n;soma+=a.get(pos);}
                    e.metricas.put("latenciaNs",(System.nanoTime()-inicio)/100000d);sorvedouro=soma;
                    gb+=bytes*2d/1e9;totalBytes+=bytes;
                    }
                    if(!e.ativo())break;
                    e.metricas.put("escritaGBs",totalBytes/(double)tempoEscrita);e.metricas.put("leituraGBs",totalBytes/(double)tempoLeitura);e.metricas.put("copiaGBs",totalBytes*2d/tempoCopia);
                    e.metricas.put("gbVerificados",gb);e.metricas.put("erros",(double)erros);tipo=(tipo+1)%8;
                }
            } catch(Throwable ex){e.falha="Não foi possível alocar/verificar a memória: "+ex.getClass().getSimpleName();e.parar=true;}
            finally{for(ByteBuffer b:alocados)alocador.liberar(b);alocador.fechar();e.info.put("buffersLiberados",true);}
        }));
    }
    static void preencher(ByteBuffer b,long deslocamento) {
        b.clear();while(b.remaining()>=8){long p=deslocamento+b.position();b.putLong(p^0x5a5aa5a5fedcba98L);}b.flip();
    }
    static long verificar(ByteBuffer b,long deslocamento) {
        long erros=0;b.flip();while(b.remaining()>=8){long p=deslocamento+b.position();if(b.getLong()!=(p^0x5a5aa5a5fedcba98L))erros++;}return erros;
    }
    static void disco(Estado e,File pasta,int mib,ExecutorService pool) {
        e.info.put("arquivoMiB",mib);e.info.put("modo","android");e.info.put("descricao","Arquivo temporário; SEQ1M e RND4K Q1; fsync nas escritas; leitura pode incluir cache do Android");
        e.tarefas.add(pool.submit(() -> {
            File arquivo=new File(pasta,"slt-benchmark.tmp");
            try(RandomAccessFile raf=new RandomAccessFile(arquivo,"rw");FileChannel ch=raf.getChannel()) {
                long tamanho=mib*1024L*1024;ByteBuffer seq=ByteBuffer.allocateDirect(1024*1024).order(ByteOrder.LITTLE_ENDIAN),rnd=ByteBuffer.allocateDirect(4096).order(ByteOrder.LITTLE_ENDIAN);
                for(long p=0;p<tamanho && e.ativo();p+=seq.capacity()){preencher(seq,p);while(seq.hasRemaining()&&e.ativo())ch.write(seq);}
                ch.force(true);long erros=0;Random r=new Random(12345);int fase=0,ciclos=0;
                String[] nomes={"seqLeitura","seqEscrita","rndLeitura","rndEscrita"};
                while(e.ativo()) {
                    ByteBuffer b=fase<2?seq:rnd;boolean escrita=fase%2==1;long feitos=0,pos=0,inicio=System.nanoTime();
                    while(e.ativo()&&System.nanoTime()-inicio<1000000000L) {
                        if(fase>=2)pos=(Math.floorMod(r.nextLong(),tamanho/4096))*4096;
                        ch.position(pos);
                        if(escrita){preencher(b,pos);while(b.hasRemaining()&&e.ativo())ch.write(b);ch.force(true);}
                        else {b.clear();while(b.hasRemaining()&&e.ativo()){if(ch.read(b)<0)throw new EOFException();}if(e.ativo())erros+=verificar(b,pos);}
                        feitos+=b.capacity();pos=(pos+b.capacity())%tamanho;
                    }
                    double mbs=feitos/((System.nanoTime()-inicio)/1e9)/1e6;e.metricas.put(nomes[fase],mbs);
                    if(fase==2)e.metricas.put("iops",mbs*1e6/4096);e.metricas.put("erros",(double)erros);fase=(fase+1)%4;
                    if(fase==0)e.info.put("ciclos",++ciclos);
                }
            }catch(Throwable ex){e.falha="Falha no arquivo de teste: "+ex.getClass().getSimpleName();e.parar=true;}
            finally { e.info.put("arquivoRemovido",!arquivo.exists()||arquivo.delete()); }
        }));
    }
}
