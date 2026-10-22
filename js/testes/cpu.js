// Teste de CPU: um worker por thread lógica, cada um rodando Lucas-Lehmer + FFT verificados.

export class TesteCPU {
  static id = 'cpu';
  static nome = 'CPU';

  constructor() {
    this.workers = [];
    this.ultimos = new Map();
    this.erros = 0;
    this.verificacoes = 0;
  }

  async iniciar(opcoes, aoEvento) {
    const threads = Math.max(1, opcoes.threads || navigator.hardwareConcurrency || 4);
    this.threads = threads;
    for (let i = 0; i < threads; i++) {
      const w = new Worker(new URL('../workers/cpu.worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => {
        const d = e.data;
        if (d.tipo !== 'relato') return;
        this.ultimos.set(i, d);
        this.verificacoes += d.verificacoes;
        if (d.erros) {
          this.erros += d.erros;
          aoEvento({ tipo: 'erro', msg: `CPU: thread ${i + 1} retornou ${d.erros} resultado(s) incorreto(s).` });
        }
      };
      w.onerror = (e) => aoEvento({ tipo: 'erro', msg: `CPU: falha no worker ${i + 1}: ${e.message}` });
      w.postMessage({ cmd: 'iniciar' });
      this.workers.push(w);
    }
    aoEvento({ tipo: 'log', msg: `CPU: ${threads} threads em Lucas-Lehmer + FFT de 4096 pontos.` });
  }

  amostra() {
    if (!this.ultimos.size) return null;
    let gflops = 0;
    let llps = 0;
    let clockSoma = 0;
    let clockN = 0;
    for (const d of this.ultimos.values()) {
      gflops += d.gflops;
      llps += d.llps;
      if (Number.isFinite(d.clock)) { clockSoma += d.clock; clockN++; }
    }
    return {
      gflops,
      llps,
      clock: clockN ? clockSoma / clockN : null,
      erros: this.erros,
      verificacoes: this.verificacoes,
    };
  }

  info() {
    return { threads: this.threads };
  }

  async parar() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
  }
}
