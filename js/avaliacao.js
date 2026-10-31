// Definição das métricas e regras do veredito por componente (puro, testado em Node).
import { resumir } from './metricas.js';

// tipo 'media': mostra média/mín/máx. tipo 'contador': valor acumulado (usa o último).
// maiorMelhor define o sentido da "queda" de desempenho.
export const METRICAS = {
  cpu: [
    { chave: 'gflops', rotulo: 'Desempenho FFT', unidade: 'GFLOPS', casas: 2, tipo: 'media', maiorMelhor: true,
      explica: 'Bilhões de operações de ponto flutuante por segundo na FFT (a mesma família de cálculo do Prime95).' },
    { chave: 'llps', rotulo: 'Lucas-Lehmer', unidade: 'iter/s', casas: 0, tipo: 'media', maiorMelhor: true,
      explica: 'Iterações por segundo do teste de primalidade de Mersenne, em inteiros grandes.' },
    { chave: 'clock', rotulo: 'Clock efetivo (estimado)', unidade: 'GHz', casas: 2, tipo: 'media', maiorMelhor: true,
      explica: 'Estimativa por uma cadeia de operações de 1 ciclo. Não é a leitura do sensor; serve para ver se o clock cai com o tempo.' },
    { chave: 'erros', rotulo: 'Erros de cálculo', unidade: '', casas: 0, tipo: 'contador',
      explica: 'Resultados conferidos que deram diferente do esperado. Num PC saudável é sempre zero.' },
    { chave: 'verificacoes', rotulo: 'Verificações feitas', unidade: '', casas: 0, tipo: 'contador',
      explica: 'Quantos resultados (primos de Mersenne e FFTs) foram conferidos.' },
    { chave: 'tempC', rotulo: 'Temperatura (sensor)', unidade: '°C', casas: 0, tipo: 'media', maiorMelhor: false, plugin: true,
      explica: 'Temperatura do processador lida pelo aplicativo ou plugin, com fonte identificada. Os limites térmicos variam por aparelho; não confundir com bateria ou carcaça.' },
    { chave: 'clockReal', rotulo: 'Clock real (sensor)', unidade: 'GHz', casas: 2, tipo: 'media', maiorMelhor: true, plugin: true,
      explica: 'Frequência média dos núcleos lida pelo plugin (ou pelo contador de desempenho do Windows).' },
    { chave: 'potenciaW', rotulo: 'Potência do pacote', unidade: 'W', casas: 0, tipo: 'media', maiorMelhor: false, plugin: true,
      explica: 'Energia consumida pelo processador. Cai junto com o clock quando há limite térmico ou de energia.' },
    { chave: 'cargaPct', rotulo: 'Uso da CPU', unidade: '%', casas: 0, tipo: 'media', maiorMelhor: true, plugin: true,
      explica: 'Quanto do processador estava ocupado. Num teste de estresse deve ficar perto de 100%.' },
  ],
  gpu: [
    { chave: 'passadasPorSegundo', rotulo: 'Trabalho de cena concluído', unidade: 'passadas/s', casas: 1, tipo: 'media', maiorMelhor: true,
      explica: 'Execuções da cena concluídas por segundo. É trabalho equivalente de shader, não FPS apresentado no display.' },
    { chave: 'lotesConcluidosPorSegundo', rotulo: 'Lotes concluídos', unidade: 'lotes/s', casas: 1, tipo: 'media', maiorMelhor: true,
      explica: 'Lotes cuja conclusão foi confirmada por fence WebGL2. Não representam quadros exibidos na tela.' },
    { chave: 'rafPorSegundo', rotulo: 'Ritmo de requestAnimationFrame', unidade: 'callbacks/s', casas: 1, tipo: 'media', maiorMelhor: true,
      explica: 'Callbacks observados na interface. Mede o ritmo de agendamento do navegador, não a renderização física.' },
    { chave: 'passadasPorLote', rotulo: 'Passadas por lote', unidade: 'passadas', casas: 1, tipo: 'media', maiorMelhor: true,
      explica: 'Quantidade adaptativa de execuções da cena em cada lote concluído no intervalo.' },
    { chave: 'tempoGpuMs', rotulo: 'Tempo de GPU (timer query)', unidade: 'ms', casas: 2, tipo: 'media', maiorMelhor: false,
      explica: 'Tempo medido pela extensão EXT_disjoint_timer_query_webgl2, somente quando disponível e sem disjoint. Ausência não é estimada.' },
    { chave: 'tempoParedeLoteMs', rotulo: 'Tempo de parede por lote', unidade: 'ms', casas: 1, tipo: 'media', maiorMelhor: false,
      explica: 'Tempo entre o início do lote e a conclusão observada pela página; inclui espera e escalonamento.' },
    { chave: 'mpixPorSegundo', rotulo: 'Pixel-shading equivalente', unidade: 'Mpix/s', casas: 0, tipo: 'media', maiorMelhor: true,
      explica: 'Passadas por segundo × pixels da resolução interna. É vazão equivalente de shader, não pixels exibidos.' },
    { chave: 'divergenciasReferencia', rotulo: 'Divergências de autoconsistência', unidade: '', casas: 0, tipo: 'contador',
      explica: 'Imagens fixas que divergiram da primeira referência no mesmo ambiente, acima da tolerância. Não comprovam correção absoluta nem defeito físico isolado.' },
    { chave: 'tempC', rotulo: 'Temperatura (sensor)', unidade: '°C', casas: 0, tipo: 'media', maiorMelhor: false, plugin: true,
      explica: 'Temperatura da GPU lida pelo aplicativo ou plugin, com fonte identificada. Os limites variam por aparelho; bateria e carcaça são sensores separados.' },
    { chave: 'hotspotC', rotulo: 'Hot spot (sensor)', unidade: '°C', casas: 0, tipo: 'media', maiorMelhor: false, plugin: true,
      explica: 'Ponto mais quente do chip. Diferença muito grande para a temperatura do núcleo sugere pasta térmica ruim.' },
    { chave: 'clockMHz', rotulo: 'Clock real (sensor)', unidade: 'MHz', casas: 0, tipo: 'media', maiorMelhor: true, plugin: true,
      explica: 'Frequência do núcleo gráfico lida pelo plugin.' },
    { chave: 'potenciaW', rotulo: 'Potência da GPU', unidade: 'W', casas: 0, tipo: 'media', maiorMelhor: false, plugin: true,
      explica: 'Energia consumida pela placa de vídeo.' },
    { chave: 'cargaPct', rotulo: 'Uso da GPU', unidade: '%', casas: 0, tipo: 'media', maiorMelhor: true, plugin: true,
      explica: 'Quanto da GPU estava ocupada pelo teste.' },
  ],
  memoria: [
    { chave: 'escritaGBs', rotulo: 'Banda de escrita', unidade: 'GB/s', casas: 1, tipo: 'media', maiorMelhor: true,
      explica: 'Velocidade de gravação em blocos grandes de memória.' },
    { chave: 'leituraGBs', rotulo: 'Banda de leitura', unidade: 'GB/s', casas: 1, tipo: 'media', maiorMelhor: true,
      explica: 'Velocidade de leitura sequencial.' },
    { chave: 'copiaGBs', rotulo: 'Banda de cópia', unidade: 'GB/s', casas: 1, tipo: 'media', maiorMelhor: true,
      explica: 'Cópia de bloco para bloco. Memórias mais rápidas (frequência e canais) dão números maiores.' },
    { chave: 'latenciaNs', rotulo: 'Latência aproximada', unidade: 'ns', casas: 0, tipo: 'media', maiorMelhor: false,
      explica: 'Tempo médio de um acesso aleatório fora do cache.' },
    { chave: 'gbVerificados', rotulo: 'Dados verificados', unidade: 'GB', casas: 1, tipo: 'contador',
      explica: 'Total gravado e conferido com os padrões de teste.' },
    { chave: 'erros', rotulo: 'Erros de memória', unidade: '', casas: 0, tipo: 'contador',
      explica: 'Palavras que voltaram diferentes do que foi gravado. Qualquer valor acima de zero é grave.' },
    { chave: 'freqMTs', rotulo: 'Frequência (SPD/SMBIOS)', unidade: 'MT/s', casas: 0, tipo: 'media', maiorMelhor: true, plugin: true,
      explica: 'Velocidade em que os pentes estão rodando, informada pela placa-mãe. Se for menor que a da etiqueta do pente, o perfil XMP/EXPO pode estar desligado.' },
    { chave: 'tempC', rotulo: 'Temperatura dos pentes', unidade: '°C', casas: 0, tipo: 'media', maiorMelhor: false, plugin: true,
      explica: 'Só em pentes com sensor (comum em DDR5) e com o driver PawnIO.' },
  ],
  disco: [
    { chave: 'seqLeitura', rotulo: 'Leitura sequencial (1 MiB)', unidade: 'MB/s', casas: 0, tipo: 'media', maiorMelhor: true,
      explica: 'Arquivos grandes sendo lidos. Pode incluir o cache do sistema.' },
    { chave: 'seqEscrita', rotulo: 'Escrita sequencial (1 MiB)', unidade: 'MB/s', casas: 0, tipo: 'media', maiorMelhor: true,
      explica: 'Arquivos grandes sendo gravados.' },
    { chave: 'rndLeitura', rotulo: 'Leitura aleatória (4 KiB)', unidade: 'MB/s', casas: 1, tipo: 'media', maiorMelhor: true,
      explica: 'Pedaços pequenos espalhados: é o que mais pesa na sensação de rapidez do sistema.' },
    { chave: 'rndEscrita', rotulo: 'Escrita aleatória (4 KiB)', unidade: 'MB/s', casas: 1, tipo: 'media', maiorMelhor: true,
      explica: 'Gravação de pedaços pequenos espalhados.' },
    { chave: 'iops', rotulo: 'IOPS 4 KiB (leitura)', unidade: 'IOPS', casas: 0, tipo: 'media', maiorMelhor: true,
      explica: 'Operações de 4 KiB por segundo.' },
    { chave: 'ciclos', rotulo: 'Ciclos completos', unidade: '', casas: 0, tipo: 'contador',
      explica: 'Ciclos de fases concluídos. A cobertura usa o acompanhamento por segundo; as velocidades entram só quando uma fase produz medição.' },
    { chave: 'erros', rotulo: 'Erros de verificação', unidade: '', casas: 0, tipo: 'contador',
      explica: 'Blocos lidos diferentes do que foi gravado.' },
    { chave: 'tempC', rotulo: 'Temperatura (sensor)', unidade: '°C', casas: 0, tipo: 'media', maiorMelhor: false, plugin: true,
      explica: 'Temperatura do disco testado, lida pelo plugin. SSDs passam a reduzir a velocidade perto de 70 °C; HDDs preferem ficar abaixo de 50 °C.' },
  ],
  pressao: [
    { chave: 'estado', rotulo: 'Pressão de CPU/térmica', unidade: '', casas: 1, tipo: 'media', maiorMelhor: false,
      explica: 'Compute Pressure API: 0 = nominal, 1 = razoável, 2 = séria, 3 = crítica. Reflete uso e estado térmico.' },
  ],
};

export const NOMES = { cpu: 'CPU', gpu: 'GPU', memoria: 'Memória', disco: 'Disco', pressao: 'Pressão do sistema' };
export const ESTADOS_PRESSAO = ['nominal', 'fair', 'serious', 'critical'];

export const METRICAS_GPU_V1 = [
  { chave: 'fps', rotulo: 'Passadas por segundo (legado v1)', unidade: 'passadas/s (rotulado FPS no v1)', casas: 1, tipo: 'media', maiorMelhor: true,
    explica: 'No protocolo v1 este campo chamava FPS, mas contava passadas de trabalho. O valor histórico é preservado sem virar passadas/s do protocolo v2.' },
  { chave: 'mpix', rotulo: 'Vazão de pixels (legado v1)', unidade: 'Mpix/s', casas: 0, tipo: 'media', maiorMelhor: true,
    explica: 'Pixel-shading equivalente calculado pelo motor histórico v1.' },
  { chave: 'frameMs', rotulo: 'Tempo derivado (legado v1)', unidade: 'ms (não é tempo de quadro)', casas: 1, tipo: 'media', maiorMelhor: false,
    explica: 'Valor histórico 1000/FPS. Não era uma medição de tempo de quadro e não deve ser usado como tal.' },
  { chave: 'artefatos', rotulo: 'Divergências de referência (legado v1)', unidade: '', casas: 0, tipo: 'contador',
    explica: 'Divergências de autoconsistência visual registradas pelo motor v1; não são prova isolada de defeito físico.' },
];

export const METRICAS_V1 = { ...METRICAS, gpu: [...METRICAS_GPU_V1, ...METRICAS.gpu.filter((m) => m.plugin)] };
export const metricasParaVersao = (versao = 2) => versao === 1 ? METRICAS_V1 : METRICAS;

const QUEDA_ATENCAO = { cpu: 12, gpu: 12, memoria: Infinity, disco: 50 };
const PRINCIPAL = { cpu: 'gflops', gpu: 'passadasPorSegundo', memoria: 'copiaGBs', disco: 'seqEscrita' };

export function resumirComponente(componente, series, tempos = null, opcoes = {}) {
  const atuais = METRICAS[componente] || [];
  const legadas = componente === 'gpu' ? METRICAS_GPU_V1 : [];
  const definicoes = opcoes.versao ? metricasParaVersao(opcoes.versao)[componente] || [] : [...atuais, ...legadas];
  const saida = {};
  for (const m of definicoes) {
    const valores = series[m.chave] || [];
    const r = resumir(valores, { temposS: tempos?.[m.chave], duracaoAlvoS: opcoes.duracaoAlvoS, intervaloEsperadoS: opcoes.intervaloEsperadoS });
    saida[m.chave] = m.tipo === 'contador'
      ? { total: valores.length ? valores[valores.length - 1] : null, n: r.n, tempoUtilS: r.tempoUtilS, cobertura: r.cobertura }
      : r;
  }
  return saida;
}

function principalDoResumo(componente, resumo) {
  if (componente === 'gpu' && !resumo.passadasPorSegundo?.n && resumo.fps?.n) return resumo.fps;
  return resumo[PRINCIPAL[componente]];
}

export function medicaoSuficiente(componente, resumo, execucao = {}, perfil = 'personalizado') {
  if (componente === 'pressao') return Object.values(execucao.distribuicao || {}).some((n) => n > 0);
  const r = principalDoResumo(componente, resumo);
  if (!r?.n || !(r.media > 0)) return false;
  const explicita = Object.keys(execucao).length > 0;
  const alvo = Number.isFinite(execucao.duracaoAlvoS) && execucao.duracaoAlvoS > 0 ? execucao.duracaoAlvoS : null;
  const utilMinimo = alvo ? (perfil === 'rapido' || alvo === 120 ? Math.min(100, alvo * 0.8) : alvo * 0.8) : 10;
  if (componente === 'disco' && explicita) {
    if (!(execucao.ciclos >= 1)) return false;
    const acompanhamento = resumo.erros;
    if (acompanhamento?.tempoUtilS === null || acompanhamento?.tempoUtilS === undefined) return false;
    return acompanhamento.tempoUtilS >= utilMinimo && acompanhamento.cobertura !== null && acompanhamento.cobertura >= 0.8;
  }
  const minimoAmostras = explicita && alvo ? Math.min(alvo === 120 ? 100 : Math.ceil(alvo * 0.8), Math.max(10, Math.floor(execucao.duracaoRealS || 0))) : 10;
  if (r.n < minimoAmostras) return false;
  if (r.tempoUtilS !== null && r.tempoUtilS !== undefined) {
    if (r.tempoUtilS < utilMinimo || r.cobertura === null || r.cobertura < 0.8) return false;
  } else if (explicita && alvo && perfil === 'rapido') return false;
  return true;
}

function resultado(status, titulo, motivos, execucao = 'concluida', diagnostico = null, confiabilidade = 'moderada') {
  return { status, titulo, motivos, execucao,
    diagnostico: diagnostico || (status === 'falha' ? 'erros_verificados' : status === 'atencao' ? 'atencao_desempenho' : status === 'ok' ? 'sem_erros_detectados' : 'inconclusivo'),
    confiabilidadeMedicao: status === 'na' && execucao === 'falha_motor' ? 'indisponivel' : confiabilidade };
}

export function avaliar(componente, resumo, extra = {}) {
  const motivos = [];
  let status = 'ok';
  const piora = (novo) => {
    const ordem = { na: 0, ok: 1, atencao: 2, falha: 3 };
    if (ordem[novo] > ordem[status]) status = novo;
  };
  const erros = resumo.erros?.total ?? resumo.divergenciasReferencia?.total ?? resumo.artefatos?.total ?? 0;
  const incompleta = extra.execucao?.concluido === false;

  if (componente === 'pressao') {
    const dist = extra.distribuicao || {};
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    if (!total) return resultado('na', 'Indisponível', ['Navegador sem Compute Pressure API (disponível no Chrome e no Edge).'], 'concluida', 'inconclusivo', 'indisponivel');
    const criticas = (dist.critical || 0) / total;
    const serias = (dist.serious || 0) / total;
    const quedaCpu = extra.quedaCpu ?? null;
    if (criticas > 0.05 && quedaCpu !== null && quedaCpu >= QUEDA_ATENCAO.cpu) {
      status = 'atencao';
      motivos.push(`O sistema ficou em pressão crítica em ${(criticas * 100).toFixed(0)}% do tempo e a CPU perdeu ${quedaCpu.toFixed(0)}% de desempenho: a refrigeração está no limite.`);
    } else if (criticas > 0.05) {
      motivos.push(`Pressão crítica em ${(criticas * 100).toFixed(0)}% do tempo, o esperado com o processador em carga total. Sem queda da CPU, isso isoladamente não indica problema.`);
    } else {
      motivos.push(`Pressão crítica em ${(criticas * 100).toFixed(0)}% do tempo e séria em ${(serias * 100).toFixed(0)}%.`);
    }
    return resultado(status, status === 'ok' ? 'Medida disponível' : 'Atenção', motivos);
  }

  if (extra.falhaFatal && !(erros > 0)) {
    return resultado('na', 'Inconclusivo: falha do motor', [extra.falhaFatal, 'Falha de execução, alocação, contexto ou limpeza não comprova defeito físico do componente.'], 'falha_motor', 'inconclusivo', 'indisponivel');
  }

  if (erros > 0) {
    status = 'falha';
    const textos = {
      cpu: `${erros} erro(s) de cálculo verificado(s). O resultado conhecido divergiu; overclock/undervolt, tensão, temperatura ou defeito são possibilidades a investigar.`,
      gpu: `${erros} divergência(s) de autoconsistência visual. Driver, memória, clock, temperatura ou a própria execução podem contribuir; o teste não isola a causa física.`,
      memoria: `${erros} erro(s) de memória verificado(s). Dado gravado voltou diferente: pente, XMP/EXPO ou contato devem ser investigados; confirme com outra ferramenta.`,
      disco: `${erros} bloco(s) corrompido(s) na verificação. Faça backup e confira a saúde do disco com uma ferramenta nativa.`,
    };
    motivos.push(textos[componente] || `${erros} erro(s) verificado(s).`);
  }

  const r = principalDoResumo(componente, resumo);
  if (!(erros > 0) && !medicaoSuficiente(componente, resumo, extra.execucao || {}, extra.perfil)) {
    const porque = !r?.n
      ? componente === 'gpu' ? 'Nenhuma passada de cena concluída entrou na métrica principal. A aba oculta e a compilação inicial ficam de fora.' : 'O teste não produziu a métrica principal necessária.'
      : `Medição insuficiente: ${r.n} amostra(s) válidas${r.tempoUtilS !== null && r.tempoUtilS !== undefined ? `, ${r.tempoUtilS.toFixed(1)} s úteis e ${((r.cobertura || 0) * 100).toFixed(0)}% de cobertura` : ''}.`;
    return resultado('na', 'Dados insuficientes', [porque, 'Sensores ou contadores auxiliares não substituem a métrica principal.'], incompleta ? 'incompleta' : 'concluida', 'inconclusivo', 'baixa');
  }

  if (!(erros > 0) && incompleta) {
    const motivo = extra.disparoTemp
      ? `O teste foi interrompido pela proteção de temperatura: ${NOMES[componente]} chegou a ${Math.round(extra.disparoTemp.temp)} °C, acima do limite de ${extra.disparoTemp.limite} °C.`
      : extra.execucao?.motivo || 'A carga não concluiu a duração prevista.';
    return resultado(extra.disparoTemp ? 'atencao' : 'na', extra.disparoTemp ? 'Interrompido pela proteção' : 'Execução incompleta',
      [motivo, 'Os dados parciais ficam disponíveis para auditoria, mas não sustentam aprovação nem conclusão sobre estabilidade.'], 'interrompida', extra.disparoTemp ? 'atencao_desempenho' : 'inconclusivo');
  }

  const qualidade = componente === 'disco' ? resumo.erros : r;
  const confiabilidade = qualidade?.cobertura === null || qualidade?.cobertura === undefined ? 'moderada' : qualidade.cobertura >= 0.95 ? 'alta_relativa' : qualidade.cobertura >= 0.8 ? 'moderada' : 'baixa';
  if (qualidade?.tempoUtilS !== null && qualidade?.tempoUtilS !== undefined) {
    motivos.push(componente === 'disco'
      ? `Acompanhamento: ${qualidade.n} janelas, ${qualidade.tempoUtilS.toFixed(1)} s úteis e ${(qualidade.cobertura * 100).toFixed(0)}% de cobertura; ${r.n} medições de fase e ${extra.execucao?.ciclos || 0} ciclo(s) completo(s).`
      : `Qualidade da métrica principal: ${r.n} amostras válidas, ${r.tempoUtilS.toFixed(1)} s úteis e ${(r.cobertura * 100).toFixed(0)}% de cobertura.`);
  }

  if (r && Number.isFinite(r.queda)) {
    const quedaSustentada = Number.isFinite(r.quedaPicoSustentadaPct) ? r.quedaPicoSustentadaPct : null;
    const quedaAvaliada = Math.max(r.queda, quedaSustentada ?? -Infinity);
    if (quedaAvaliada >= QUEDA_ATENCAO[componente]) {
      piora('atencao');
      const porque = extra.movel
        ? 'Pode haver limite térmico, de energia ou disputa por recursos. Sem sensor correspondente não é possível confirmar aquecimento.'
        : 'Pode haver limite térmico, de energia ou disputa por recursos; a queda sozinha não determina a causa.';
      motivos.push(`Desempenho caiu ${r.queda.toFixed(0)}% do início para o fim${quedaSustentada !== null ? ` e ${quedaSustentada.toFixed(0)}% em relação ao melhor intervalo de 5 s` : ''}. ${porque}`);
    } else if (componente === 'memoria' && r.queda >= 15) {
      motivos.push(`A banda variou ${r.queda.toFixed(0)}% do início para o fim. Na memória isso pode ser disputa com outros testes ou programas, não defeito.`);
    } else if (r.queda <= -5) {
      motivos.push(`Desempenho subiu ${Math.abs(r.queda).toFixed(0)}% do início para o fim; aquecimento do motor e liberação de recursos podem influenciar.`);
    } else {
      motivos.push(`Variação de ${Math.abs(r.queda).toFixed(0)}% entre as janelas inicial e final.`);
    }
  }

  const temp = resumo.tempC;
  if (temp?.n && !extra.disparoTemp) {
    const limites = { cpu: [90, 'a CPU está no limite térmico e pode reduzir o clock para se proteger'],
      gpu: [88, 'a GPU está quente a ponto de reduzir o clock'],
      memoria: [80, 'os pentes estão acima do limite preventivo configurado'],
      disco: [65, 'o disco está quente; SSDs podem reduzir a velocidade e HDDs se desgastam mais rápido'] }[componente];
    const doUsuario = Number.isFinite(extra.limiteTemp) && limites && extra.limiteTemp < limites[0];
    const limite = limites && (doUsuario ? extra.limiteTemp : limites[0]);
    if (limites && temp.max >= limite) {
      piora('atencao');
      const porque = doUsuario ? `acima do limite de ${extra.limiteTemp} °C que você definiu` : limites[1];
      motivos.push(`Temperatura chegou a ${temp.max.toFixed(0)} °C (média ${temp.media.toFixed(0)} °C): ${porque}. ${extra.movel ? 'Pare o teste e aguarde o celular esfriar, fora do carregador.' : 'Verifique cooler, pasta térmica, poeira e fluxo de ar.'}`);
    } else if (limites) {
      motivos.push(`Temperatura medida: média ${temp.media.toFixed(0)} °C, máxima ${temp.max.toFixed(0)} °C.`);
    }
  }

  if (extra.disparoTemp) {
    piora('atencao');
    motivos.unshift(`A proteção registrou ${NOMES[componente]} a ${Math.round(extra.disparoTemp.temp)} °C, acima do limite de ${extra.disparoTemp.limite} °C.`);
  }
  if (extra.saudeDisco === 'ruim') { piora('falha'); motivos.push('O SMART do disco testado indica falha. Faça backup imediatamente.'); }
  else if (extra.saudeDisco === 'cuidado') { piora('atencao'); motivos.push('O SMART do disco testado pede cuidado (veja a saúde dos discos abaixo).'); }
  if (extra.falhaFatal) motivos.push(`A execução também registrou: ${extra.falhaFatal}`);
  if (extra.avisos) motivos.push(...extra.avisos);
  const titulos = { ok: 'Concluído sem erros', atencao: 'Atenção', falha: 'Erros verificados', na: 'Inconclusivo' };
  return resultado(status, titulos[status], motivos, extra.falhaFatal ? 'falha_motor' : 'concluida', null, confiabilidade);
}

export function vereditoGeral(avaliacoes) {
  const lista = Object.values(avaliacoes);
  if (lista.some((a) => a.status === 'falha')) return { status: 'falha', titulo: 'Erros verificados durante o teste' };
  if (lista.some((a) => a.status === 'na')) return { status: 'na', titulo: 'Resultado inconclusivo: execução ou dados insuficientes' };
  if (lista.some((a) => a.status === 'atencao')) return { status: 'atencao', titulo: 'Sem erros verificados, mas há pontos de atenção' };
  if (lista.length && lista.every((a) => a.status === 'ok')) return { status: 'ok', titulo: 'Sem erros detectados nos componentes concluídos' };
  return { status: 'na', titulo: 'Sem dados suficientes' };
}
