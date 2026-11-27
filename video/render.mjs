// Saca los cuadros del video con Edge (sin ventana) usando playwright-core. Lo llama videos.mjs.
//   node render.mjs <guion.json> <carpetaCuadros> [--stills t1,t2,...]
// Cada cuadro se pide como JPEG directo del canvas (más rápido que una captura de pantalla).
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [guionF, salida, ...resto] = process.argv.slice(2);
if (!guionF || !salida) { console.error('uso: node render.mjs <guion.json> <carpeta> [--stills t1,t2]'); process.exit(2); }
const guion = JSON.parse(readFileSync(guionF, 'utf8'));
const stills = resto.includes('--stills') ? resto[resto.indexOf('--stills') + 1].split(',').map(Number) : null;
mkdirSync(salida, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  let error = null;
  page.on('pageerror', e => { error = e.message; });
  await page.addInitScript(g => { window.GUION = g; }, guion);
  await page.goto(pathToFileURL(join(fileURLToPath(new URL('.', import.meta.url)), 'index.html')).href);
  const info = await page.evaluate(() => window.ready);
  if (error || !info) throw new Error('la página falló: ' + error);
  const tiempos = stills || Array.from({ length: Math.ceil(info.duration * info.FPS) }, (_, f) => f / info.FPS);
  const t0 = Date.now();
  for (let i = 0; i < tiempos.length; i++) {
    const data = await page.evaluate(t => { renderAt(t); return document.getElementById('out').toDataURL('image/jpeg', 0.92); }, tiempos[i]);
    writeFileSync(join(salida, `${String(i).padStart(5, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
    if (error) throw new Error('la página falló: ' + error);
  }
  console.log(JSON.stringify({ cuadros: tiempos.length, fps: info.FPS, duracion: info.duration, msPorCuadro: Math.round((Date.now() - t0) / tiempos.length) }));
} finally { await browser.close(); }
