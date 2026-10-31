// Monta dist/ só com o que vai ao ar (sem plugin, testes, scripts e documentação).
// Uso: npm run build; npm run deploy publica assets + API no Worker.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = join(RAIZ, 'dist');
const PUBLICO = ['index.html', 'privacidade.html', '_headers', 'css', 'js', 'assets'];

// O APK público deve ser idêntico ao asset assinado da release, inclusive no CI.
// Não depende do GitHub durante o build nem acessa a pasta privada de assinatura.
const DOWNLOADS = join(RAIZ, 'assets', 'downloads');
const [hashApk, nomeApk] = readFileSync(join(DOWNLOADS, 'SHA256SUMS.txt'), 'utf8').trim().split(/\s+/);
if (!/^[a-f0-9]{64}$/.test(hashApk) || !/^SLTStressTest-v[\d.]+\.apk$/.test(nomeApk)) throw new Error('Manifesto do APK inválido.');
if (createHash('sha256').update(readFileSync(join(DOWNLOADS, nomeApk))).digest('hex') !== hashApk) throw new Error('APK diferente do checksum publicado.');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST);
for (const item of PUBLICO) cpSync(join(RAIZ, item), join(DIST, item), { recursive: true });
let commit = null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).trim(); } catch { /* fonte sem metadados Git */ }
const build = { version: 'web-metodologia-2', commit, builtAt: new Date().toISOString() };
writeFileSync(join(DIST, 'js', 'build.js'), `export const BUILD = ${JSON.stringify(build)};\n`);
console.log(`dist/ pronto: ${PUBLICO.join(', ')}`);
