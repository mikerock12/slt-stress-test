// Monta dist/ só com o que vai ao ar (sem plugin, testes, scripts e documentação).
// Uso: npm run build   →   npx wrangler pages deploy dist --project-name slt-stress-test
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = join(RAIZ, 'dist');
const PUBLICO = ['index.html', '_headers', 'css', 'js', 'assets'];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST);
for (const item of PUBLICO) cpSync(join(RAIZ, item), join(DIST, item), { recursive: true });
console.log(`dist/ pronto: ${PUBLICO.join(', ')}`);
