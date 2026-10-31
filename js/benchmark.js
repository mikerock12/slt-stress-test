import { metricasParaVersao, medicaoSuficiente, resumirComponente } from './avaliacao.js';

export const VERSAO_BENCHMARK = 2;
export const MIN_CONTRIBUINTES = 5;
export const PRINCIPAL_RANKING = { cpu: 'gflops', gpu: 'passadasPorSegundo', memoria: 'copiaGBs', disco: 'seqLeitura' };
export const PRINCIPAL_RANKING_V1 = { ...PRINCIPAL_RANKING, gpu: 'fps' };
export const principalRanking = (versao, componente) => (versao === 1 ? PRINCIPAL_RANKING_V1 : PRINCIPAL_RANKING)[componente];
export const normalizar = (s) => String(s || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const texto = (s, n = 240) => typeof s === 'string' ? s.trim().slice(0, n) : null;
const numero = (n) => Number.isFinite(n) && n > 0 ? n : null;
const objeto = (x) => x && typeof x === 'object' && !Array.isArray(x);
const uuid = (s) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s || '');
const PERFIS = ['rapido', 'completo', 'extremo', 'personalizado', 'indefinido'];

function validarTempos(tempos, chave, quantidade) {
  if (!Array.isArray(tempos) || tempos.length !== quantidade) throw new Error(`Timestamps de ${chave} ausentes ou inconsistentes.`);
  for (let i = 0; i < tempos.length; i++) {
    if (!Number.isFinite(tempos[i]) || tempos[i] < 0 || tempos[i] > 86400 || (i > 0 && tempos[i] <= tempos[i - 1])) throw new Error(`Timestamps de ${chave} inválidos.`);
  }
  return tempos.slice();
}

function motivosElegibilidade(entrada, id, hardware, resumo, principal, falha) {
  const motivos = [];
  if (entrada.sistema?.emulado === true) motivos.push('ambiente_emulado');
  if (entrada.concluido !== true) motivos.push('execucao_incompleta');
  if (entrada.duracaoS < 115) motivos.push('duracao_insuficiente');
  if (!(principal?.n >= 10) || !(principal?.media > 0)) motivos.push('metrica_principal_insuficiente');
  const erros = (resumo.erros?.total || 0) + (resumo.divergenciasReferencia?.total || 0) + (resumo.artefatos?.total || 0);
  if (erros > 0) motivos.push('erros_de_verificacao');
  if (falha) motivos.push('falha_do_motor');
  const modeloInvalido = /^(desconhecid|unknown|não disponível|generic|disco$|sem webgl|n\/a$|default|to be filled|not specified|qcom$)|swiftshader|llvmpipe|software renderer|webkit webgl/i.test(hardware.modelo || '');
  if (!hardware.modelo || modeloInvalido) motivos.push('hardware_nao_identificado');
  if (entrada.versao === 2) {
    const alvo = Number.isFinite(entrada.componentes[id].configuracao.duracaoAlvoS) ? entrada.componentes[id].configuracao.duracaoAlvoS : null;
    if (alvo && entrada.duracaoS < Math.max(115, alvo - 5)) motivos.push('duracao_alvo_nao_concluida');
    if (!medicaoSuficiente(id, resumo, { concluido: entrada.concluido === true, duracaoAlvoS: alvo, duracaoRealS: entrada.duracaoS, ciclos: entrada.componentes[id].detalhes?.ciclos ?? resumo.ciclos?.total }, entrada.perfil)) motivos.push('cobertura_ou_tempo_util_insuficiente');
  }
  return [...new Set(motivos)];
}

export function validarBenchmark(entrada) {
  if (!objeto(entrada) || ![1, 2].includes(entrada.versao) || !uuid(entrada.id) || !uuid(entrada.contribuinte)) throw new Error('Identificação ou versão do benchmark inválida.');
  const versao = entrada.versao;
  const principais = versao === 1 ? PRINCIPAL_RANKING_V1 : PRINCIPAL_RANKING;
  if (!Array.isArray(entrada.ids) || !entrada.ids.length || entrada.ids.length > 4 || new Set(entrada.ids).size !== entrada.ids.length || entrada.ids.some((id) => !Object.hasOwn(principais, id))) throw new Error('Componentes inválidos.');
  if (!numero(entrada.duracaoS) || entrada.duracaoS > 86400) throw new Error('Duração inválida.');
  const perfil = versao === 2 && PERFIS.includes(entrada.perfil) ? entrada.perfil : versao === 2 ? 'personalizado' : null;
  const ids = Object.keys(principais).filter((id) => entrada.ids.includes(id));
  const s = entrada.sistema || {};
  const sistema = { tipo: s.tipo === 'celular' ? 'celular' : 'desktop', emulado: s.emulado === true, so: texto(s.so), navegador: texto(s.navegador),
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
    for (const k of ['motor', 'threads', 'largura', 'altura', 'intensidade', 'mib', 'alocadoMiB', 'duracaoAlvoS', 'simultaneos', 'cpuContexto', 'gpuContexto', 'memoriaContexto', 'politicaCache', 'sincronizacao', 'qd']) {
      const v = c.configuracao[k];
      if (typeof v === 'string') configuracao[k] = texto(v, 480);
      else if (Number.isFinite(v) && v >= 0 && v <= 864000) configuracao[k] = v;
    }
    if (!configuracao.motor || !configuracao.simultaneos) throw new Error('Configuração do teste incompleta.');
    if (versao === 2) configuracao.qualidadeMetodo = 'temporal-v2';
    const series = {};
    const tempos = {};
    let total = 0;
    for (const m of metricasParaVersao(versao)[id]) {
      const v = c.series[m.chave];
      if (v === undefined) continue;
      if (!Array.isArray(v) || v.length > 7200 || v.some((x) => !Number.isFinite(x) || x < 0 || x > 1e12)) throw new Error(`Série ${id}/${m.chave} inválida ou acima de 7.200 amostras.`);
      series[m.chave] = v.slice();
      if (versao === 2) {
        tempos[m.chave] = validarTempos(c.tempos?.[m.chave], `${id}/${m.chave}`, v.length);
        if (tempos[m.chave].at(-1) > entrada.duracaoS + 5) throw new Error(`Timestamps de ${id}/${m.chave} excedem a duração declarada.`);
      }
      total += v.length;
    }
    if (total > 100000) throw new Error('Quantidade de amostras acima do limite de armazenamento.');
    const resumo = resumirComponente(id, series, tempos, { versao, duracaoAlvoS: configuracao.duracaoAlvoS });
    const chavePrincipal = principais[id];
    const principal = resumo[chavePrincipal];
    const motivos = motivosElegibilidade({ ...entrada, sistema, perfil }, id, hardware, resumo, principal, !!c.falha);
    const elegivel = motivos.length === 0;
    const baseQualidade = id === 'disco' ? resumo.erros : principal;
    const qualidade = versao === 2 ? { tempoUtilS: baseQualidade?.tempoUtilS ?? null, cobertura: baseQualidade?.cobertura ?? null,
      amostrasValidas: principal?.n || 0, motivosInelegibilidade: motivos } : undefined;
    const detalhes = {};
    for (const k of ['threads', 'alocadoMiB', 'arquivoMiB', 'ciclos', 'solicitadoMiB', 'mibSolicitados', 'mibAlocados', 'mibCompletamenteVerificados', 'bytesAcumulados', 'rodadasCompletas']) if (Number.isFinite(c.detalhes?.[k]) && c.detalhes[k] >= 0) detalhes[k] = c.detalhes[k];
    if (objeto(c.detalhes?.resultados)) {
      detalhes.resultados = {};
      for (const fase of ['seq1mq8Leitura', 'seq1mq8Escrita', 'seq1mq1Leitura', 'seq1mq1Escrita', 'rnd4kq32Leitura', 'rnd4kq32Escrita', 'rnd4kq1Leitura', 'rnd4kq1Escrita']) {
        const r = c.detalhes.resultados[fase]; if (!objeto(r)) continue;
        detalhes.resultados[fase] = Object.fromEntries(['mbs', 'iops', 'latenciaMs', 'segundos', 'bytes'].filter((k) => Number.isFinite(r[k]) && r[k] >= 0).map((k) => [k, r[k]]));
      }
    }
    componentes[id] = { hardware, configuracao, series, ...(versao === 2 ? { tempos } : {}), resumo, detalhes, falha: !!c.falha, elegivel,
      ...(qualidade ? { qualidade } : {}), motivosInelegibilidade: motivos, pontuacao: principal?.media || null };
  }
  if (versao === 2) {
    const execucao = new Set(['execucao_incompleta', 'duracao_insuficiente', 'metrica_principal_insuficiente', 'erros_de_verificacao', 'falha_do_motor', 'duracao_alvo_nao_concluida', 'cobertura_ou_tempo_util_insuficiente']);
    const incompleto = ids.some((id) => componentes[id].motivosInelegibilidade.some((motivo) => execucao.has(motivo)));
    if (incompleto) {
      for (const id of ids) {
        const c = componentes[id];
        if (!c.motivosInelegibilidade.includes('componente_selecionado_inconclusivo')) c.motivosInelegibilidade.push('componente_selecionado_inconclusivo');
        c.elegivel = false;
      }
    }
  }
  return { versao, id: entrada.id, contribuinte: entrada.contribuinte, ...(perfil ? { perfil } : {}),
    duracaoS: entrada.duracaoS, concluido: entrada.concluido === true, sistema, ids, componentes };
}

export function chaveGrupo(dados, id) {
  const c = dados.componentes[id];
  const h = c.hardware;
  return JSON.stringify([dados.versao, dados.perfil || null, id, dados.sistema.tipo, normalizar(dados.sistema.so), normalizar(dados.sistema.navegador), dados.sistema.energia,
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
