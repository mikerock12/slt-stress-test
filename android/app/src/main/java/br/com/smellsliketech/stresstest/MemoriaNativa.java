package br.com.smellsliketech.stresstest;
import java.nio.ByteBuffer;
final class MemoriaNativa implements Cargas.Alocador {
    static { System.loadLibrary("slt_memoria"); }
    private static native ByteBuffer alocarBloco(int bytes);
    private static native void liberarBloco(ByteBuffer buffer);
    private volatile long controle=criarControle();
    private static native long criarControle();
    private static native void cancelarControle(long controle);
    private static native void fecharControle(long controle);
    private static native double[] processarBloco(long controle,ByteBuffer a,ByteBuffer b,int tipo);
    public ByteBuffer alocar(int bytes) { ByteBuffer b=alocarBloco(bytes);if(b==null)throw new OutOfMemoryError("Bloco nativo indisponível");return b; }
    public void liberar(ByteBuffer buffer) { liberarBloco(buffer); }
    public double[] processar(ByteBuffer a,ByteBuffer b,int tipo){return processarBloco(controle,a,b,tipo);}
    public synchronized void cancelar(){if(controle!=0)cancelarControle(controle);}
    public synchronized void fechar(){if(controle!=0){fecharControle(controle);controle=0;}}
}
