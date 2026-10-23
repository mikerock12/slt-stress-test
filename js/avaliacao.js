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
      explica: 'Temperatura real do processador lida pelo plugin. Até ~85 °C sob carga total é normal; perto de 95–100 °C a CPU reduz o clock para se proteger.' },
    { chave: 'clockReal', rotulo: 'Clock real (sensor)', unidade: 'GHz', casas: 2, tipo: 'media', maiorMelhor: true, plugin: true,
      explica: 'Frequência média dos núcleos lida pelo plugin (ou pelo contador de desempenho do Windows).' },
    { chave: 'potenciaW', rotulo: 'Potência do pacote', unidade: 'W', casas: 0, tipo: 'media', maiorMelhor: false, plugin: true,
      explica: 'Energia consumida pelo processador. Cai junto com o clock quando há limite térmico ou de energia.' },
    { chave: 'cargaPct', rotulo: 'Uso da CPU', unidade: '%', casas: 0, tipo: 'media', maiorMelhor: true, plugin: true,
      explica: 'Quanto do processador estava ocupado. Num teste de estresse deve ficar perto de 100%.' },
  ],
  gpu: [
    { chave: 'fps', rotulo: 'Quadros por segundo', unidade: 'FPS', casas: 1, tipo: 'media', maiorMelhor: true,
      explica: 'Quantas vezes por segundo a GPU desenhou a cena pesada na resolução escolhida.' },
    { chave: 'mpix', rotulo: 'Vazão de pixels', unidade: 'Mpix/s', casas: 0, tipo: 'media', maiorMelhor: true,
      explica: 'Milhões de pixels sombreados por segundo (FPS × pixels × passadas).' },
    { chave: 'frameMs', rotulo: 'Tempo por quadro', unidade: 'ms', casas: 1, tipo: 'media', maiorMelhor: false,
      explica: 'Quanto cada quadro levou. Picos indicam engasgos.' },
    { chave: 'artefatos', rotulo: 'Artefatos detectados', unidade: '', casas: 0, tipo: 'contador',
      explica: 'Quadros de referência que saíram diferentes do original. Indica erro de cálculo da GPU ou da VRAM.' },
    { chave: 'tempC', rotulo: 'Temperatura (sensor)', unidade: '°C', casas: 0, tipo: 'media', maiorMelhor: false, plugin: true,
      explica: 'Temperatura do núcleo da GPU lida pelo plugin. Até ~83 °C sob carga é comum; acima de ~90 °C a placa reduz o clock.' },
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

// Limite de queda de desempenho (%) que sugere throttling.
// Memória não tem throttling térmico relevante: a queda dela é só informativa.
const QUEDA_ATENCAO = { cpu: 12, gpu: 12, memoria: Infinity, disco: 50 };

export function resumirComponente(componente, series) {
  const saida = {};
  for (const m of METRICAS[componente] || []) {
    const valores = series[m.chave] || [];
    saida[m.chave] = m.tipo === 'contador'
      ? { total: valores.length ? valores[valores.length - 1] : 0 }
      : resumir(valores);
  }
  return saida;
}

// Retorna { status: 'ok'|'atencao'|'falha'|'na', titulo, motivos: [] }.
export function avaliar(componente, resumo, extra = {}) {
  const motivos = [];
  let status = 'ok';
  const piora = (novo) => {
    const ordem = { na: 0, ok: 1, atencao: 2, falha: 3 };
    if (ordem[novo] > ordem[status]) status = novo;
  };

  if (extra.falhaFatal) {
    return { status: 'falha', titulo: 'Falhou', motivos: [extra.falhaFatal] };
  }

  const amostras = Object.values(resumo).reduce((n, r) => Math.max(n, r.n || 0), 0);
  if (componente !== 'pressao' && amostras === 0) {
    const porque = componente === 'gpu'
      ? 'Nenhum quadro foi medido: a aba ficou escondida ou minimizada e o navegador pausou a animação.'
      : 'O teste não chegou a produzir medições.';
    return { status: 'na', titulo: 'Sem dados', motivos: [porque] };
  }

  const erros = resumo.erros?.total ?? resumo.artefatos?.total ?? 0;
  if (erros > 0) {
    piora('falha');
    const textos = {
      cpu: `${erros} erro(s) de cálculo. A CPU errou contas que tinham resultado conhecido: típico de overclock/undervolt instável, tensão insuficiente ou superaquecimento.`,
      gpu: `${erros} quadro(s) com artefato. A GPU produziu imagem diferente da referência: overclock, VRAM com defeito ou superaquecimento.`,
      memoria: `${erros} erro(s) de memória. Dado gravado voltou diferente: pente com defeito, XMP/EXPO instável ou mau contato. Confirme com o Memtest86+.`,
      disco: `${erros} bloco(s) corrompido(s) na verificação. Faça backup e confira a saúde do disco no CrystalDiskInfo.`,
    };
    motivos.push(textos[componente] || `${erros} erro(s).`);
  }

  const principal = { cpu: 'gflops', gpu: 'fps', memoria: 'copiaGBs', disco: 'seqEscrita' }[componente];
  const r = principal && resumo[principal];
  if (r && r.queda !== null && r.queda !== undefined) {
    if (r.queda >= QUEDA_ATENCAO[componente]) {
      piora('atencao');
      const porque = {
        cpu: 'Sinal clássico de thermal throttling: a CPU esquentou e reduziu o clock. Verifique pasta térmica, cooler e fluxo de ar.',
        gpu: 'A GPU perdeu desempenho com o tempo, sinal de limite térmico ou de energia. Verifique ventoinhas, poeira e pasta térmica.',
        memoria: 'A banda caiu bastante; pode ser outro programa disputando a memória ou throttling do controlador.',
        disco: 'A escrita caiu muito: comum quando o cache SLC do SSD se esgota ou quando o SSD esquenta.',
      };
      motivos.push(`Desempenho caiu ${r.queda.toFixed(0)}% do início para o fim. ${porque[componente]}`);
    } else if (componente === 'memoria' && r.queda >= 15) {
      motivos.push(`A banda variou ${r.queda.toFixed(0)}% do início para o fim. Na memória isso costuma ser disputa com outros testes ou programas, não defeito.`);
    } else if (r.queda <= -5) {
      motivos.push(`Desempenho subiu ${Math.abs(r.queda).toFixed(0)}% do início para o fim (comum no começo, enquanto o teste se ajusta ou outro programa libera recursos). Sem sinal de throttling.`);
    } else {
      motivos.push(`Desempenho estável do início ao fim (variação de ${Math.abs(r.queda).toFixed(0)}%). Sem sinal de throttling.`);
    }
  }

  // Temperatura real (só com o plugin). Se a proteção parou o teste, o motivo dela já diz
  // tudo; e o limite definido pela pessoa vale quando é mais baixo que o padrão.
  const temp = resumo.tempC;
  if (temp && temp.n && !extra.disparoTemp) {
    const limites = { cpu: [90, 'a CPU está no limite térmico e reduz o clock para se proteger'],
      gpu: [88, 'a GPU está quente a ponto de reduzir o clock'],
      memoria: [80, 'os pentes estão quentes demais'],
      disco: [65, 'o disco está quente; SSDs reduzem a velocidade e HDDs se desgastam mais rápido'] }[componente];
    const doUsuario = Number.isFinite(extra.limiteTemp) && limites && extra.limiteTemp < limites[0];
    const limite = limites && (doUsuario ? extra.limiteTemp : limites[0]);
    if (limites && temp.max >= limite) {
      piora('atencao');
      const porque = doUsuario ? `acima do limite de ${extra.limiteTemp} °C que você definiu` : limites[1];
      motivos.push(`Temperatura chegou a ${temp.max.toFixed(0)} °C (média ${temp.media.toFixed(0)} °C): ${porque}. Verifique cooler, pasta térmica, poeira e fluxo de ar.`);
    } else if (limites) {
      motivos.push(`Temperatura sob controle: média ${temp.media.toFixed(0)} °C, máxima ${temp.max.toFixed(0)} °C.`);
    }
  }

  if (componente === 'pressao') {
    const dist = extra.distribuicao || {};
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    if (!total) return { status: 'na', titulo: 'Indisponível', motivos: ['Navegador sem Compute Pressure API (disponível no Chrome e no Edge).'] };
    const criticas = (dist.critical || 0) / total;
    const serias = (dist.serious || 0) / total;
    // Sob carga total a pressão fica crítica em qualquer PC: sozinha não é defeito. Só pede
    // atenção quando a CPU também perdeu desempenho (sinal de refrigeração no limite).
    const quedaCpu = extra.quedaCpu ?? null;
    const comQueda = quedaCpu !== null && quedaCpu >= QUEDA_ATENCAO.cpu;
    if (criticas > 0.05 && comQueda) {
      piora('atencao');
      motivos.push(`O sistema ficou em pressão crítica em ${(criticas * 100).toFixed(0)}% do tempo e a CPU perdeu ${quedaCpu.toFixed(0)}% de desempenho: a refrigeração está no limite.`);
    } else if (criticas > 0.05) {
      motivos.push(`Pressão crítica em ${(criticas * 100).toFixed(0)}% do tempo, o esperado com o processador em carga total. Como o desempenho não caiu, não indica problema.`);
    } else {
      motivos.push(`Pressão crítica em ${(criticas * 100).toFixed(0)}% do tempo e séria em ${(serias * 100).toFixed(0)}%.`);
    }
  }

  if (extra.disparoTemp) {
    piora('atencao');
    motivos.unshift(`O teste foi interrompido pela proteção de temperatura: ${NOMES[componente]} chegou a ${Math.round(extra.disparoTemp.temp)} °C, acima do limite de ${extra.disparoTemp.limite} °C. Melhore a refrigeração (cooler, pasta térmica, poeira, fluxo de ar) antes de repetir; os números deste teste valem só até a parada.`);
  }

  if (extra.saudeDisco === 'ruim') { piora('falha'); motivos.push('O SMART do disco testado indica falha. Faça backup imediatamente.'); }
  else if (extra.saudeDisco === 'cuidado') { piora('atencao'); motivos.push('O SMART do disco testado pede cuidado (veja a saúde dos discos abaixo).'); }
  if (extra.avisos) motivos.push(...extra.avisos);
  const titulos = { ok: 'Aprovado', atencao: 'Atenção', falha: 'Falhou', na: 'Sem dados' };
  return { status, titulo: titulos[status], motivos };
}

export function vereditoGeral(avaliacoes) {
  const lista = Object.values(avaliacoes);
  if (lista.some((a) => a.status === 'falha')) return { status: 'falha', titulo: 'Reprovado: foram encontrados erros' };
  if (lista.some((a) => a.status === 'atencao')) return { status: 'atencao', titulo: 'Aprovado com ressalvas' };
  if (lista.some((a) => a.status === 'ok')) return { status: 'ok', titulo: 'Aprovado: sistema estável' };
  return { status: 'na', titulo: 'Sem dados suficientes' };
}
