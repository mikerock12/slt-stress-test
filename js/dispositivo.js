// Detecção por plataforma, sem confundir uma janela estreita com um celular.
export function detectarDispositivo(nav = globalThis.navigator || {}) {
  const ua = nav.userAgent || '';
  const android = /Android/i.test(ua) || nav.userAgentData?.platform === 'Android';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(nav.platform || '') && nav.maxTouchPoints > 1);
  return { tipo: android || ios || nav.userAgentData?.mobile ? 'celular' : 'desktop',
    plataforma: android ? 'Android' : ios ? 'iOS' : 'desktop', android, ios };
}
