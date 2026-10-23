// Informações do sistema que o navegador expõe (sem permissões especiais).
import { detectarDispositivo } from './dispositivo.js';

function nomeNavegador() {
  const marcas = navigator.userAgentData?.brands?.filter((b) => !/Not.?A.?Brand|Chromium/i.test(b.brand));
  if (marcas?.length) return `${marcas[0].brand} ${marcas[0].version}`;
  const ua = navigator.userAgent;
  const m = ua.match(/(Firefox|Edg|OPR|Chrome|Version)\/([\d.]+)/);
  if (!m) return 'Desconhecido';
  const nomes = { Edg: 'Edge', OPR: 'Opera', Version: 'Safari' };
  return `${nomes[m[1]] || m[1]} ${m[2].split('.')[0]}`;
}

function sistemaOperacional() {
  const p = navigator.userAgentData?.platform || navigator.platform || '';
  const ua = navigator.userAgent;
  if (/Win/i.test(p)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (detectarDispositivo().ios) return 'iOS';
  if (/Mac/i.test(p)) return 'macOS';
  if (/Linux/i.test(p)) return 'Linux';
  return p || 'Desconhecido';
}

function gpuRenderer() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { nome: 'Sem WebGL', webgl2: false };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const nome = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { nome: limparRenderer(nome), webgl2 };
  } catch {
    return { nome: 'Desconhecida', webgl2: false };
  }
}

// "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)" → "NVIDIA GeForce RTX 3060"
export function limparRenderer(nome = '') {
  const m = nome.match(/^ANGLE \([^,]+,\s*(.+?)(?:\s*\(0x[0-9a-f]+\))?(?:\s+Direct3D.*|\s+OpenGL.*|\s+Vulkan.*|,.*)?\)$/i);
  return (m ? m[1] : nome).trim();
}

export async function coletarSistema() {
  const gpu = gpuRenderer();
  const info = {
    dispositivo: detectarDispositivo(),
    navegador: nomeNavegador(),
    so: sistemaOperacional(),
    threads: navigator.hardwareConcurrency || null,
    // deviceMemory é arredondado e limitado a 8 GB pelo navegador, por privacidade.
    memoriaGB: navigator.deviceMemory || null,
    gpu: gpu.nome,
    webgl2: gpu.webgl2,
    webgpu: 'gpu' in navigator,
    opfs: !!navigator.storage?.getDirectory,
    pressao: typeof globalThis.PressureObserver === 'function',
    tela: `${screen.width || window.innerWidth}×${screen.height || window.innerHeight} @${window.devicePixelRatio}x`,
    armazenamentoLivreGB: null,
    bateria: null,
  };
  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    info.armazenamentoLivreGB = (quota - usage) / 1e9;
  } catch { /* indisponível */ }
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      info.bateria = { nivel: Math.round(b.level * 100), carregando: b.charging };
    }
  } catch { /* indisponível */ }
  return info;
}
