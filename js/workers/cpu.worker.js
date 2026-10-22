// Carga de CPU inspirada no Prime95: alterna dois trabalhos com resposta conhecida.
// 1) Lucas-Lehmer em BigInt para expoentes de primos de Mersenne conhecidos: o resíduo final
//    tem de ser zero. Qualquer outro valor é erro de hardware.
// 2) FFT complexa de 4096 pontos (cabe no cache, como os "small FFTs" do Prime95), ida e
//    volta: o resultado tem de ser idêntico a cada repetição e voltar ao sinal original.

const EXPOENTES = [3217, 4253, 4423, 9689, 9941, 11213];
const N_FFT = 4096;
const RELATO_MS = 500;

let sorvedouro = 0;

// ---------- Lucas-Lehmer ----------
let ll = null;
let indiceExpoente = 0;

function novoLL() {
  const p = EXPOENTES[indiceExpoente++ % EXPOENTES.length];
  const pb = BigInt(p);
  return { p, pb, m: (1n << pb) - 1n, s: 4n, i: 0 };
}

function modMersenne(x, st) {
  while (x > st.m) x = (x & st.m) + (x >> st.pb);
  return x === st.m ? 0n : x;
}

// Faz iterações até `limite` ms. Retorna { iter, conferido, erro }.
function passoLL(limite) {
  if (!ll) ll = novoLL();
  const fim = performance.now() + limite;
  let iter = 0;
  while (performance.now() < fim) {
    for (let k = 0; k < 16 && ll.i < ll.p - 2; k++, iter++) {
      let x = ll.s * ll.s - 2n;
      if (x < 0n) x += ll.m;
      ll.s = modMersenne(x, ll);
      ll.i++;
    }
    if (ll.i >= ll.p - 2) {
      const erro = ll.s !== 0n;
      ll = null;
      return { iter, conferido: true, erro };
    }
  }
  return { iter, conferido: false, erro: false };
}

// ---------- FFT ----------
const re = new Float64Array(N_FFT);
const im = new Float64Array(N_FFT);
const re0 = new Float64Array(N_FFT);
const im0 = new Float64Array(N_FFT);
const cosT = new Float64Array(N_FFT / 2);
const sinT = new Float64Array(N_FFT / 2);
const rev = new Uint32Array(N_FFT);
let assinaturaFFT = null;

(function prepararFFT() {
  const bits = Math.log2(N_FFT);
  for (let i = 0; i < N_FFT; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < N_FFT / 2; i++) {
    cosT[i] = Math.cos((2 * Math.PI * i) / N_FFT);
    sinT[i] = Math.sin((2 * Math.PI * i) / N_FFT);
  }
  let semente = 12345;
  for (let i = 0; i < N_FFT; i++) {
    semente = (Math.imul(semente, 1103515245) + 12345) >>> 0;
    re0[i] = (semente / 4294967296) * 2 - 1;
    semente = (Math.imul(semente, 1103515245) + 12345) >>> 0;
    im0[i] = (semente / 4294967296) * 2 - 1;
  }
})();

function fft(inversa) {
  for (let i = 0; i < N_FFT; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  const sinal = inversa ? -1 : 1;
  for (let tam = 2; tam <= N_FFT; tam <<= 1) {
    const meio = tam >> 1;
    const passo = N_FFT / tam;
    for (let i = 0; i < N_FFT; i += tam) {
      for (let j = 0, k = 0; j < meio; j++, k += passo) {
        const a = i + j;
        const b = a + meio;
        const c = cosT[k];
        const s = sinal * sinT[k];
        const tr = re[b] * c + im[b] * s;
        const ti = im[b] * c - re[b] * s;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
  if (inversa) {
    for (let i = 0; i < N_FFT; i++) { re[i] /= N_FFT; im[i] /= N_FFT; }
  }
}

// Uma volta completa: ida, assinatura, volta e comparação com o original.
function rodadaFFT() {
  re.set(re0); im.set(im0);
  fft(false);
  let assin = 0;
  for (let i = 0; i < N_FFT; i += 7) assin += re[i] * (i + 1) - im[i];
  fft(true);
  let erroMax = 0;
  for (let i = 0; i < N_FFT; i++) {
    const d = Math.abs(re[i] - re0[i]) + Math.abs(im[i] - im0[i]);
    if (d > erroMax) erroMax = d;
  }
  let erro = erroMax > 1e-9;
  if (assinaturaFFT === null) assinaturaFFT = assin;
  else if (assin !== assinaturaFFT) erro = true;
  return erro;
}

const FLOPS_POR_RODADA = 2 * 5 * N_FFT * Math.log2(N_FFT);

// ---------- Clock estimado ----------
// Cadeia de operações inteiras dependentes: 8 somas + xor/and/or que realimentam a próxima
// volta, 11 operações de 1 ciclo no caminho crítico. Operações por nanossegundo ≈ GHz.
// Fica com a melhor de 8 medições curtas (~1,5 ms cada), para não contar o tempo em que o
// sistema operacional deu a vez a outra thread: com tudo em carga máxima, janelas maiores
// quase sempre incluem uma pausa.
function cadeia(N) {
  let a = sorvedouro | 1;
  let c = 3;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    a = (a + c) | 0; a = (a + c) | 0; a = (a + c) | 0; a = (a + c) | 0;
    a = (a + c) | 0; a = (a + c) | 0; a = (a + c) | 0; a = (a + c) | 0;
    c = ((c ^ a) & 1) | 2;
  }
  const dt = performance.now() - t0;
  sorvedouro ^= a + c;
  return dt > 0 ? (N * 11) / (dt * 1e6) : 0;
}

function medirClock() {
  let melhor = 0;
  for (let k = 0; k < 8; k++) melhor = Math.max(melhor, cadeia(500_000));
  return melhor || null;
}

// ---------- Laço principal ----------
let rodando = false;

async function laco() {
  medirClock(); // aquece o JIT
  let ultimoRelato = performance.now();
  let ultimoClock = 0;
  let acc = { flops: 0, llIter: 0, erros: 0, verificacoes: 0 };
  let clock = medirClock();

  while (rodando) {
    const r = passoLL(40);
    acc.llIter += r.iter;
    if (r.conferido) { acc.verificacoes++; if (r.erro) acc.erros++; }

    const fimFFT = performance.now() + 40;
    while (performance.now() < fimFFT) {
      if (rodadaFFT()) acc.erros++;
      acc.verificacoes++;
      acc.flops += FLOPS_POR_RODADA;
    }

    const agora = performance.now();
    if (agora - ultimoClock > 3000) {
      clock = medirClock();
      ultimoClock = performance.now();
    }
    if (agora - ultimoRelato >= RELATO_MS) {
      const seg = (agora - ultimoRelato) / 1000;
      postMessage({
        tipo: 'relato',
        gflops: acc.flops / seg / 1e9,
        llps: acc.llIter / seg,
        erros: acc.erros,
        verificacoes: acc.verificacoes,
        clock,
      });
      acc = { flops: 0, llIter: 0, erros: 0, verificacoes: 0 };
      ultimoRelato = agora;
      // Cede a vez para receber a mensagem de parada.
      await new Promise((ok) => setTimeout(ok, 0));
    }
  }
}

onmessage = (e) => {
  if (e.data?.cmd === 'iniciar' && !rodando) { rodando = true; laco(); }
  if (e.data?.cmd === 'parar') rodando = false;
};
