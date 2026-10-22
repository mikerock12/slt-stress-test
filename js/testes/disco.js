// Teste de disco: um worker com arquivo temporário no OPFS, removido ao final.

export class TesteDisco {
  static id = 'disco';
  static nome = 'Disco';

  constructor() {
    this.worker = null;
    this.ultimos = {};
    this.erros = 0;
    this.ciclos = 0;
    this.avisos = [];
  }

  async iniciar(opcoes, aoEvento) {
    if (!navigator.storage?.getDirectory) throw new Error('Este navegador não oferece o armazenamento OPFS necessário para o teste de disco.');
    let mib = opcoes.mib || 1024;
    try {
      const { quota = 0, usage = 0 } = await navigator.storage.estimate();
      const livreMiB = Math.floor((quota - usage) / 1024 / 1024);
      if (livreMiB && mib > livreMiB * 0.8) {
        const novo = Math.max(64, Math.floor(livreMiB * 0.8));
        this.avisos.push(`A cota do navegador só permitia ${novo} MiB; o arquivo de teste foi reduzido de ${mib} para ${novo} MiB.`);
        mib = novo;
      }
    } catch { /* estimate indisponível */ }
    this.mib = mib;

    this.worker = new Worker(new URL('../workers/disco.worker.js', import.meta.url), { type: 'module' });
    await new Promise((ok, falha) => {
      this.worker.onmessage = (e) => {
        const d = e.data;
        if (d.tipo === 'pronto') ok();
        else if (d.tipo === 'falha') { this.falha = d.msg; aoEvento({ tipo: 'erro', msg: `Disco: ${d.msg}` }); falha(new Error(d.msg)); }
        else if (d.tipo === 'erro') { this.erros += d.qtd; aoEvento({ tipo: 'erro', msg: `Disco: ${d.qtd} página(s) de 4 KiB com conteúdo errado.` }); }
        else if (d.tipo === 'ciclo') { this.ciclos = d.ciclo; aoEvento({ tipo: 'log', msg: `Disco: ciclo ${d.ciclo} concluído.` }); }
        else if (d.tipo === 'relato') { const { tipo, ...resto } = d; delete resto.erros; Object.assign(this.ultimos, resto); }
        else if (d.tipo === 'encerrado') this.aoEncerrar?.();
      };
      this.worker.onerror = (e) => falha(new Error(e.message));
      this.worker.postMessage({ cmd: 'iniciar', mib });
    });
    aoEvento({ tipo: 'log', msg: `Disco: arquivo temporário de ${mib} MiB; sequencial 1 MiB e aleatório 4 KiB.` });
  }

  amostra() {
    // Só entra na média o que foi medido neste segundo (cada fase mede um tipo de acesso).
    const novos = { ...this.ultimos, erros: this.erros };
    this.ultimos = {};
    return novos;
  }

  info() {
    return { arquivoMiB: this.mib, ciclos: this.ciclos, avisos: this.avisos };
  }

  async parar() {
    if (!this.worker) return;
    // Espera o worker apagar o arquivo temporário (até 5 s) antes de encerrar.
    await new Promise((ok) => {
      const limite = setTimeout(ok, 5000);
      this.aoEncerrar = () => { clearTimeout(limite); ok(); };
      this.worker.postMessage({ cmd: 'parar' });
    });
    this.worker.terminate();
    this.worker = null;
  }
}
