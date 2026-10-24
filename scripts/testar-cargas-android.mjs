// Teste real dos algoritmos Java, fora do Android: respostas, falhas e limpeza.
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const dir = mkdtempSync(join(tmpdir(), 'slt-java-'));
const pacote = join(dir, 'br/com/smellsliketech/stresstest'); mkdirSync(pacote, { recursive: true });
const fonte = resolve('android/app/src/main/java/br/com/smellsliketech/stresstest/Cargas.java');
const auxiliares = ['SensoresTermicos', 'GuardaExecucao'].map((nome) => resolve('android/app/src/main/java/br/com/smellsliketech/stresstest/' + nome + '.java'));
writeFileSync(join(pacote, 'Teste.java'), `package br.com.smellsliketech.stresstest;
import java.io.*;import java.util.concurrent.*;import java.nio.*;
public class Teste {
 static void exigir(boolean v,String msg){if(!v)throw new AssertionError(msg);}
 public static void main(String[] args)throws Exception {
  exigir("cpu".equals(SensoresTermicos.componente("mtktscpu")),"CPU MediaTek identificada");
  exigir("gpu".equals(SensoresTermicos.componente("mali-gpu")),"GPU Mali identificada");
  exigir("gpu".equals(SensoresTermicos.componente("mtktsmfg")),"GPU MFG identificada");
  for(String sensor:new String[]{"battery","gpu-skin","cpu-ambient","pmic","soc_max","tsens_tz_sensor3"})exigir(SensoresTermicos.componente(sensor)==null,"Não atribuir fonte ambígua: "+sensor);
  exigir(SensoresTermicos.miligraus("86000")==86d,"Unidade térmica explícita");
  exigir(SensoresTermicos.miligraus("NaN")==null && SensoresTermicos.miligraus("255000")==null,"Sensor inválido rejeitado");
  GuardaExecucao guarda=new GuardaExecucao();guarda.iniciar(100,2000);guarda.pulsar(1999);
  exigir(guarda.verificar(2099)==null,"Prazo monotônico ainda não venceu");
  exigir("Tempo concluído".equals(guarda.verificar(2100)),"Prazo independente do WebView e do pulso");
  exigir(guarda.verificar(3000)==null,"Parada só notifica uma vez");
  guarda.iniciar(0,0);exigir(guarda.verificar(9999)==null,"Sem limite respeita pulso");
  exigir(guarda.verificar(10000)!=null,"WebView travado encerra cargas");
  guarda.iniciar(10000,5000);guarda.parar();exigir(guarda.verificar(20000)==null,"Parada manual desarma guarda");
  Cargas.FFT fft=new Cargas.FFT();for(int i=0;i<10;i++)exigir(fft.rodada(),"FFT ida/volta");
  ByteBuffer b=ByteBuffer.allocateDirect(4096);Cargas.preencher(b,8192);b.position(b.limit());exigir(Cargas.verificar(b,8192)==0,"Bloco original");
  b.putLong(0,0);b.position(b.limit());exigir(Cargas.verificar(b,8192)>0,"Corrupção detectada");
  ExecutorService pool=Executors.newCachedThreadPool();
  try {
   Cargas.Estado cpu=new Cargas.Estado();Cargas.cpu(cpu,2,pool);Thread.sleep(1800);cpu.parar=true;for(Future<?> f:cpu.tarefas)f.get(10,TimeUnit.SECONDS);
   exigir(cpu.falha==null,"CPU iniciou");exigir(cpu.metricas.getOrDefault("gflops",0d)>0,"CPU produziu GFLOPS");exigir(cpu.metricas.get("erros")==0,"CPU sem erros");exigir(cpu.metricas.get("verificacoes")>0,"CPU verificou respostas");
   Cargas.Estado mem=new Cargas.Estado();Cargas.memoria(mem,8,pool);Thread.sleep(1500);mem.parar=true;for(Future<?> f:mem.tarefas)f.get(10,TimeUnit.SECONDS);
   exigir(mem.falha==null,"Memória iniciou");exigir(mem.metricas.getOrDefault("gbVerificados",0d)>0,"Memória verificada");exigir(mem.metricas.get("erros")==0,"Memória sem erros");
   Cargas.Estado disco=new Cargas.Estado();File pasta=new File(args[0]);Cargas.disco(disco,pasta,8,pool);Thread.sleep(5000);disco.parar=true;for(Future<?> f:disco.tarefas)f.get(10,TimeUnit.SECONDS);
   exigir(disco.falha==null,"Disco iniciou");exigir(disco.metricas.getOrDefault("seqLeitura",0d)>0,"Disco mediu leitura");exigir(disco.metricas.getOrDefault("rndEscrita",0d)>0,"Disco mediu escrita aleatória");exigir(disco.metricas.get("erros")==0,"Disco sem erros");exigir(!new File(pasta,"slt-benchmark.tmp").exists(),"Arquivo removido");
  }finally{pool.shutdownNow();}
  System.out.println("Cargas Android: FFT, corrupção, CPU, memória, disco e cancelamento OK.");
 }
}`);
execFileSync('javac', ['-encoding', 'UTF-8', '-d', dir, fonte, ...auxiliares, join(pacote, 'Teste.java')], { stdio: 'inherit' });
execFileSync('java', ['-cp', dir, 'br.com.smellsliketech.stresstest.Teste', dir], { stdio: 'inherit', timeout: 40000 });
