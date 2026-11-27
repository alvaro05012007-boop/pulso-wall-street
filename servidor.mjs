// Servidor de Pulso de Wall Street (opcional: la página sigue funcionando con doble clic).
//   node servidor.mjs            -> solo esta PC: http://127.0.0.1:8787
//   node servidor.mjs --red      -> también el celular u otra PC del mismo Wi-Fi, con clave de acceso obligatoria
// Seguridad: política de contenido (CSP) y cabeceras estrictas; sirve solo archivos de la página (nunca .env, .mjs,
// node_modules ni registros crudos); en modo red exige la clave (cookie HttpOnly), la compara en tiempo constante y
// bloquea por 15 minutos a quien falle 10 veces. API de solo lectura con parámetros validados y caché por ETag.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { normalize, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert';

const RAIZ = fileURLToPath(new URL('.', import.meta.url));
const RED = process.argv.includes('--red');
const PUERTO = Number(process.argv.find(a => /^\d+$/.test(a))) || 8787;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const CSP = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; " + // colores de las leyendas en atributos style; scripts siguen estrictos
  "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.workers.dev; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

export function permitido(ruta) { // devuelve la ruta en disco o null: solo archivos de la página, sin salir de la carpeta
  let limpia;
  try { limpia = normalize(decodeURIComponent(ruta.split('?')[0])).replace(/^[\\/]+/, '') || 'index.html'; } catch { return null; }
  const partes = limpia.split(/[\\/]/);
  if (partes.some(p => p === '..' || p.startsWith('.') || p === 'node_modules')) return null;
  if (!TIPOS[extname(limpia)]) return null;                       // nada de .mjs, .json, .md, .ps1
  if (partes[0] === 'logs' && limpia !== join('logs', 'ejecuciones.js')) return null;
  const abs = join(RAIZ, limpia);
  return abs.startsWith(RAIZ.endsWith(sep) ? RAIZ : RAIZ + sep) ? abs : null;
}
assert.ok(permitido('/') && permitido('/app.js') && permitido('/logs/ejecuciones.js'));
for (const malo of ['/.env', '/node_modules/a.js', '/acciones.mjs', '/logs/ejecuciones.jsonl', '/package.json', '/README.md', '/%E0%A4%A'])
  assert.equal(permitido(malo), null, malo);
for (const escape of ['/../secreto.html', '/%2e%2e/%2e%2e/x.js', '/..%5c..%5cWindows%5cwin.ini', '/a/../../b.js']) { // nunca sale de la carpeta
  const r = permitido(escape); assert.ok(r === null || r.startsWith(RAIZ), escape);
}

// ---- datos para la API (se releen solo cuando cambia el archivo) ----
const cache = new Map();
function leerDatos(archivo) {
  const ruta = join(RAIZ, archivo);
  if (!existsSync(ruta)) return null;
  const mtime = statSync(ruta).mtimeMs, c = cache.get(archivo);
  if (c?.mtime === mtime) return c.valor;
  const t = readFileSync(ruta, 'utf8'), valor = JSON.parse(t.slice(t.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
  cache.set(archivo, { mtime, valor });
  return valor;
}
const sinSeries = x => { const { fechas, cierres, semanal, ...resto } = x; return resto; }; // la API de listas no manda series enteras
export function api(ruta, q) { // devuelve [estado, cuerpo]; todos los parámetros se validan
  const A = leerDatos('acciones.js'), D = leerDatos('datos.js') || [];
  if (ruta === '/api/estado') {
    const ej = leerDatos(join('logs', 'ejecuciones.js')) || [];
    return [200, { versiones: leerDatos('version.js') || {}, datosMercado: A?.actualizado || null, resumenes: D.length, ultimoResumen: D.map(r => r.id).sort().at(-1) || null, ultimaEjecucion: ej.at(-1) || null, red: RED }];
  }
  if (!A) return [503, { error: 'Todavía no hay datos de mercado.' }];
  if (ruta === '/api/indices') return [200, { actualizado: A.actualizado, indices: Object.fromEntries(Object.entries(A.indices).map(([k, v]) => [k, sinSeries(v)])) }];
  if (ruta === '/api/empresas') {
    const sector = q.get('sector');
    if (sector != null && !Object.values(A.lista).some(a => a.sector === sector)) return [400, { error: 'Sector desconocido.' }];
    return [200, { actualizado: A.actualizado, empresas: A.lista.filter(a => !sector || a.sector === sector).map(sinSeries) }];
  }
  if (ruta === '/api/empresa') {
    const tk = (q.get('ticker') || '').toUpperCase();
    if (!/^[A-Z]{1,5}(-[A-Z])?$/.test(tk)) return [400, { error: 'Ticker inválido.' }];
    const a = A.lista.find(x => x.ticker === tk);
    return a ? [200, a] : [404, { error: 'No seguimos esa empresa.' }];
  }
  if (ruta === '/api/resumenes') {
    const desde = q.get('desde'), hasta = q.get('hasta'), texto = (q.get('q') || '').toLowerCase(), limite = Number(q.get('limite') || 20);
    for (const f of [desde, hasta]) if (f != null && !/^\d{4}-\d{2}-\d{2}$/.test(f)) return [400, { error: 'Las fechas van como AAAA-MM-DD.' }];
    if (!Number.isInteger(limite) || limite < 1 || limite > 200) return [400, { error: 'limite tiene que ser un entero entre 1 y 200.' }];
    if (texto.length > 80) return [400, { error: 'La búsqueda es demasiado larga.' }];
    const lista = D.filter(r => (!desde || r.fecha >= desde) && (!hasta || r.fecha <= hasta) && (!texto || JSON.stringify(r).toLowerCase().includes(texto)))
      .sort((a, b) => a.id < b.id ? 1 : -1).slice(0, limite);
    return [200, { total: lista.length, resumenes: lista }];
  }
  return [404, { error: 'No existe esa ruta de la API.' }];
}

// ---- clave de acceso para el modo red ----
let CLAVE = null;
if (RED) {
  const f = join(RAIZ, 'logs', 'clave-red.txt');
  mkdirSync(join(RAIZ, 'logs'), { recursive: true });
  if (!existsSync(f)) writeFileSync(f, randomBytes(12).toString('hex'));
  CLAVE = readFileSync(f, 'utf8').trim();
}
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const fallos = new Map(); // ip -> { n, hasta }
const ips = () => Object.values(networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);

const cabeceras = tipo => ({ 'Content-Type': tipo, 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-cache' });
const json = (res, estado, cuerpo, req) => {
  const texto = JSON.stringify(cuerpo), etag = '"' + createHash('sha1').update(texto).digest('base64url') + '"';
  if (estado === 200 && req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }).end(); return; }
  res.writeHead(estado, { ...cabeceras('application/json; charset=utf-8'), ETag: etag }).end(texto);
};

if (process.argv.includes('--probar')) {
  assert.equal(api('/api/empresa', new URLSearchParams('ticker=<script>'))[0], 400);
  assert.equal(api('/api/resumenes', new URLSearchParams('limite=999'))[0], 400);
  assert.equal(api('/api/resumenes', new URLSearchParams('desde=ayer'))[0], 400);
  assert.equal(api('/api/no-existe', new URLSearchParams())[0], 404);
  console.log('Pruebas de rutas y de la API: bien.'); process.exit(0);
}

createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, cabeceras('text/plain; charset=utf-8')).end('Método no permitido'); return; }
  const url = new URL(req.url || '/', 'http://x'), ip = req.socket.remoteAddress || '';
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip); // la misma PC no necesita clave
  if (RED && !local) { // los demás dispositivos piden la clave: por link (?clave=...) una vez, después queda en una cookie HttpOnly
    const f = fallos.get(ip);
    if (f && f.hasta > Date.now()) { res.writeHead(429, cabeceras('text/plain; charset=utf-8')).end('Demasiados intentos. Probá en 15 minutos.'); return; }
    const cookie = /(?:^|;\s*)pulso_clave=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
    const dada = url.searchParams.get('clave');
    if (dada != null) {
      if (igual(dada, CLAVE)) { fallos.delete(ip); res.writeHead(302, { Location: '/', 'Set-Cookie': `pulso_clave=${CLAVE}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000` }).end(); return; }
      const n = (f?.n || 0) + 1; fallos.set(ip, { n, hasta: n >= 10 ? Date.now() + 15 * 60e3 : 0 });
    }
    if (!cookie || !igual(cookie, CLAVE)) { res.writeHead(401, cabeceras('text/plain; charset=utf-8')).end('Para entrar abrí el link con la clave que muestra la PC (pestaña Estado o la ventana del servidor).'); return; }
  }
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/red') { // solo para quien ya entró: el link y la clave para compartir con el celular
      json(res, 200, RED ? { red: true, urls: ips().map(a => `http://${a}:${PUERTO}/?clave=${CLAVE}`) } : { red: false }, req); return;
    }
    try { const [estado, cuerpo] = api(url.pathname, url.searchParams); json(res, estado, cuerpo, req); }
    catch { json(res, 500, { error: 'No se pudieron leer los datos.' }, req); }
    return;
  }
  const archivo = permitido(url.pathname);
  if (!archivo) { res.writeHead(404, cabeceras('text/plain; charset=utf-8')).end('No encontrado'); return; }
  try { const cuerpo = await readFile(archivo); res.writeHead(200, cabeceras(TIPOS[extname(archivo)])).end(req.method === 'HEAD' ? undefined : cuerpo); }
  catch { res.writeHead(404, cabeceras('text/plain; charset=utf-8')).end('No encontrado'); }
}).listen(PUERTO, RED ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Pulso de Wall Street en http://127.0.0.1:${PUERTO}${RED ? `/?clave=${CLAVE}` : ''}`);
  if (RED) for (const a of ips()) console.log(`Desde el celular (mismo Wi-Fi): http://${a}:${PUERTO}/?clave=${CLAVE}`);
  console.log('Ctrl+C para cerrar.');
  if (process.argv.includes('--abrir')) spawn('cmd', ['/c', 'start', '', `http://127.0.0.1:${PUERTO}/#celular`], { detached: true, stdio: 'ignore' }).unref();
});
