// Muestra la lista de espera de Pulso Premium (emails guardados en Cloudflare) y la guarda en lista-premium.csv.
// Uso, en la carpeta bolsa-ny: node exportar-lista.mjs   (necesita haber hecho "npx.cmd wrangler login" una vez)
// lista-premium.csv tiene datos personales: está en .gitignore y nunca se sube a GitHub.
// Un solo comando fijo (key list, con la fecha como metadato): ningún email escrito por visitantes pasa por la consola.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const ID = '686fd4e9e58445c39ddf502e4957aff2'; // KV "LISTA" (ver cloudflare/wrangler.toml)
const win = process.platform === 'win32';
const r = spawnSync(win ? 'npx.cmd --yes wrangler@4 kv key list --remote --namespace-id ' + ID : 'npx',
  win ? [] : ['--yes', 'wrangler@4', 'kv', 'key', 'list', '--remote', '--namespace-id', ID],
  { encoding: 'utf8', shell: win, cwd: new URL('./cloudflare/', import.meta.url) });
if (r.status !== 0) { console.error((r.stderr || r.stdout || '').trim().slice(-400)); process.exit(1); }
const filas = JSON.parse(r.stdout.slice(r.stdout.indexOf('[')))
  .map(k => ({ email: String(k.name), fecha: String(k.metadata?.fecha || '') }))
  .sort((a, b) => a.fecha.localeCompare(b.fecha));
const celda = s => /^[=+\-@]/.test(s) ? "'" + s : s; // que Excel no lo tome como fórmula
writeFileSync(new URL('./lista-premium.csv', import.meta.url), 'email,fecha\n' + filas.map(f => `${celda(f.email)},${f.fecha}`).join('\n') + '\n');
console.log(`${filas.length} personas en la lista de espera.`);
for (const f of filas) console.log(`${f.fecha.slice(0, 10) || 'sin fecha '}  ${f.email}`);
console.log('Guardada en bolsa-ny/lista-premium.csv');
