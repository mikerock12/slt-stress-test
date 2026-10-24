import { limparRenderer } from '../sistema.js';

// Teste de GPU inspirado no FurMark: uma rosquinha "peluda" desenhada por raymarching
// volumétrico em WebGL2, numa resolução fixa (para os números serem comparáveis).
// Como o navegador limita os quadros à taxa do monitor, cada quadro desenha a cena várias
// vezes ("passadas"), ajustadas sozinhas até a GPU ficar saturada. O FPS relatado é o
// equivalente sem limite: passadas desenhadas por segundo.
// A cada 15 s um quadro de referência (tempo congelado) é lido de volta e comparado com o
// primeiro: diferença = artefato.

const VERT = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTempo; uniform int uPassos;
out vec4 cor;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ruido(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * ruido(p); p *= 2.03; a *= 0.5; } return s * 1.07; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 girar(vec3 p){ p.xy *= rot(uTempo * 0.5); p.yz *= rot(uTempo * 0.31); return p; }
float rosca(vec3 p){ vec2 q = vec2(length(p.xz) - 1.0, p.y); return length(q) - 0.42; }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, -3.2), rd = normalize(vec3(uv, 1.4));
  float t = 0.0, dens = 0.0; vec3 c = vec3(0.0);
  for (int i = 0; i < uPassos; i++) {
    vec3 q = girar(ro + rd * t);
    float d = rosca(q);
    if (d < 0.32) {
      float pelo = fbm(q * 9.0 + vec3(0.0, uTempo * 0.2, 0.0)) * smoothstep(0.32, 0.0, d);
      float a = pelo * 0.09;
      vec3 tom = mix(vec3(0.95, 0.45, 0.10), vec3(1.0, 0.85, 0.35), pelo);
      tom *= 0.55 + 0.45 * smoothstep(0.32, -0.1, d);
      c += (1.0 - dens) * a * tom; dens += (1.0 - dens) * a;
      t += 0.024;
    } else t += max(d - 0.3, 0.024);
    if (dens > 0.985 || t > 7.0) break;
  }
  c += (1.0 - dens) * vec3(0.02, 0.03, 0.05) * (1.2 - length(uv));
  cor = vec4(pow(c * 1.4, vec3(0.4545)), 1.0);
}`;

const REF_TAM = 256;

export class TesteGPU {
  static id = 'gpu';
  static nome = 'GPU';

  constructor() {
    this.artefatos = 0;
    this.passadas = 1;
    this.janela = { passadas: 0, t0: 0, quadros: 0 };
    this.ultima = null;
    this.renderer = 'desconhecida';
  }

  async iniciar(opcoes, aoEvento) {
    this.aoEvento = aoEvento;
    const canvas = opcoes.canvas;
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 indisponível: ative a aceleração por hardware do navegador.');
    this.gl = gl;

    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.renderer = limparRenderer(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));

    this.aoPerder = (e) => {
      e.preventDefault();
      if (!this.rodando) return;
      this.falhaFatal = 'O contexto WebGL foi perdido. Pode haver limite de recursos, memória ou falha do driver; o teste foi interrompido.';
      aoEvento({ tipo: 'erro', msg: 'GPU: contexto WebGL perdido; encerrando a carga.' });
    };
    canvas.addEventListener('webglcontextlost', this.aoPerder);

    const compilar = (tipo, fonte) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, fonte);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compilar(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compilar(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Programa: ' + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.u = {
      res: gl.getUniformLocation(prog, 'uRes'),
      tempo: gl.getUniformLocation(prog, 'uTempo'),
      passos: gl.getUniformLocation(prog, 'uPassos'),
    };

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    [this.largura, this.altura] = opcoes.resolucao || [1920, 1080];
    this.passos = opcoes.intensidade || 128;
    gl.uniform1i(this.u.passos, this.passos);
    this.fbo = this.criarAlvo(this.largura, this.altura);
    this.fboRef = this.criarAlvo(REF_TAM, REF_TAM);

    this.prazoMs = opcoes.prazoMs ?? Infinity;
    this.proximaRef = 0;
    this.rodando = true;
    this.inicio = performance.now();
    this.janela = { passadas: 0, t0: performance.now(), quadros: 0, ultimoQuadro: performance.now() };
    this.quadro = this.quadro.bind(this);
    this.raf = requestAnimationFrame(this.quadro);
    aoEvento({ tipo: 'log', msg: `GPU: ${this.renderer} — ${this.largura}×${this.altura}, ${this.passos} passos de raymarching.` });
  }

  criarAlvo(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('A GPU não conseguiu criar o alvo de renderização. Reduza a resolução.');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }

  // Desenha em faixas horizontais: cada chamada fica curta, longe do limite de ~2 s em que
  // o Windows reinicia o driver (TDR) em GPUs fracas.
  desenhar(alvo, tempo) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, alvo.fb);
    gl.viewport(0, 0, alvo.w, alvo.h);
    gl.uniform2f(this.u.res, alvo.w, alvo.h);
    gl.uniform1f(this.u.tempo, tempo);
    const faixas = alvo.h >= 720 ? 4 : 1;
    const alt = Math.ceil(alvo.h / faixas);
    gl.enable(gl.SCISSOR_TEST);
    for (let f = 0; f < faixas; f++) {
      gl.scissor(0, f * alt, alvo.w, alt);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  // Leitura assíncrona: não força a página a esperar a GPU terminar.
  iniciarReferencia() {
    const gl = this.gl;
    this.desenhar(this.fboRef, 1.234);
    this.pbo ||= gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, REF_TAM * REF_TAM * 4, gl.STREAM_READ);
    gl.readPixels(0, 0, REF_TAM, REF_TAM, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.selar('referencia', 0);
  }

  conferirReferencia() {
    const gl = this.gl;
    const atual = new Uint8Array(REF_TAM * REF_TAM * 4);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, atual);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    if (!this.referencia) { this.referencia = atual; return; }
    let ruins = 0;
    for (let i = 0; i < atual.length; i++) if (Math.abs(atual[i] - this.referencia[i]) > 8) ruins++;
    if (ruins) {
      this.artefatos++;
      this.aoEvento({ tipo: 'erro', msg: `GPU: quadro de referência com ${ruins} valor(es) de pixel diferentes (artefato).` });
    }
  }

  selar(tipo, passadas) {
    const gl = this.gl;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) throw new Error('Não foi possível acompanhar a conclusão do quadro da GPU.');
    this.pendente = { sync, tipo, passadas, t0: performance.now() };
    gl.flush();
  }

  quadro(agora) {
    if (!this.rodando || this.falhaFatal) return;
    const gl = this.gl;
    if (agora >= this.prazoMs) { this.parar(); return; }
    this.raf = requestAnimationFrame(this.quadro);
    try {
    // No máximo um lote em voo. timeout=0 só consulta; nunca espera na thread da página.
    if (this.pendente) {
      const p = this.pendente;
      const estado = gl.clientWaitSync(p.sync, 0, 0);
      if (estado === gl.TIMEOUT_EXPIRED) {
        if (agora - p.t0 > 5000) throw new Error('A GPU não confirmou um quadro em 5 segundos. Reduza a carga e aguarde o aparelho esfriar.');
        return;
      }
      if (estado === gl.WAIT_FAILED) throw new Error('Falha ao acompanhar a conclusão do quadro da GPU.');
      gl.deleteSync(p.sync); this.pendente = null;
      if (p.tipo === 'referencia') { this.conferirReferencia(); this.proximaRef = agora + 15000; }
      else {
        this.janela.passadas += p.passadas;
        this.janela.quadros++;
        const intervalo = agora - p.t0;
        if (intervalo < 20 && this.passadas < 64) this.passadas++;
        else if (intervalo > 45 && this.passadas > 1) this.passadas--;
      }
    }
    if (document.hidden) return;
    if (agora >= this.proximaRef) { this.iniciarReferencia(); return; }

    const t = (agora - this.inicio) / 1000;
    for (let i = 0; i < this.passadas; i++) this.desenhar(this.fbo, t + i * 0.001);

    // Mostra o resultado no canvas visível.
    const w = this.canvas.width, h = this.canvas.height;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fbo.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, this.fbo.w, this.fbo.h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);

    this.selar('cena', this.passadas);
    } catch (e) {
      this.falhaFatal = e.message;
      this.aoEvento({ tipo: 'erro', msg: `GPU: ${e.message}` });
      this.parar();
    }
  }

  amostra() {
    const agora = performance.now();
    const seg = (agora - this.janela.t0) / 1000;
    const { passadas, quadros } = this.janela;
    this.janela.passadas = 0;
    this.janela.quadros = 0;
    this.janela.t0 = agora;
    // Aba oculta (animação pausada) e os 3 s iniciais (compilação do shader) não entram na média.
    if (document.hidden || !passadas || seg <= 0 || agora - this.inicio < 3000) return { artefatos: this.artefatos };
    const fps = passadas / seg;
    return {
      fps,
      mpix: (fps * this.largura * this.altura) / 1e6,
      frameMs: 1000 / fps,
      artefatos: this.artefatos,
      quadrosTela: quadros / seg,
    };
  }

  info() {
    return { renderer: this.renderer, resolucao: `${this.largura}×${this.altura}`, passos: this.passos, motor: 'webgl2-fence-v2', falhaFatal: this.falhaFatal };
  }

  async parar() {
    this.rodando = false;
    cancelAnimationFrame(this.raf);
    this.canvas?.removeEventListener('webglcontextlost', this.aoPerder);
    if (this.gl && this.pendente) this.gl.deleteSync(this.pendente.sync);
    this.pendente = null;
    const perda = this.gl?.getExtension('WEBGL_lose_context');
    perda?.loseContext();
    this.gl = null;
  }
}
