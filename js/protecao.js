// Proteção de temperatura (precisa do plugin): para o teste se a CPU ou a GPU passar do
// limite por alguns segundos seguidos. Puro, sem DOM, testado em Node.

export const LIMITES_PADRAO = { ativa: true, cpu: 95, gpu: 90 };
export const FAIXA = { cpu: [60, 105], gpu: [60, 100] };
const AVISO_ANTES = 5; // °C abaixo do limite em que o registro avisa uma vez

export function normalizarLimites(bruto = {}) {
  const limite = (k) => {
    const v = Math.round(Number(bruto[k]));
    if (!Number.isFinite(v)) return LIMITES_PADRAO[k];
    return Math.min(FAIXA[k][1], Math.max(FAIXA[k][0], v));
  };
  return { ativa: bruto.ativa !== false, cpu: limite('cpu'), gpu: limite('gpu') };
}

// Estado da temperatura em relação ao limite, para colorir a faixa ao vivo.
export function nivel(temp, limite) {
  if (!Number.isFinite(temp)) return 'sem';
  if (temp >= limite) return 'limite';
  if (temp >= limite - AVISO_ANTES) return 'perto';
  return 'ok';
}

export class ProtecaoTemperatura {
  constructor(limites, { segundos = 3 } = {}) {
    this.limites = normalizarLimites(limites);
    this.segundos = segundos;
    this.acima = { cpu: 0, gpu: 0 };
    this.avisou = { cpu: false, gpu: false };
    this.maxima = { cpu: null, gpu: null };
    this.disparo = null;
  }

  // Recebe { cpu, gpu } em °C (null quando não há leitura). Devolve os avisos novos e,
  // quando a temperatura fica acima do limite por `segundos` leituras seguidas, o disparo.
  verificar(temps) {
    const avisos = [];
    for (const k of ['cpu', 'gpu']) {
      const t = temps[k];
      if (!Number.isFinite(t)) { this.acima[k] = 0; continue; }
      if (this.maxima[k] === null || t > this.maxima[k]) this.maxima[k] = t;
      const limite = this.limites[k];
      if (t >= limite) this.acima[k]++;
      else this.acima[k] = 0;
      if (!this.avisou[k] && t >= limite - AVISO_ANTES) {
        this.avisou[k] = true;
        avisos.push({ componente: k, temp: t, limite });
      }
      if (this.limites.ativa && !this.disparo && this.acima[k] >= this.segundos) {
        this.disparo = { componente: k, temp: t, limite };
      }
    }
    return { avisos, disparo: this.disparo };
  }
}
