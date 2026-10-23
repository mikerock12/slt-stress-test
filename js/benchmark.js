// Contrato público v1. Usado pelo cliente e pelo Worker: médias sempre recalculadas.
import { METRICAS, resumirComponente } from './avaliacao.js';

export const VERSAO_BENCHMARK = 1;
export const MIN_CONTRIBUINTES = 5;
export const PRINCIPAL_RANKING = { cpu: 'gflops', gpu: 'fps', memoria: 'copiaGBs', disco: 'seqLeitura' };
export const normalizar = (s) => String(s || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const texto = (s, n = 240) => typeof s === 'string' ? s.trim().slice(0, n) : null;
const numero = (n) => Number.isFinite(n) && n > 0 ? n : null;
const objeto = (x) => x && typeof x === 'object' && !Array.isArray(x);
const uuid = (s) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s || '');

// Nenhum caminho local, número de série, nome de usuário ou log livre entra no banco.
export function validarBenchmark(entrada) {
  if (!objeto(entrada) || entrada.versao !== VERSAO_BENCHMARK || !uuid(entrada.id) || !uuid(entrada.contribuinte)) throw new Error('Identificação ou versão do benchmark inválida.');
  if (!Array.isArray(entrada.ids) || !entrada.ids.length || entrada.ids.length > 4 || new Set(entrada.ids).size !== entrada.ids.length || entrada.ids.some((id) => !Object.hasOwn(PRINCIPAL_RANKING, id))) throw new Error('Componentes inválidos.');
  if (!numero(entrada.duracaoS) || entrada.duracaoS > 86400) throw new Error('Duração inválida.');
  const ids = Object.keys(PRINCIPAL_RANKING).filter((id) => entrada.ids.includes(id));
  const s = entrada.sistema || {};
  const sistema = { tipo: s.tipo === 'celular' ? 'celular' : 'desktop', so: texto(s.so), navegador: texto(s.navegador),
    energia: ['tomada', 'bateria'].includes(s.energia) ? s.energia : 'não disponível', aparelho: texto(s.aparelho), threads: numero(s.threads) };
  const componentes = {};
  for (const id of ids) {
    const c = entrada.componentes?.[id];
    if (!objeto(c) || !objeto(c.series) || !objeto(c.hardware) || !objeto(c.configuracao)) throw new Error(`Dados de ${id} incompletos.`);
    const h = c.hardware;
    const hardware = { marca: texto(h.marca), modelo: texto(h.modelo), frequencia: numero(h.frequencia),
      unidadeFrequencia: ['MHz', 'MT/s'].includes(h.unidadeFrequencia) ? h.unidadeFrequencia : null,
      capacidadeGB: numero(h.capacidadeGB), tipo: texto(h.tipo, 50), contexto: texto(h.contexto, 480), fonte: texto(h.fonte, 100) };
    const configuracao = {};
    for (const k of ['motor', 'threads', 'largura', 'altura', 'intensidade', 'mib', 'alocadoMiB', 'duracaoAlvoS', 'simultaneos', 'cpuContexto', 'gpuContexto', 'memoriaContexto']) {
      const v = c.configuracao[k];
      if (typeof v === 'string') configuracao[k] = texto(v, 480);
      else if (Number.isFinite(v) && v >= 0 && v <= 864000) configuracao[k] = v;
    }
    if (!configuracao.motor || !configuracao.simultaneos) throw new Error('Configuração do teste incompleta.');
    const series = {};
    let total = 0;
    for (const m of METRICAS[id]) {
      const v = c.series[m.chave];
      if (v === undefined) continue;
      if (!Array.isArray(v) || v.length > 7200 || v.some((x) => !Number.isFinite(x) || x < 0 || x > 1e12)) throw new Error(`Série ${id}/${m.chave} inválida ou acima de 7.200 amostras.`);
      series[m.chave] = v;
      total += v.length;
    }
    if (total > 100000) throw new Error('Quantidade de amostras acima do limite de armazenamento.');
    const resumo = resumirComponente(id, series);
    const principal = resumo[PRINCIPAL_RANKING[id]];
    const erros = (resumo.erros?.total || 0) + (resumo.artefatos?.total || 0);
    const modeloInvalido = /^(desconhecid|unknown|não disponível|generic|disco$|sem webgl|n\/a$|default|to be filled|not specified|qcom$)|swiftshader|llvmpipe|software renderer|webkit webgl/i.test(hardware.modelo || '');
    const elegivel = entrada.concluido === true && entrada.duracaoS >= 115 && principal?.n >= 10 && principal.media > 0 && erros === 0 && !c.falha && !!hardware.modelo && !modeloInvalido;
    const detalhes = {};
    for (const k of ['threads', 'alocadoMiB', 'arquivoMiB', 'ciclos', 'solicitadoMiB']) if (Number.isFinite(c.detalhes?.[k])) detalhes[k] = c.detalhes[k];
    if (objeto(c.detalhes?.resultados)) {
      detalhes.resultados = {};
      for (const fase of ['seq1mq8Leitura', 'seq1mq8Escrita', 'seq1mq1Leitura', 'seq1mq1Escrita', 'rnd4kq32Leitura', 'rnd4kq32Escrita', 'rnd4kq1Leitura', 'rnd4kq1Escrita']) {
        const r = c.detalhes.resultados[fase]; if (!objeto(r)) continue;
        detalhes.resultados[fase] = Object.fromEntries(['mbs', 'iops', 'latenciaMs', 'segundos', 'bytes'].filter((k) => Number.isFinite(r[k]) && r[k] >= 0).map((k) => [k, r[k]]));
      }
    }
    componentes[id] = { hardware, configuracao, series, resumo, detalhes, falha: !!c.falha, elegivel, pontuacao: principal?.media || null };
  }
  return { versao: VERSAO_BENCHMARK, id: entrada.id, contribuinte: entrada.contribuinte,
    duracaoS: entrada.duracaoS, concluido: entrada.concluido === true, sistema, ids, componentes };
}

// Clocks dinâmicos ficam nas séries. A frequência de identificação é nominal/configurada.
export function chaveGrupo(dados, id) {
  const c = dados.componentes[id];
  const h = c.hardware;
  return JSON.stringify([VERSAO_BENCHMARK, id, dados.sistema.tipo, normalizar(dados.sistema.so), normalizar(dados.sistema.navegador), dados.sistema.energia,
    ...['marca', 'modelo', 'frequencia', 'unidadeFrequencia', 'capacidadeGB', 'tipo', 'contexto'].map((k) => typeof h[k] === 'string' ? normalizar(h[k]) : h[k]),
    ...Object.keys(c.configuracao).sort().map((k) => [k, typeof c.configuracao[k] === 'string' ? normalizar(c.configuracao[k]) : c.configuracao[k]])]);
}

export function comparar(valor, referencia, n, minimo = MIN_CONTRIBUINTES) {
  if (n < minimo || !(referencia > 0) || !(valor > 0)) return { estado: 'insuficiente', n, minimo,
    mensagem: 'Ainda não temos informação suficiente sobre hardware igual nesta configuração. Obrigado por contribuir para o banco de testes!' };
  const diferencaPct = (valor / referencia - 1) * 100;
  const estado = diferencaPct < -10 ? 'abaixo' : diferencaPct > 10 ? 'acima' : 'na-media';
  return { estado, n, minimo, media: referencia, valor, diferencaPct,
    mensagem: { abaixo: 'Seu hardware ficou abaixo da média da comunidade.', acima: 'Seu hardware ficou acima da média da comunidade.', 'na-media': 'Seu hardware está na média da comunidade (faixa de ±10%).' }[estado] };
}
