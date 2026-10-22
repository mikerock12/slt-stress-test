// Teste de memória: divide o total escolhido entre workers (até 512 MiB cada).

const MIB = 1024 * 1024;
const MAX_POR_WORKER = 512 * MIB;

export class TesteMemoria {
  static id = 'memoria';
  static nome = 'Memória';

  constructor() {
    this.workers = [];
    this.ultimos = new Map();
    this.alocado = 0;
    this.avisos = [];
  }

  async iniciar(opcoes, aoEvento) {
    const total = Math.max(64 * MIB, (opcoes.mib || 1024) * MIB);
    const n = Math.min(
      Math.max(2, Math.ceil(total / MAX_POR_WORKER)),
      Math.max(2, navigator.hardwareConcurrency || 4),
    );
    const porWorker = Math.floor(total / n / 4096) * 4096;

    const prontos = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('../workers/memoria.worker.js', import.meta.url), { type: 'module' });
      prontos.push(new Promise((ok) => {
        w.onmessage = (e) => {
          const d = e.data;
          if (d.tipo === 'alocado') { this.alocado += d.bytes; ok(); }
          else if (d.tipo === 'falhaAlocacao') {
            this.avisos.push(`Um bloco de ${Math.round(porWorker / MIB)} MiB não pôde ser alocado pelo navegador; o teste usou menos memória.`);
            aoEvento({ tipo: 'log', msg: `Memória: o navegador recusou um bloco de ${Math.round(porWorker / MIB)} MiB.` });
            w.terminate();
            ok();
          } else if (d.tipo === 'erro') {
            aoEvento({ tipo: 'erro', msg: `Memória: ${d.qtd} palavra(s) com valor errado no bloco ${i + 1}.` });
          } else if (d.tipo === 'relato') {
            const anterior = this.ultimos.get(i) || {};
            // Mantém a última banda conhecida quando a fatia atual não mediu aquele tipo.
            this.ultimos.set(i, {
              ...d,
              escritaGBs: d.escritaGBs ?? anterior.escritaGBs,
              leituraGBs: d.leituraGBs ?? anterior.leituraGBs,
              copiaGBs: d.copiaGBs ?? anterior.copiaGBs,
            });
          }
        };
      }));
      w.onerror = (e) => aoEvento({ tipo: 'erro', msg: `Memória: falha no worker ${i + 1}: ${e.message}` });
      w.postMessage({ cmd: 'iniciar', bytes: porWorker });
      this.workers.push(w);
    }
    await Promise.all(prontos);
    if (!this.alocado) throw new Error('O navegador não liberou memória para o teste.');
    aoEvento({ tipo: 'log', msg: `Memória: ${(this.alocado / MIB).toFixed(0)} MiB em ${n} blocos, 8 padrões por passada.` });
  }

  amostra() {
    if (!this.ultimos.size) return null;
    const soma = { escritaGBs: 0, leituraGBs: 0, copiaGBs: 0 };
    let lat = 0, latN = 0, erros = 0, bytes = 0;
    for (const d of this.ultimos.values()) {
      for (const k of Object.keys(soma)) if (Number.isFinite(d[k])) soma[k] += d[k];
      if (Number.isFinite(d.latenciaNs)) { lat += d.latenciaNs; latN++; }
      erros += d.erros;
      bytes += d.bytesVerificados;
    }
    return {
      escritaGBs: soma.escritaGBs || null,
      leituraGBs: soma.leituraGBs || null,
      copiaGBs: soma.copiaGBs || null,
      latenciaNs: latN ? lat / latN : null,
      erros,
      gbVerificados: bytes / 1e9,
    };
  }

  info() {
    return { alocadoMiB: Math.round(this.alocado / MIB), avisos: this.avisos };
  }

  async parar() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
  }
}
