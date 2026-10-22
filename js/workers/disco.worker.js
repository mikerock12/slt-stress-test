// Carga de disco inspirada no CrystalDiskMark, usando um arquivo temporário no OPFS
// (armazenamento privado do site). Ciclo: escrita sequencial 1 MiB, leitura sequencial,
// leitura aleatória 4 KiB e escrita aleatória 4 KiB. Cada página de 4 KiB leva um carimbo
// que é conferido na leitura.

const NOME = 'slt-stresstest.bin';
const MIB = 1024 * 1024;
const PAGINA = 4096;
const PAGINAS_POR_BLOCO = MIB / PAGINA;
const RELATO_MS = 500;
const FASE_ALEATORIA_MS = 4000;

let rodando = false;
let handle = null;
let pasta = null;
let erros = 0;
let semente = 0;
const base = new Uint32Array(MIB / 4);
const bloco = new Uint32Array(MIB / 4);
const pagina = new Uint32Array(PAGINA / 4);

(function prepararBase() {
  let x = 0x1234567;
  for (let i = 0; i < base.length; i++) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    base[i] = x;
  }
})();

const carimbo = (pag) => (Math.imul(pag, 2654435761) ^ semente) >>> 0;
const ceder = () => new Promise((ok) => setTimeout(ok, 0));

function montarBloco(b) {
  bloco.set(base);
  for (let p = 0; p < PAGINAS_POR_BLOCO; p++) bloco[p * 1024] = carimbo(b * PAGINAS_POR_BLOCO + p);
}

function conferirPagina(dados, offsetPalavra, pag) {
  const off = (pag % PAGINAS_POR_BLOCO) * 1024;
  if (dados[offsetPalavra] !== carimbo(pag)) return 1;
  const k = 1 + (pag % 1023);
  return dados[offsetPalavra + k] !== base[off + k] ? 1 : 0;
}

function contarErro(qtd) {
  if (!qtd) return;
  erros += qtd;
  postMessage({ tipo: 'erro', qtd });
}

// Medidor de vazão por janela: relata a taxa parcial a cada RELATO_MS.
function medidor(chave) {
  let bytes = 0;
  let ops = 0;
  let t0 = performance.now();
  return {
    somar(b) {
      bytes += b; ops++;
      const agora = performance.now();
      if (agora - t0 >= RELATO_MS) this.relatar(agora);
    },
    relatar(agora = performance.now()) {
      const s = (agora - t0) / 1000;
      if (s <= 0 || !bytes) return;
      const msg = { tipo: 'relato', erros, [chave]: bytes / s / 1e6 };
      if (chave === 'rndLeitura') msg.iops = ops / s;
      postMessage(msg);
      bytes = 0; ops = 0; t0 = agora;
    },
  };
}

async function escritaSequencial(blocos) {
  const m = medidor('seqEscrita');
  for (let b = 0; b < blocos && rodando; b++) {
    montarBloco(b);
    handle.write(bloco, { at: b * MIB });
    if (b % 64 === 63) handle.flush();
    m.somar(MIB);
    if (b % 8 === 7) await ceder();
  }
  handle.flush();
  m.relatar();
}

async function leituraSequencial(blocos) {
  const m = medidor('seqLeitura');
  for (let b = 0; b < blocos && rodando; b++) {
    handle.read(bloco, { at: b * MIB });
    let ruins = 0;
    for (let p = 0; p < PAGINAS_POR_BLOCO; p++) ruins += conferirPagina(bloco, p * 1024, b * PAGINAS_POR_BLOCO + p);
    contarErro(ruins);
    m.somar(MIB);
    if (b % 8 === 7) await ceder();
  }
  m.relatar();
}

async function aleatoria(blocos, escrever) {
  const m = medidor(escrever ? 'rndEscrita' : 'rndLeitura');
  const totalPaginas = blocos * PAGINAS_POR_BLOCO;
  const fim = performance.now() + FASE_ALEATORIA_MS;
  let n = 0;
  while (rodando && performance.now() < fim) {
    const pag = Math.floor(Math.random() * totalPaginas);
    if (escrever) {
      const off = (pag % PAGINAS_POR_BLOCO) * 1024;
      pagina.set(base.subarray(off, off + 1024));
      pagina[0] = carimbo(pag);
      handle.write(pagina, { at: pag * PAGINA });
    } else {
      handle.read(pagina, { at: pag * PAGINA });
      contarErro(conferirPagina(pagina, 0, pag));
    }
    m.somar(PAGINA);
    if (++n % 256 === 0) await ceder();
  }
  if (escrever) handle.flush();
  m.relatar();
}

async function limpar() {
  try { handle?.close(); } catch { /* já fechado */ }
  handle = null;
  try { await pasta?.removeEntry(NOME); } catch { /* não existia */ }
}

async function laco(mib) {
  pasta = await navigator.storage.getDirectory();
  await limpar();
  const arquivo = await pasta.getFileHandle(NOME, { create: true });
  handle = await arquivo.createSyncAccessHandle();
  postMessage({ tipo: 'pronto' });
  let ciclo = 0;
  while (rodando) {
    semente = (0xa5a5a5a5 ^ Math.imul(ciclo + 1, 40503)) >>> 0;
    await escritaSequencial(mib);
    await leituraSequencial(mib);
    await aleatoria(mib, false);
    await aleatoria(mib, true);
    await aleatoria(mib, false); // relê o que acabou de ser regravado
    ciclo++;
    postMessage({ tipo: 'ciclo', ciclo });
  }
  await limpar();
  postMessage({ tipo: 'encerrado' });
}

onmessage = (e) => {
  const d = e.data || {};
  if (d.cmd === 'iniciar' && !rodando) {
    rodando = true;
    laco(d.mib).catch(async (err) => {
      rodando = false;
      await limpar();
      postMessage({ tipo: 'falha', msg: String(err?.message || err) });
    });
  }
  if (d.cmd === 'parar') {
    if (rodando) rodando = false;
    else postMessage({ tipo: 'encerrado' });
  }
};
