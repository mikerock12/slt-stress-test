import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectarPlugin, permissaoRedeLocal, descricaoMemoria, resumoMemoria } from '../js/plugin.js';

const ola = { protocolo: 1, versao: '1.2.0', memoria: [], unidades: [] };

test('plugin pode iniciar depois da primeira tentativa falhar, sem recarregar a página', async (t) => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    urls.push(url);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.targetAddressSpace, 'loopback');
    if (urls.length === 1) throw new TypeError('Plugin ainda fechado');
    return Response.json(ola);
  });
  assert.equal(await detectarPlugin(), null);
  assert.deepEqual(await detectarPlugin(), ola);
  assert.equal(new URL(urls[0]).pathname, '/v1/ola');
  assert.notEqual(urls[0], urls[1]);
});

test('primeira leitura lenta de WMI não é descartada após 1,5 segundo', async (t) => {
  t.mock.method(globalThis, 'fetch', (url, { signal }) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener('abort', abortar); resolve(Response.json(ola)); }, 1800);
    const abortar = () => { clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener('abort', abortar, { once: true });
  }));
  assert.deepEqual(await detectarPlugin(), ola);
});

test('novo clique pode cancelar uma detecção pendente e conectar em outra tentativa', async (t) => {
  let chamadas = 0;
  let sinalAntigo;
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => {
    chamadas++;
    if (chamadas > 1) return Response.json(ola);
    sinalAntigo = signal;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  });
  const controle = new AbortController();
  const antiga = detectarPlugin({ signal: controle.signal });
  controle.abort();
  assert.equal(sinalAntigo.aborted, true);
  assert.equal(await antiga, null);
  assert.deepEqual(await detectarPlugin(), ola);
});

test('protocolo incompatível e resposta inválida não contam como conectado', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...ola, protocolo: 2 }));
  assert.equal(await detectarPlugin(), null);
  globalThis.fetch.mock.mockImplementation(async () => new Response('HTML', { status: 200 }));
  assert.equal(await detectarPlugin(), null);
});

test('consulta a permissão específica do loopback antes do nome legado', async (t) => {
  const chamadas = [];
  const anterior = Object.getOwnPropertyDescriptor(globalThis.navigator, 'permissions');
  Object.defineProperty(globalThis.navigator, 'permissions', { configurable: true, value: { query: async ({ name }) => {
    chamadas.push(name);
    return { state: name === 'loopback-network' ? 'denied' : 'granted' };
  } } });
  t.after(() => anterior ? Object.defineProperty(globalThis.navigator, 'permissions', anterior) : delete globalThis.navigator.permissions);
  assert.equal(await permissaoRedeLocal(), 'denied');
  assert.deepEqual(chamadas, ['loopback-network']);
});

test('navegador antigo usa o nome legado e navegador sem suporte não impede detecção', async (t) => {
  const anterior = Object.getOwnPropertyDescriptor(globalThis.navigator, 'permissions');
  Object.defineProperty(globalThis.navigator, 'permissions', { configurable: true, value: { query: async ({ name }) => {
    if (name === 'loopback-network') throw new TypeError('Permissão não reconhecida');
    return { state: 'prompt' };
  } } });
  t.after(() => anterior ? Object.defineProperty(globalThis.navigator, 'permissions', anterior) : delete globalThis.navigator.permissions);
  assert.equal(await permissaoRedeLocal(), 'prompt');
  globalThis.navigator.permissions.query = async () => { throw new TypeError('Não suportada'); };
  assert.equal(await permissaoRedeLocal(), null);
  t.mock.method(globalThis, 'fetch', async () => Response.json(ola));
  assert.deepEqual(await detectarPlugin(), ola);
});

test('RAM usa capacidade e tipo dos módulos, incluindo DDR3, DDR4, DDR5 e frações', () => {
  for (const tipo of ['DDR3', 'DDR4', 'DDR5']) {
    assert.equal(descricaoMemoria({ plugin: { memoria: [{ capacidadeGB: 32, tipo }] } }), `32 GB ${tipo} (1 pente)`);
  }
  assert.equal(resumoMemoria([{ capacidadeGB: 2.5, tipo: 'DDR3' }]), '2,5 GB DDR3 (1 pente)');
  assert.equal(resumoMemoria([{ capacidadeGB: 8, tipo: 'DDR4' }, { capacidadeGB: 16, tipo: 'DDR4' }]), '24 GB DDR4 (2 pentes)');
});

test('ausência parcial de WMI não vira total inventado ou tipo presumido', () => {
  assert.equal(resumoMemoria([{ capacidadeGB: 8, tipo: 'DDR4' }, { capacidadeGB: 0, tipo: 'desconhecido' }]), 'capacidade não informada DDR4/tipo não informado (2 pentes)');
  assert.match(resumoMemoria([{ capacidadeGB: 16 }]), /16 GB tipo não informado/);
  assert.equal(resumoMemoria(null), null);
  assert.equal(resumoMemoria([]), null);
  assert.doesNotMatch(descricaoMemoria(), /8 GB ou mais/);
  assert.match(descricaoMemoria(), /abra o plugin/);
  assert.equal(descricaoMemoria({ plugin: { memoria: [] } }), 'Capacidade e tipo não informados pelo Windows');
});

test('Android mantém a quantidade informada em GiB sem inventar DDR', () => {
  assert.equal(descricaoMemoria({ android: { memoria: { totalGB: 7.45 } } }), '7,45 GiB · tipo não informado (Android)');
});
