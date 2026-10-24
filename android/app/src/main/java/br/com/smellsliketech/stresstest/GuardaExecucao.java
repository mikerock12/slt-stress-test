package br.com.smellsliketech.stresstest;

// Estado puro; o agendador nativo usa relógio monotônico e não depende de callbacks do WebView.
final class GuardaExecucao {
    private long prazo, pulso;
    private boolean ativa;
    synchronized void iniciar(long agora, long duracaoMs) {
        prazo = duracaoMs > 0 ? agora + duracaoMs : Long.MAX_VALUE;
        pulso = agora; ativa = true;
    }
    synchronized void pulsar(long agora) { pulso = agora; }
    synchronized String verificar(long agora) {
        if (!ativa) return null;
        if (agora >= prazo) { ativa = false; return "Tempo concluído"; }
        if (agora - pulso >= 10000) { ativa = false; return "A interface deixou de responder por 10 segundos; cargas nativas encerradas."; }
        return null;
    }
    synchronized void parar() { ativa = false; }
}
