// Queda de vazão é um sinal para interromper a carga, não um termômetro.
const mediana = (v) => { const a = [...v].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
export class ProtecaoDesempenhoMovel {
  constructor() { this.dados = { cpu: [], gpu: [] }; this.desde = {}; }
  verificar(segundos, valores) {
    for (const id of ['cpu', 'gpu']) {
      const valor = valores[id];
      if (!Number.isFinite(valor) || valor < 0 || segundos < 5) continue;
      const dados = this.dados[id];
      dados.push({ t: segundos, valor });
      const base = dados.filter((v) => v.t <= 20).map((v) => v.valor);
      const recentes = dados.filter((v) => v.t >= segundos - 5).map((v) => v.valor);
      this.dados[id] = dados.filter((v) => v.t <= 20 || v.t >= segundos - 10);
      if (segundos < 30 || base.length < 5 || recentes.length < 3 || !(mediana(base) > 0)) continue;
      const queda = 100 * (1 - mediana(recentes) / mediana(base));
      if (queda < 50) { delete this.desde[id]; continue; }
      this.desde[id] ??= segundos;
      if (segundos - this.desde[id] >= 5) return { componente: id, queda };
    }
    return null;
  }
}

// Uma tarefa que não confirma a limpeza não pode prender a interface para sempre.
export async function encerrarComPrazo(instancia, ms = 5000) {
  let relogio;
  try {
    await Promise.race([
      Promise.resolve().then(() => instancia.parar()),
      new Promise((_, rejeitar) => { relogio = setTimeout(() => rejeitar(new Error('A limpeza não confirmou o encerramento no prazo.')), ms); }),
    ]);
    return null;
  } catch (e) { return e.message; }
  finally { clearTimeout(relogio); }
}
