package br.com.smellsliketech.stresstest;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;
import android.widget.Button;
import android.widget.LinearLayout;

public final class MainActivity extends Activity {
    static final String ORIGEM = "https://stresstest.smellsliketech.com.br";
    private WebView web;
    private PonteAndroid ponte;

    static boolean autorizado(Uri uri) {
        return "https".equals(uri.getScheme()) && "stresstest.smellsliketech.com.br".equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443);
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        android.content.pm.PackageInfo motor=WebView.getCurrentWebViewPackage();
        int versao=0;try{if(motor!=null)versao=Integer.parseInt(motor.versionName.split("\\.")[0]);}catch(Exception ignored) { }
        if(versao<110){
            new AlertDialog.Builder(this).setTitle("Atualize o Android System WebView").setMessage("Este aparelho está com um motor de páginas antigo. Atualize Android System WebView e Chrome pela loja do aparelho (versão 110 ou superior) para executar os testes de GPU e a interface com segurança.").setPositiveButton("Abrir loja",(d,w)->{try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.webview")));}catch(Exception ignored){}finish();}).setNegativeButton("Fechar",(d,w)->finish()).setCancelable(false).show();
            return;
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setFitsSystemWindows(true);
        Button avancado=new Button(this);avancado.setText("Sensores avançados (root opcional)");
        layout.addView(avancado);layout.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false); s.setMediaPlaybackRequiresUserGesture(true);
        ponte = new PonteAndroid(this);
        avancado.setOnClickListener(v -> new AlertDialog.Builder(this).setTitle("Leitura avançada opcional").setMessage("Se seu aparelho já tem root, o app pode ler sensores e informações de controladores em sysfs. O gerenciador de root pedirá sua autorização. Somente leitura: não instala root, não altera arquivos e não lê números de série. Sem root, os testes nativos continuam disponíveis.").setPositiveButton("Ativar leitura",(d,w)->{ponte.leituraAvancada(true);avancado.setText("Sensores avançados: ativados");}).setNeutralButton("Desativar",(d,w)->{ponte.leituraAvancada(false);avancado.setText("Sensores avançados (root opcional)");}).setNegativeButton("Cancelar",null).show());
        web.addJavascriptInterface(ponte, "SLTAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (autorizado(req.getUrl())) return false;
                if (req.isForMainFrame() && "https".equals(req.getUrl().getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl())); } catch (Exception e) { Toast.makeText(MainActivity.this, "Não há navegador disponível.", Toast.LENGTH_SHORT).show(); }
                }
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                if (autorizado(req.getUrl())) {
                    String path=req.getUrl().getPath();
                    if(path!=null && path.startsWith("/api/"))return null;
                    if(path==null || path.equals("/"))path="/index.html";
                    if(!path.contains("..") && path.matches("/[a-zA-Z0-9_./-]+")) {
                        try {
                            String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".html")?"text/html":path.endsWith(".png")?"image/png":path.endsWith(".svg")?"image/svg+xml":"application/octet-stream";
                            return new WebResourceResponse(mime,"UTF-8",200,"OK",java.util.Collections.singletonMap("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; worker-src 'self'; connect-src 'self'; frame-src 'none'; base-uri 'self'; form-action 'none'"),getAssets().open("slt"+path));
                        }catch(java.io.IOException ignored) { }
                    }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Origem recusada", java.util.Collections.emptyMap(), new java.io.ByteArrayInputStream(new byte[0]));
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError e) {
                if (req.isForMainFrame()) runOnUiThread(() -> new AlertDialog.Builder(MainActivity.this).setTitle("Não foi possível abrir o teste").setMessage("Confira sua conexão com a internet.").setPositiveButton("Tentar novamente", (d, w) -> web.loadUrl(ORIGEM)).show());
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.setDownloadListener((url, ua, content, mime, size) -> {
            if (url.startsWith("https://")) startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        });
        web.loadUrl(ORIGEM);
    }
    void imprimir() { runOnUiThread(() -> ((PrintManager)getSystemService(PRINT_SERVICE)).print("SLT Stress Test", web.createPrintDocumentAdapter("Benchmark SLT"), new PrintAttributes.Builder().build())); }
    void exportar(String conteudo) {
        runOnUiThread(() -> {
            try {
                java.io.File dir = new java.io.File(getCacheDir(), "exportacao"); dir.mkdirs();
                // O documento é salvo pelo seletor do Android, sem permissão ampla de armazenamento.
                exportacao = conteudo;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, "slt-benchmark.json");
                startActivityForResult(intent, 10);
            } catch (Exception e) { Toast.makeText(this, "Não foi possível exportar.", Toast.LENGTH_SHORT).show(); }
        });
    }
    private String exportacao;
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 10 && result == RESULT_OK && data != null && data.getData() != null && exportacao != null) {
            try (java.io.OutputStream out = getContentResolver().openOutputStream(data.getData())) { out.write(exportacao.getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
            catch (Exception e) { Toast.makeText(this, "Não foi possível gravar o arquivo.", Toast.LENGTH_SHORT).show(); }
        }
        exportacao = null;
    }
    @Override protected void onPause() { if (ponte != null) ponte.suspender(); super.onPause(); }
    @Override protected void onDestroy() { if (ponte != null) ponte.fechar(); if (web != null) { web.removeJavascriptInterface("SLTAndroid"); web.destroy(); } super.onDestroy(); }
    @Override public void onBackPressed() {
        new AlertDialog.Builder(this).setTitle("Sair do teste?").setMessage("As cargas em andamento serão encerradas.").setPositiveButton("Sair", (d, w) -> finish()).setNegativeButton("Continuar", null).show();
    }
}
