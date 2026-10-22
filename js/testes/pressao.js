// Compute Pressure API (Chrome/Edge): estado de pressão da CPU, que combina uso e térmica.
// Roda junto com qualquer teste quando o navegador oferece; não gera carga.
import { ESTADOS_PRESSAO } from '../avaliacao.js';

export class MonitorPressao {
  static id = 'pressao';
  static nome = 'Pressão do sistema';

  static disponivel() {
    return typeof globalThis.PressureObserver === 'function';
  }

  constructor() {
    this.estado = null;
    this.distribuicao = {};
  }

  async iniciar(_opcoes, aoEvento) {
    if (!MonitorPressao.disponivel()) return;
    this.obs = new PressureObserver((registros) => {
      const novo = registros[registros.length - 1].state;
      if (novo !== this.estado && (novo === 'critical' || this.estado === 'critical')) {
        aoEvento({ tipo: 'log', msg: `Pressão do sistema: ${this.estado ?? '—'} → ${novo}.` });
      }
      this.estado = novo;
    });
    try {
      await this.obs.observe('cpu', { sampleInterval: 1000 });
    } catch (e) {
      this.obs = null;
      aoEvento({ tipo: 'log', msg: `Pressão do sistema indisponível: ${e.message}` });
    }
  }

  amostra() {
    if (!this.estado) return null;
    this.distribuicao[this.estado] = (this.distribuicao[this.estado] || 0) + 1;
    return { estado: ESTADOS_PRESSAO.indexOf(this.estado) };
  }

  info() {
    return { distribuicao: this.distribuicao };
  }

  async parar() {
    this.obs?.disconnect();
    this.obs = null;
  }
}
