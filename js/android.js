export const DOWNLOAD_APK = '/assets/downloads/SLTStressTest-v1.3.1.apk';
export const androidDisponivel = () => typeof globalThis.SLTAndroid?.inventario === 'function';
export function inventarioAndroid() {
  if (!androidDisponivel()) return null;
  try { const d = JSON.parse(globalThis.SLTAndroid.inventario()); return d.protocolo === 1 ? d : null; } catch { return null; }
}
export function sensoresAndroid() {
  try { return JSON.parse(globalThis.SLTAndroid.sensores()); } catch { return {}; }
}
export class TesteAndroid {
  constructor(id) { this.id = id; this.ultima = null; }
  async iniciar(opcoes, aoEvento) {
    this.opcoes = opcoes;
    const r = JSON.parse(globalThis.SLTAndroid.iniciar(this.id, JSON.stringify(opcoes)));
    if (r.erro) throw new Error(r.erro);
    this.detalhes = r;
    aoEvento({ tipo: 'log', msg: `${this.id}: carga nativa Android; ${r.descricao || 'resultados verificados'}.` });
  }
  amostra() {
    const r = JSON.parse(globalThis.SLTAndroid.amostra(this.id));
    if (r.falha) this.falhaFatal = r.falha;
    this.ultima = r;
    return r.metricas || null;
  }
  info() { return { ...this.detalhes, ...this.ultima?.info, motor: 'android-nativo-v1', falhaFatal: this.falhaFatal }; }
  async parar() {
    globalThis.SLTAndroid.parar(this.id);
    const prazo = performance.now() + 3500;
    do {
      this.amostra();
      if (this.ultima.encerrado !== false) return;
      await new Promise((ok) => setTimeout(ok, 50));
    } while (performance.now() < prazo);
    throw new Error('A carga nativa recebeu a parada, mas ainda não confirmou a liberação dos recursos. Aguarde antes de repetir.');
  }
}
export class MonitorAndroid {
  iniciar() { this.atualizar(); this.relogio = setInterval(() => this.atualizar(), 1000); }
  atualizar() { this.ultima = sensoresAndroid(); }
  parar() { clearInterval(this.relogio); }
  para(id) {
    const s = this.ultima || {};
    if (id === 'cpu') return Object.fromEntries(Object.entries({ tempC: s.cpuTempC, clockReal: s.cpuClockMHz ? s.cpuClockMHz / 1000 : null }).filter(([, v]) => Number.isFinite(v)));
    if (id === 'gpu') return Object.fromEntries(Object.entries({ tempC: s.gpuTempC, clockMHz: s.gpuClockMHz }).filter(([, v]) => Number.isFinite(v)));
    return {};
  }
}
