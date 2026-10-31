// Teste de disco real pelo plugin: arquivo temporário sem cache do Windows, no estilo do
// CrystalDiskMark (SEQ 1 MiB Q8/Q1 e RND 4 KiB Q32/Q1), repetido até o tempo acabar.
import { cancelarBenchmark, estadoBenchmark, iniciarBenchmark } from '../plugin.js';

// Fase do plugin → métrica do relatório (as demais vão só para a tabela completa).
const MAPA = {
  seq1mq8Leitura: 'seqLeitura',
  seq1mq8Escrita: 'seqEscrita',
  rnd4kq1Leitura: 'rndLeitura',
  rnd4kq1Escrita: 'rndEscrita',
};

export class TesteDiscoPlugin {
  static id = 'disco';
  static nome = 'Disco';

  constructor() {
    this.estado = null;
    this.ultimoCiclo = 0;
  }

  async iniciar(opcoes, aoEvento) {
    this.unidade = opcoes.unidade;
    this.mib = opcoes.mib || 1024;
    this.aoEvento = aoEvento;
    await iniciarBenchmark({ unidade: this.unidade, mib: this.mib, segundos: 5, ciclos: 0 });
    aoEvento({ tipo: 'log', msg: `Disco: teste real em ${this.unidade} pelo plugin, sem cache do Windows, arquivo de ${this.mib} MiB.` });
    this.relogio = setInterval(() => this.consultar(), 1000);
  }

  async consultar() {
    try {
      const e = await estadoBenchmark();
      if (this.estado && e.erros > this.estado.erros) {
        this.aoEvento({ tipo: 'erro', msg: `Disco: ${e.erros - this.estado.erros} página(s) de 4 KiB voltaram diferentes do gravado.` });
      }
      if (e.ciclo > this.ultimoCiclo && e.situacao === 'rodando') {
        this.ultimoCiclo = e.ciclo;
        this.aoEvento({ tipo: 'log', msg: `Disco: ciclo ${e.ciclo} concluído (8 medições).` });
      }
      if (e.situacao === 'erro' && !this.falhaFatal) {
        this.falhaFatal = `O plugin interrompeu o teste de disco: ${e.erro}`;
        this.aoEvento({ tipo: 'erro', msg: `Disco: ${e.erro}` });
      }
      this.estado = e;
    } catch { /* plugin ocupado; tenta no próximo segundo */ }
  }

  amostra() {
    const e = this.estado;
    if (!e) return null;
    const saida = { erros: e.erros || 0, ciclos: e.ciclo || 0 };
    const chave = MAPA[e.fase];
    if (chave && Number.isFinite(e.atualMBs) && e.atualMBs > 0) {
      saida[chave] = e.atualMBs;
      if (chave === 'rndLeitura') saida.iops = (e.atualMBs * 1e6) / 4096;
    }
    return saida;
  }

  info() {
    return {
      modo: 'nativo',
      unidade: this.unidade,
      arquivoMiB: this.mib,
      ciclos: this.estado?.ciclo || 0,
      resultados: this.estado?.resultados || {},
      avisos: [],
      falhaFatal: this.falhaFatal,
    };
  }

  async parar() {
    clearInterval(this.relogio);
    try {
      await cancelarBenchmark();
      // Espera o plugin apagar o arquivo temporário (até 10 s).
      for (let i = 0; i < 20; i++) {
        const e = await estadoBenchmark();
        this.estado = e;
        if (e.situacao !== 'rodando') break;
        await new Promise((ok) => setTimeout(ok, 500));
      }
    } catch { /* plugin fechado */ }
  }
}
