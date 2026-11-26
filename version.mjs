// Marca de versión de cada archivo de datos (version.js). La página consulta este archivo chiquito cada 2 minutos
// y solo vuelve a bajar datos.js o acciones.js cuando su marca cambió.
import { readFileSync, writeFileSync, renameSync, readdirSync, statSync } from 'node:fs';

// Marca del código de la página (fecha del archivo más nuevo): si cambia, la página abierta o guardada por el navegador se recarga sola.
const DATOS = new Set(['datos.js', 'acciones.js', 'version.js']);
function marcaCodigo() {
  const dir = new URL('./', import.meta.url);
  return new Date(Math.max(...readdirSync(dir).filter(f => /\.(html|css|js)$/.test(f) && !DATOS.has(f))
    .map(f => statSync(new URL(f, dir)).mtimeMs))).toISOString();
}

export function marcarVersion(clave) {
  const f = new URL('./version.js', import.meta.url), tmp = new URL(`./version.js.${process.pid}.tmp`, import.meta.url);
  let v = {};
  try { v = JSON.parse(readFileSync(f, 'utf8').replace(/^window\.VERSION = /, '').replace(/;\s*$/, '')); } catch { /* primera vez */ }
  if (clave) v[clave] = new Date().toISOString();
  v.app = marcaCodigo();
  writeFileSync(tmp, 'window.VERSION = ' + JSON.stringify(v) + ';\n');
  renameSync(tmp, f);
}
