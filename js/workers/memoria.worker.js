// Carga de memória inspirada no MemTest86: grava padrões conhecidos num bloco grande e
// confere cada palavra. Também mede banda (escrita, leitura, cópia) e latência.

const FATIA = 1 << 22; // 4 Mi palavras (16 MiB) por vez
const RELATO_MS = 500;

let buf = null;
let rodando = false;
let erros = 0;
let bytesVerificados = 0;
let acc = { escritos: 0, tEsc: 0, lidos: 0, tLei: 0, copiados: 0, tCop: 0 };
let latenciaNs = null;
let ultimoRelato = 0;
let sorvedouro = 0;
let passadas = 0;

function relatar(forcar = false) {
  const agora = performance.now();
  if (!forcar && agora - ultimoRelato < RELATO_MS) return;
  ultimoRelato = agora;
  postMessage({
    tipo: 'relato',
    escritaGBs: acc.tEsc ? acc.escritos / acc.tEsc / 1e6 : null,
    leituraGBs: acc.tLei ? acc.lidos / acc.tLei / 1e6 : null,
    copiaGBs: acc.tCop ? acc.copiados / acc.tCop / 1e6 : null,
    latenciaNs,
    erros,
    bytesVerificados,
    passadas,
  });
  acc = { escritos: 0, tEsc: 0, lidos: 0, tLei: 0, copiados: 0, tCop: 0 };
}

const ceder = () => new Promise((ok) => setTimeout(ok, 0));

// Percorre o buffer em fatias, chamando fn(inicio, fim) e cedendo a vez entre elas.
async function porFatias(fn, descendente = false) {
  const n = buf.length;
  if (!descendente) {
    for (let a = 0; a < n && rodando; a += FATIA) { fn(a, Math.min(n, a + FATIA)); relatar(); await ceder(); }
  } else {
    for (let b = n; b > 0 && rodando; b -= FATIA) { fn(Math.max(0, b - FATIA), b); relatar(); await ceder(); }
  }
}

function contarErro(qtd) {
  if (!qtd) return;
  erros += qtd;
  postMessage({ tipo: 'erro', qtd });
}

// Padrão fixo: escreve com fill (memset nativo = banda de escrita) e confere lendo.
async function padraoFixo(valor) {
  await porFatias((a, b) => {
    const t0 = performance.now();
    buf.fill(valor, a, b);
    acc.tEsc += performance.now() - t0;
    acc.escritos += (b - a) * 4;
  });
  await porFatias((a, b) => {
    const t0 = performance.now();
    let ruins = 0;
    let soma = 0;
    for (let i = a; i < b; i++) { const v = buf[i]; soma ^= v; if (v !== valor) ruins++; }
    acc.tLei += performance.now() - t0;
    acc.lidos += (b - a) * 4;
    sorvedouro ^= soma;
    bytesVerificados += (b - a) * 4;
    contarErro(ruins);
  });
}

// Xadrez: alterna dois valores entre palavras vizinhas.
async function xadrez(p, q) {
  await porFatias((a, b) => { for (let i = a; i < b; i++) buf[i] = (i & 1) ? q : p; });
  await porFatias((a, b) => {
    let ruins = 0;
    for (let i = a; i < b; i++) if (buf[i] !== ((i & 1) ? q : p)) ruins++;
    bytesVerificados += (b - a) * 4;
    contarErro(ruins);
  });
}

// Endereço próprio: cada palavra guarda o próprio índice embaralhado (pega falhas de endereçamento).
async function enderecoProprio(semente) {
  await porFatias((a, b) => { for (let i = a; i < b; i++) buf[i] = (i ^ semente) >>> 0; });
  await porFatias((a, b) => {
    let ruins = 0;
    for (let i = a; i < b; i++) if (buf[i] !== ((i ^ semente) >>> 0)) ruins++;
    bytesVerificados += (b - a) * 4;
    contarErro(ruins);
  });
}

// Inversões móveis: sobe conferindo p e gravando ~p, desce conferindo ~p e gravando p.
async function inversoesMoveis(p) {
  const np = (~p) >>> 0;
  buf.fill(p);
  await porFatias((a, b) => {
    let ruins = 0;
    for (let i = a; i < b; i++) { if (buf[i] !== p) ruins++; buf[i] = np; }
    bytesVerificados += (b - a) * 4;
    contarErro(ruins);
  });
  await porFatias((a, b) => {
    let ruins = 0;
    for (let i = b - 1; i >= a; i--) { if (buf[i] !== np) ruins++; buf[i] = p; }
    bytesVerificados += (b - a) * 4;
    contarErro(ruins);
  }, true);
}

// Aleatório: xorshift32 com semente; a conferência regenera a mesma sequência.
async function aleatorio(semente) {
  const gerar = (a, b, conferir) => {
    let x = (semente ^ Math.imul(a, 2654435761)) >>> 0 || 1;
    let ruins = 0;
    for (let i = a; i < b; i++) {
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      if (conferir) { if (buf[i] !== x) ruins++; } else buf[i] = x;
    }
    return ruins;
  };
  await porFatias((a, b) => gerar(a, b, false));
  await porFatias((a, b) => { contarErro(gerar(a, b, true)); bytesVerificados += (b - a) * 4; });
}

// Cópia: copyWithin (memmove nativo) entre as metades do buffer, depois confere.
async function copia() {
  const meio = buf.length >> 1;
  for (let a = 0; a < meio && rodando; a += FATIA) {
    const b = Math.min(meio, a + FATIA);
    const t0 = performance.now();
    buf.copyWithin(meio + a, a, b);
    acc.tCop += performance.now() - t0;
    acc.copiados += (b - a) * 4 * 2; // lê e grava
    let ruins = 0;
    for (let i = a; i < b; i += 64) if (buf[i] !== buf[meio + i]) ruins++;
    contarErro(ruins);
    relatar();
    await ceder();
  }
}

// Latência: caminho aleatório circular (algoritmo de Sattolo) numa área de 64 MiB.
function medirLatencia() {
  const n = Math.min(buf.length, 1 << 24);
  const area = buf.subarray(0, n);
  for (let i = 0; i < n; i++) area[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    const t = area[i]; area[i] = area[j]; area[j] = t;
  }
  const passos = 2_000_000;
  let p = 0;
  const t0 = performance.now();
  for (let k = 0; k < passos; k++) p = area[p];
  const dt = performance.now() - t0;
  sorvedouro ^= p;
  latenciaNs = (dt * 1e6) / passos;
}

async function laco() {
  let semente = 0x9e3779b9;
  let bit = 0;
  while (rodando) {
    if (passadas % 2 === 0) medirLatencia();
    await padraoFixo(0x00000000);
    await padraoFixo(0xffffffff);
    await xadrez(0x55555555, 0xaaaaaaaa);
    await padraoFixo((1 << (bit++ % 32)) >>> 0); // walking one: um bit por passada
    await enderecoProprio(semente);
    await inversoesMoveis(0x5a5a5a5a);
    await aleatorio(semente);
    await copia();
    semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0;
    passadas++;
    relatar(true);
  }
}

onmessage = (e) => {
  const d = e.data || {};
  if (d.cmd === 'iniciar' && !rodando) {
    try {
      buf = new Uint32Array(Math.floor(d.bytes / 4));
    } catch (err) {
      postMessage({ tipo: 'falhaAlocacao', msg: String(err) });
      return;
    }
    postMessage({ tipo: 'alocado', bytes: buf.byteLength });
    rodando = true;
    ultimoRelato = performance.now();
    laco();
  }
  if (d.cmd === 'parar') rodando = false;
};
