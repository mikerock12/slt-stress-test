// Confere a sintaxe de todos os .js/.mjs do projeto com `node --check`.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const arquivos = [];
(function varrer(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'bin', 'obj', 'publicado'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) varrer(p);
    else if (/\.m?js$/.test(e.name)) arquivos.push(p);
  }
})(RAIZ);

for (const a of arquivos) execFileSync(process.execPath, ['--check', a], { stdio: 'inherit' });
console.log(`Sintaxe OK em ${arquivos.length} arquivos.`);
