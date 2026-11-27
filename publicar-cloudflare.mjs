// Publica la página en https://pulso-wallstreet.pages.dev (Cloudflare Pages).
// Copia a una carpeta aparte SOLO lo que la página necesita (html, css, js y el registro), nunca .env, datos privados ni scripts.
// Uso: node publicar-cloudflare.mjs   (en la PC con la sesión de wrangler; en GitHub con el secreto CLOUDFLARE_API_TOKEN)
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('./', import.meta.url));
const PERMITIDO = /^[\w-]+\.(html|css|js)$|^tiktok\w+\.txt$/; // .mjs (scripts de la PC) y lo que empieza con punto quedan afuera; tiktok*.txt = verificación del dominio para TikTok for Developers
const salida = mkdtempSync(join(tmpdir(), 'pulso-pages-'));
try {
  const archivos = readdirSync(raiz).filter(f => PERMITIDO.test(f));
  for (const f of archivos) cpSync(join(raiz, f), join(salida, f));
  if (existsSync(join(raiz, 'logs', 'ejecuciones.js'))) { mkdirSync(join(salida, 'logs')); cpSync(join(raiz, 'logs', 'ejecuciones.js'), join(salida, 'logs', 'ejecuciones.js')); }
  if (!archivos.includes('index.html') || !archivos.includes('datos.js')) throw new Error('Faltan index.html o datos.js: no se publica una página incompleta.');
  const win = process.platform === 'win32';
  const args = ['--yes', 'wrangler@4', 'pages', 'deploy', salida, '--project-name', 'pulso-wallstreet', '--branch', 'main', '--commit-dirty=true'];
  // en Windows npx es un .cmd y necesita la consola; los argumentos son fijos (sin nada escrito por visitantes)
  const r = spawnSync(win ? 'npx.cmd ' + args.map(a => `"${a}"`).join(' ') : 'npx', win ? [] : args, { encoding: 'utf8', shell: win, cwd: raiz });
  const texto = ((r.stdout || '') + (r.stderr || '')).trim();
  console.log(texto.split('\n').filter(l => /Success|Deployment complete|https:\/\/|Uploaded|rror/.test(l)).join('\n') || texto.slice(-600));
  process.exitCode = r.status === 0 ? 0 : 1;
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { rmSync(salida, { recursive: true, force: true }); }
