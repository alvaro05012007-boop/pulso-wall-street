// Junta los resúmenes de datos/*.json en datos.js (la página lo carga con un <script>, que funciona con doble clic).
// Los JSON los escribe una IA a partir de la web: se validan (validar.mjs) y los inválidos se saltean con aviso, sin borrarlos.
// Uso: node datos.mjs   (build-datos.ps1 llama a este mismo script)
import { readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { problemas } from './validar.mjs';
import { marcarVersion } from './version.mjs';

const dir = new URL('./datos/', import.meta.url), items = [], saltados = [];
for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  let r;
  try { r = JSON.parse(readFileSync(new URL(f, dir), 'utf8')); } catch (e) { saltados.push(`${f}: JSON invalido (${e.message})`); continue; }
  const p = problemas(r, f);
  if (p.length) { saltados.push(`${f}: ${p.join('; ')}`); continue; }
  items.push(JSON.stringify(r));
}
const tmp = new URL(`./datos.js.${process.pid}.tmp`, import.meta.url); // temporal propio: varias tareas pueden armarlo a la vez
const nuevo = 'window.RESUMENES = [\n' + items.join(',\n') + '\n];\n';
let viejo = null; try { viejo = readFileSync(new URL('./datos.js', import.meta.url), 'utf8'); } catch { /* primera vez */ }
if (nuevo !== viejo) { // sin cambios no se marca versión: las páginas abiertas no vuelven a bajar más de 1 MB
  writeFileSync(tmp, nuevo);
  renameSync(tmp, new URL('./datos.js', import.meta.url));
  marcarVersion('datos');
}
for (const s of saltados) console.warn('JSON invalido, lo salteo: ' + s);
console.log(`datos.js actualizado con ${items.length} resumenes${saltados.length ? `; ${saltados.length} salteados` : ''}`);
