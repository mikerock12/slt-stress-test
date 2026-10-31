// Relatório final: veredito, médias por componente, gráficos e exportação (PDF/JSON/texto).
import { METRICAS, NOMES, avaliar, resumirComponente, vereditoGeral } from './avaliacao.js';
import { formatarDuracao, formatarNumero } from './metricas.js';
import { graficoRelatorio } from './graficos.js';
import { DOWNLOAD, descricaoMemoria } from './plugin.js';
import { integrarComparacao } from './ranking.js';
import { BUILD } from './build.js';

const ESTADOS_DISCO = { bom: 'Bom', cuidado: 'Cuidado', ruim: 'Ruim' };
const FASES_CDM = [
  ['seq1mq8Leitura', 'SEQ1M Q8', 'leitura'], ['seq1mq8Escrita', 'SEQ1M Q8', 'escrita'],
  ['seq1mq1Leitura', 'SEQ1M Q1', 'leitura'], ['seq1mq1Escrita', 'SEQ1M Q1', 'escrita'],
  ['rnd4kq32Leitura', 'RND4K Q32', 'leitura'], ['rnd4kq32Escrita', 'RND4K Q32', 'escrita'],
  ['rnd4kq1Leitura', 'RND4K Q1', 'leitura'], ['rnd4kq1Escrita', 'RND4K Q1', 'escrita'],
];

// Disco físico (SMART do plugin) que contém a unidade testada.
function discoDaUnidade(saude, unidade) {
  return (saude || []).find((d) => d.letras?.includes(unidade));
}

const PRINCIPAL = { cpu: 'gflops', gpu: 'passadasPorSegundo', memoria: 'copiaGBs', disco: 'seqEscrita', pressao: 'estado' };
const ESCOPOS = {
  cpu: 'Confere FFT e Lucas–Lehmer nas threads selecionadas. Não mede todos os núcleos nem comprova a causa de uma queda sem sensores.',
  gpu: 'Mede trabalho de shader concluído e autoconsistência de imagens no mesmo ambiente. Não mede FPS do display nem comprova correção absoluta da GPU.',
  memoria: 'Verifica somente os buffers alocados neste processo. O volume acumulado verificado é separado da capacidade alocada e não cobre toda a RAM.',
  disco: 'Mede o caminho de armazenamento selecionado. OPFS e Android podem incluir cache; somente o plugin Windows identifica seu método sem cache.',
  pressao: 'Usa a Compute Pressure API quando disponível; é um sinal auxiliar, não um termômetro.',
};

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function estabilidade(cv) {
  if (cv === null || cv === undefined) return '—';
  if (cv < 3) return `muito estável (${formatarNumero(cv, 1)}%)`;
  if (cv < 8) return `estável (${formatarNumero(cv, 1)}%)`;
  if (cv < 15) return `oscilando (${formatarNumero(cv, 1)}%)`;
  return `instável (${formatarNumero(cv, 1)}%)`;
}

// Calcula tudo o que o relatório mostra; separado do HTML para virar o JSON exportado.
export function analisar(dados) {
  const componentes = {};
  const opcoesResumo = { duracaoAlvoS: dados.duracaoAlvoS || dados.duracaoS };
  const quedaCpu = dados.componentes.cpu ? resumirComponente('cpu', dados.componentes.cpu.series, dados.componentes.cpu.tempos, opcoesResumo).gflops.queda : null;
  const duracaoConcluida = !dados.duracaoAlvoS || dados.duracaoS >= Math.max(0, dados.duracaoAlvoS - 5);
  const concluidoBase = dados.motivo === 'Tempo concluído' && duracaoConcluida && !dados.oculta && !dados.interrupcaoAndroid && !dados.interrupcaoMovel && !dados.protecao?.disparo;
  for (const [id, c] of Object.entries(dados.componentes)) {
    const resumo = resumirComponente(id, c.series, c.tempos, opcoesResumo);
    const avisos = [...(c.info?.avisos || [])];
    const fisico = id === 'disco' && c.info?.modo === 'nativo' ? discoDaUnidade(dados.saudeDiscos, c.info.unidade) : null;
    const falhaFatal = c.falhaFatal || c.info?.falhaFatal;
    const avaliacao = avaliar(id, resumo, {
      falhaFatal,
      execucao: { concluido: concluidoBase && !falhaFatal, motivo: dados.motivo, duracaoAlvoS: dados.duracaoAlvoS, duracaoRealS: dados.duracaoS, distribuicao: c.info?.distribuicao, ciclos: c.info?.ciclos ?? resumo.ciclos?.total },
      perfil: dados.perfil,
      distribuicao: c.info?.distribuicao,
      quedaCpu,
      movel: dados.sistema?.dispositivo?.tipo === 'celular',
      disparoTemp: dados.protecao?.disparo?.componente === id ? dados.protecao.disparo : null,
      limiteTemp: dados.protecao?.limites?.ativa ? dados.protecao.limites[id] : undefined,
      saudeDisco: fisico?.avaliacao?.estado,
      avisos,
    });
    componentes[id] = { resumo, avaliacao, info: c.info };
  }
  const avaliacoes = Object.fromEntries(Object.entries(componentes).filter(([id]) => id !== 'pressao').map(([id, c]) => [id, c.avaliacao]));
  const geral = vereditoGeral(avaliacoes);
  const errosMedidos = Object.values(componentes).some((c) => (c.resumo.erros?.total || 0) > 0 || (c.resumo.divergenciasReferencia?.total || 0) > 0 || (c.resumo.artefatos?.total || 0) > 0);
  const falhaExecucao = !errosMedidos && Object.values(dados.componentes).some((c) => c.falhaFatal || c.info?.falhaFatal);
  if (geral.status === 'na' && falhaExecucao) geral.titulo = 'Teste inconclusivo: falha na execução';
  if (componentes.pressao?.avaliacao.status === 'atencao' && geral.status === 'ok') {
    geral.status = 'atencao';
    geral.titulo = 'Sem erros verificados, mas há pontos de atenção';
  }
  if (dados.protecao?.disparo && geral.status !== 'falha') {
    geral.status = 'atencao';
    geral.titulo = 'Interrompido pela proteção de temperatura';
  }
  if (dados.interrupcaoAndroid && !errosMedidos) {
    geral.status = 'atencao';
    geral.titulo = 'Teste interrompido no Android';
  }
  if (dados.interrupcaoMovel && !errosMedidos) {
    geral.status = 'atencao';
    geral.titulo = 'Interrompido pela proteção de carga do celular';
  }
  return { geral, componentes, falhaExecucao };
}

function textoProtecao(p) {
  if (!p) return '';
  const max = (k) => (p.maxima?.[k] === null || p.maxima?.[k] === undefined ? 'sem leitura' : `${Math.round(p.maxima[k])} °C`);
  const limites = p.limites.ativa
    ? `limites CPU ${p.limites.cpu} °C e GPU ${p.limites.gpu} °C`
    : 'desligada (só registrou as temperaturas)';
  const disparo = p.disparo
    ? `<strong class="ruim-texto">Disparou: ${esc(NOMES[p.disparo.componente])} a ${Math.round(p.disparo.temp)} °C, e todos os testes foram parados.</strong>`
    : (p.limites.ativa ? 'Não disparou.' : '');
  return `<p><strong>Proteção de temperatura:</strong> ${esc(limites)}. Máximas: CPU ${esc(max('cpu'))}, GPU ${esc(max('gpu'))}. ${disparo}</p>`;
}

function linhaMetricas(id, resumo) {
  return METRICAS[id].map((m) => {
    const r = resumo[m.chave];
    if (!r || (m.tipo !== 'contador' && !r.n)) return '';
    if (m.tipo === 'contador') {
      return `<tr><th scope="row">${esc(m.rotulo)}</th><td colspan="4" class="${r.total > 0 && /erro|artefato|divergência/i.test(m.rotulo) ? 'ruim' : ''}">
        <strong>${formatarNumero(r.total, m.casas)}</strong> ${esc(m.unidade)}</td></tr>`;
    }
    return `<tr><th scope="row">${esc(m.rotulo)}</th>
      <td><strong>${formatarNumero(r.media, m.casas)}</strong> ${esc(m.unidade)}</td>
      <td>${formatarNumero(r.min, m.casas)}</td><td>${formatarNumero(r.max, m.casas)}</td>
      <td>${esc(estabilidade(r.cv))}</td></tr>`;
  }).join('');
}

function qualidadePrincipal(id, resumo, info = {}) {
  const r = resumo[PRINCIPAL[id]];
  const m = METRICAS[id]?.find((item) => item.chave === PRINCIPAL[id]);
  if (!r?.n || !m) return '';
  const temporal = id === 'disco' ? resumo.erros : r;
  const itens = [`P5 ${formatarNumero(r.p5, m.casas)} ${m.unidade}`, `P50 ${formatarNumero(r.p50, m.casas)}`, `P95 ${formatarNumero(r.p95, m.casas)}`];
  if (temporal?.tempoUtilS !== null && temporal?.tempoUtilS !== undefined) itens.push(`${formatarNumero(temporal.tempoUtilS, 1)} s úteis`, `${formatarNumero(temporal.cobertura * 100, 0)}% de cobertura do acompanhamento`);
  if (id === 'disco') itens.push(`${r.n} medições de fase`, `${info.ciclos ?? resumo.ciclos?.total ?? 0} ciclo(s) completo(s)`);
  if (r.regressoesIntermediarias !== null && r.regressoesIntermediarias !== undefined) itens.push(`${r.regressoesIntermediarias} regressão(ões) intermediária(s) sustentada(s)`);
  return `<p class="nota"><strong>Janelas temporais da métrica principal:</strong> ${esc(itens.join(' · '))}.</p>`;
}

function detalheInfo(id, info = {}, opcoes = {}) {
  const itens = [];
  if (id === 'cpu') itens.push(`${info.threads ?? opcoes.threads} threads`);
  if (id === 'gpu') itens.push(info.renderer, info.resolucao, `${info.passos} passos de raymarching`, info.motor, `tempo GPU: ${info.tempoGpuMetodo || 'não disponível'}`);
  if (id === 'memoria') itens.push(`${info.alocadoMiB ?? opcoes.mib} MiB alocados no processo`);
  if (id === 'disco' && info.modo === 'nativo') itens.push(`disco real ${info.unidade} sem cache (plugin)`);
  if (id === 'disco' && info.modo === 'android') itens.push('armazenamento nativo Android · SEQ1M/RND4K Q1 · leitura pode incluir cache · escrita sincronizada pela API');
  else if (id === 'disco' && info.modo !== 'nativo') itens.push('armazenamento do navegador (OPFS) · cache possível');
  if (id === 'disco') itens.push(`arquivo de ${info.arquivoMiB ?? opcoes.mib} MiB`, `${info.ciclos ?? 0} ciclo(s) completos`);
  return itens.filter(Boolean).map(esc).join(' · ');
}

function textoResumo(dados, analise) {
  const linhas = [
    `SLT Stress Test — ${dados.modo}`,
    `Data: ${dados.inicio.toLocaleString('pt-BR')} · Duração: ${formatarDuracao(dados.duracaoS)}`,
    `Resultado geral: ${analise.geral.titulo}`,
    '',
  ];
  for (const [id, c] of Object.entries(analise.componentes)) {
    if (c.avaliacao.status === 'na' && id === 'pressao') continue;
    linhas.push(`${NOMES[id]}: ${c.avaliacao.titulo} · execução ${c.avaliacao.execucao} · diagnóstico ${c.avaliacao.diagnostico}`);
    linhas.push(`  Escopo: ${ESCOPOS[id]}`);
    for (const m of METRICAS[id]) {
      const r = c.resumo[m.chave];
      if (!r || (m.tipo !== 'contador' && !r.n)) continue;
      const v = m.tipo === 'contador' ? r.total : r.media;
      linhas.push(`  ${m.rotulo}: ${formatarNumero(v, m.casas)} ${m.unidade}${m.tipo === 'media' ? ' (média)' : ''}`.trimEnd());
    }
    for (const motivo of c.avaliacao.motivos) linhas.push(`  → ${motivo}`);
  }
  linhas.push('', 'https://stresstest.smellsliketech.com.br');
  return linhas.join('\n');
}

export function gerarRelatorio(container, dados) {
  const analise = analisar(dados);
  const { geral } = analise;
  const s = dados.sistema || {};
  const temPressao = Object.keys(analise.componentes.pressao?.info?.distribuicao || {}).length > 0;
  const ids = [...dados.ids, ...(temPressao ? ['pressao'] : [])];

  const cartoes = ids.map((id) => {
    const c = analise.componentes[id];
    if (!c) return '';
    const a = c.avaliacao;
    return `<article class="cartao comp ${a.status}">
      <header>
        <h3>${esc(NOMES[id])}</h3>
        <span class="chip ${a.status}">${esc(a.titulo)}</span>
      </header>
      <p class="detalhe">${detalheInfo(id, c.info, dados.opcoes?.[id])}</p>
      <p class="nota"><strong>Escopo:</strong> ${esc(ESCOPOS[id])}</p>
      <p class="detalhe">Execução: ${esc(a.execucao)} · diagnóstico: ${esc(a.diagnostico)} · confiabilidade relativa da medição: ${esc(a.confiabilidadeMedicao)}.</p>
      <ul class="motivos">${a.motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <canvas class="grafico" height="120" data-grafico="${id}"></canvas>
      ${qualidadePrincipal(id, c.resumo, c.info)}
      <div class="tabela-rolagem"><table class="tabela compacta">
        <thead><tr><th>Medida</th><th>Média</th><th>Mín</th><th>Máx</th><th>Estabilidade</th></tr></thead>
        <tbody>${linhaMetricas(id, c.resumo)}</tbody>
      </table></div>
      <details class="explica"><summary>O que cada número significa</summary>
        <dl>${METRICAS[id].filter((m) => { const r = c.resumo[m.chave]; return r && (m.tipo === 'contador' ? r.total !== null : r.n); }).map((m) => `<dt>${esc(m.rotulo)}</dt><dd>${esc(m.explica)}</dd>`).join('')}</dl>
      </details>
    </article>`;
  }).join('');

  const erros = (dados.eventos || []).filter((e) => e.tipo === 'erro');
  const infoDisco = analise.componentes.disco?.info;
  const cdm = infoDisco?.modo === 'nativo' && Object.keys(infoDisco.resultados || {}).length
    ? `<article class="cartao">
        <h3>Disco real ${esc(infoDisco.unidade)}: resultado completo</h3>
        <p class="nota">Último ciclo completo, sem o cache do Windows (no estilo do CrystalDiskMark). Q = pedidos simultâneos.</p>
        <div class="grade-cdm">${FASES_CDM.map(([k, nome, tipo]) => {
          const r = infoDisco.resultados[k];
          return `<div><small>${nome} ${tipo}</small><strong>${r ? formatarNumero(r.mbs, r.mbs < 10 ? 2 : 0) : '—'}</strong> <small>MB/s${r && k.startsWith('rnd') ? ` · ${formatarNumero(r.iops, 0)} IOPS` : ''}</small></div>`;
        }).join('')}</div>
      </article>`
    : '';
  const saude = dados.saudeDiscos?.length
    ? `<article class="cartao">
        <h3>Saúde dos discos (SMART)</h3>
        <div class="saude">${dados.saudeDiscos.map((d) => `<div class="saude-disco">
          <strong>${esc(d.nome)} ${d.letras?.length ? `(${esc(d.letras.join(', '))})` : ''}</strong>
          <span class="chip ${esc(d.avaliacao?.estado)}">${esc(ESTADOS_DISCO[d.avaliacao?.estado] || 'Desconhecida')}</span>
          <p class="detalhe">${[
            `${d.tipo} ${d.barramento}`, `${formatarNumero(d.tamanhoGB, 0)} GB`,
            d.tempC ? `${d.tempC} °C agora` : null, d.tempMaxC ? `máx. registrada ${d.tempMaxC} °C` : null,
            d.horasLigado ? `${formatarNumero(d.horasLigado, 0)} h ligado` : null,
            d.tipo === 'SSD' && d.desgastePct !== undefined && d.desgastePct !== null ? `vida útil usada ${d.desgastePct}%` : null,
            d.errosNaoCorrigidos ? `${d.errosNaoCorrigidos} erro(s) não corrigidos` : null,
          ].filter(Boolean).map(esc).join(' · ')}</p>
          <p class="detalhe">${(d.avaliacao?.motivos || []).map(esc).join(' ')}</p>
        </div>`).join('')}</div>
      </article>`
    : '';
  const sensoresReais = dados.plugin
    ? `<article class="cartao indisponivel">
        <h3>Sensores reais (plugin v${esc(dados.plugin.versao)})</h3>
        <p>Temperatura, clocks e potência acima vieram dos sensores do hardware, lidos pelo SLT Stress Test Plugin.
          ${dados.plugin.memoria ? `Memória instalada: <strong>${esc(dados.plugin.memoria)}</strong>.` : ''}</p>
        ${dados.plugin.pawnio ? '' : '<p class="nota">O driver PawnIO não estava instalado, então a temperatura e o clock por núcleo da CPU ficaram de fora (o clock veio do contador do Windows). O plugin 1.2.0 inclui o driver; use “Instalar PawnIO incluído” no menu da bandeja e reabra o plugin.</p>'}
        ${textoProtecao(dados.protecao)}
        <p class="nota">Valores que o seu hardware não informa simplesmente não aparecem: nada foi estimado no lugar.</p>
      </article>`
    : null;
  const temCPU = dados.ids.includes('cpu');
  const temGPU = dados.ids.includes('gpu');

  container.innerHTML = `
    <div class="relatorio-cab">
      <div>
        <p class="selo">Relatório · ${esc(dados.modo)}</p>
        <h2>Resultado do teste</h2>
        <p class="meta">${esc(dados.inicio.toLocaleString('pt-BR'))} · duração ${formatarDuracao(dados.duracaoS)}
          ${dados.duracaoAlvoS ? `de ${formatarDuracao(dados.duracaoAlvoS)} previstos` : '(sem limite)'} · ${esc(dados.motivo)}</p>
      </div>
      <div class="relatorio-acoes nao-imprimir">
        <button type="button" class="botao" data-acao="pdf">Imprimir / PDF</button>
        <button type="button" class="botao" data-acao="json">Baixar JSON</button>
        <button type="button" class="botao" data-acao="copiar">Copiar resumo</button>
        <button type="button" class="botao primario" data-acao="novo">Novo teste</button>
      </div>
    </div>

    <div class="veredito ${geral.status}">
      <span class="veredito-icone" aria-hidden="true">${{ ok: '✔', atencao: '!', falha: '✖', na: '?' }[geral.status]}</span>
      <div>
        <strong>${esc(geral.titulo)}</strong>
        <p>${(dados.interrupcaoAndroid || dados.interrupcaoMovel) && geral.status !== 'falha' ? esc(dados.interrupcaoAndroid || dados.interrupcaoMovel) : dados.protecao?.disparo && geral.status !== 'falha'
          ? `O teste parou porque a ${esc(NOMES[dados.protecao.disparo.componente])} passou do limite de ${dados.protecao.disparo.limite} °C que você definiu. Os dados parciais não atestam estabilidade; confira a refrigeração antes de repetir.`
          : {
          ok: `As cargas selecionadas concluíram ${formatarDuracao(dados.duracaoS)} sem erros verificados nas áreas medidas. Este resultado vale para a configuração e a cobertura mostradas; não é certificação integral do hardware.`,
          atencao: 'Não houve erros verificados, mas desempenho, temperatura ou interrupção exigem atenção. A queda isoladamente não comprova calor nem defeito.',
          falha: analise.falhaExecucao ? 'Uma carga não conseguiu concluir ou confirmar a limpeza. Isso não comprova defeito do hardware. Consulte o motivo abaixo e aguarde a liberação dos recursos antes de repetir.' : 'Foram encontrados erros nos dados ou cálculos verificados. A ferramenta distingue esses erros de uma falha de execução; veja o componente e o escopo abaixo.',
          na: 'A execução não concluiu o perfil ou faltam métrica principal, tempo útil ou cobertura. Dados parciais ficam disponíveis, sem aprovação global.',
        }[geral.status]}</p>
      </div>
    </div>

    <div class="grade-relatorio">${cartoes}</div>

    ${cdm || saude ? `<div class="grade-dupla">${cdm}${saude}</div>` : ''}

    ${dados.android ? `<article class="cartao"><h3>Dados nativos do Android</h3>
      <p>${esc(dados.android.marca)} ${esc(dados.android.modelo)} · Android ${esc(dados.android.android)}.
        CPU, memória e armazenamento usam cargas nativas. A GPU usa WebGL2.</p>
      ${dados.android.emulado ? '<p class="alerta">Ambiente emulado: serve para validar o funcionamento e fica fora das médias de hardware físico.</p>' : ''}
      <dl class="lista-sistema">
        <div><dt>Processador / SoC</dt><dd>${esc(dados.android.cpu?.modelo || 'não disponível')}</dd></div>
        <div><dt>RAM informada pelo Android</dt><dd>${Number.isFinite(dados.android.memoria?.totalGB) ? `${formatarNumero(dados.android.memoria.totalGB, 2)} GiB` : 'não disponível'}</dd></div>
        <div><dt>Frequência da RAM</dt><dd>${dados.android.memoria?.frequenciaMTs ? `${formatarNumero(dados.android.memoria.frequenciaMTs, 0)} MT/s` : 'não disponível'}</dd></div>
        <div><dt>Temperatura da bateria</dt><dd>${Number.isFinite(dados.sensoresAndroid?.bateria?.tempC) ? `${formatarNumero(dados.sensoresAndroid.bateria.tempC, 1)} °C` : 'não disponível'}</dd></div>
      </dl>
      <p class="nota">Temperatura da bateria é uma leitura separada da CPU/GPU. Sensores dependem do fabricante; valores ausentes não foram estimados. Modelo dos chips de memória e SMART não são expostos pela API pública do Android.</p>
      <details><summary>Todos os dados coletados e suas fontes</summary><pre>${esc(JSON.stringify({ inventario: dados.android, sensoresFinais: dados.sensoresAndroid }, null, 2))}</pre></details>
    </article>` : sensoresReais ?? `<article class="cartao indisponivel">
      <h3>Temperatura e clocks reais</h3>
      <p>Por segurança, o navegador não deixa sites lerem sensores. Por isso <strong>temperatura média,
        clock real da GPU e frequência da memória não aparecem aqui</strong> e não foram inventados.
        No lugar, use os sinais indiretos acima:</p>
      <ul>
        ${temCPU ? '<li><strong>CPU</strong>: queda de desempenho pode indicar limite térmico, de energia ou disputa por recursos. Sem sensor, não confirma temperatura.</li>' : ''}
        ${temGPU ? '<li><strong>GPU</strong>: queda de passadas por segundo também pode decorrer de limite térmico, de energia ou disputa por recursos.</li>' : ''}
        ${s.dispositivo?.tipo === 'celular' ? '<li>No iPhone, o navegador não oferece temperatura de CPU/GPU. No Android, o APK tenta fontes legíveis sem root; a disponibilidade varia entre fabricantes. Se esquentar, pare e aguarde esfriar, fora do carregador.</li>' : `<li>Para as temperaturas exatas, deixe o <a href="https://github.com/LibreHardwareMonitor/LibreHardwareMonitor" target="_blank" rel="noopener">LibreHardwareMonitor</a>
          ou o <a href="https://www.hwinfo.com/" target="_blank" rel="noopener">HWiNFO</a> aberto durante o teste e anote os máximos.
          Para a saúde do disco, use o <a href="https://crystalmark.info/en/software/crystaldiskinfo/" target="_blank" rel="noopener">CrystalDiskInfo</a>.</li>
        <li>Ou baixe o <a href="${DOWNLOAD}">SLT Stress Test Plugin</a> (Windows): com ele, temperatura, clocks reais, frequência da memória e SMART entram neste relatório.</li>`}
      </ul>
    </article>`}

    <div class="grade-dupla">
      <article class="cartao">
        <h3>Sistema testado</h3>
        <dl class="lista-sistema">
          <div><dt>Processador</dt><dd>${esc(s.threads ? `${s.threads} threads` : '—')}</dd></div>
          <div><dt>GPU</dt><dd>${esc(s.gpu || '—')}</dd></div>
          <div><dt>Memória RAM</dt><dd>${esc(descricaoMemoria({ plugin: dados.inventario, android: dados.android }))}</dd></div>
          <div><dt>Sistema</dt><dd>${esc(`${s.so || ''} · ${s.navegador || ''}`)}</dd></div>
          ${s.bateria ? `<div><dt>Energia</dt><dd>${s.bateria.carregando ? 'na tomada' : 'na bateria'}</dd></div>` : ''}
        </dl>
      </article>
      <article class="cartao">
        <h3>Erros registrados</h3>
        ${erros.length
          ? `<ol class="lista-erros">${erros.slice(0, 30).map((e) => `<li><time>${formatarDuracao(e.t)}</time> ${esc(e.msg)}</li>`).join('')}</ol>
             ${erros.length > 30 ? `<p class="nota">…e mais ${erros.length - 30}. Todos estão no JSON.</p>` : ''}`
          : '<p class="bom">Nenhum erro durante o teste.</p>'}
      </article>
    </div>

    <p class="nota"><strong>Comparabilidade:</strong> metodologia v2. GPU v3 mede passadas/s, lotes/s e RAF separadamente;
      não compare esses valores com o campo “FPS” do protocolo v1. CPU, memória e disco mantêm seus motores,
      mas a cobertura temporal passa a fazer parte da elegibilidade. Build ${esc(BUILD.version)} · commit ${esc(BUILD.commit || 'não disponível nesta execução local')}.</p>`;

  for (const canvas of container.querySelectorAll('[data-grafico]')) {
    const id = canvas.dataset.grafico;
    const chave = PRINCIPAL[id];
    const m = METRICAS[id].find((x) => x.chave === chave);
    graficoRelatorio(canvas, dados.componentes[id]?.series[chave] || [], { unidade: m.unidade, casas: m.casas, duracaoS: dados.duracaoS });
    canvas.setAttribute('aria-label', `Gráfico de ${m.rotulo} ao longo do teste`);
  }

  const texto = textoResumo(dados, analise);
  integrarComparacao(container, dados);
  container.querySelector('.relatorio-acoes').addEventListener('click', async (e) => {
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'pdf') { if (dados.android) globalThis.SLTAndroid.imprimir(); else window.print(); }
    if (acao === 'novo') document.dispatchEvent(new CustomEvent('slt:novo-teste'));
    if (acao === 'copiar') {
      try { await navigator.clipboard.writeText(texto); e.target.textContent = 'Copiado!'; }
      catch { e.target.textContent = 'Não foi possível copiar'; }
      setTimeout(() => { e.target.textContent = 'Copiar resumo'; }, 2000);
    }
    if (acao === 'json') {
      const json = JSON.stringify({ versao: 2, schemaVersion: 2, benchmarkMethodVersion: 2,
        buildVersion: BUILD.version, commit: BUILD.commit, buildTimestamp: BUILD.builtAt, exportadoEm: new Date().toISOString(), ...dados, analise }, null, 2);
      if (dados.android) { globalThis.SLTAndroid.exportar(json); return; }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `slt-stresstest-${dados.inicio.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
}
