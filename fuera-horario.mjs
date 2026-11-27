// Precio fuera del horario normal (antes de la apertura, 4:00-9:30 NY, y después del cierre, 16:00-20:00 NY) de cada empresa.
// Yahoo Finance (v7/quote, un solo pedido para todas). Escribe extendido.js. Lo llama actualizar.mjs en esas franjas.
// Si Yahoo falla, deja el archivo anterior intacto. Nunca completa un valor que no vino de la fuente.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { marcarVersion } from './version.mjs';

const leer = f => { try { const t = readFileSync(f, 'utf8'); return JSON.parse(t.slice(t.indexOf('=') + 1).trim().replace(/;\s*$/, '')); } catch { return null; } };
const acciones = leer(new URL('./acciones.js', import.meta.url));
if (!acciones?.lista?.length) { console.error('Falta acciones.js: correr antes node acciones.mjs'); process.exit(1); }
const previo = leer(new URL('./extendido.js', import.meta.url));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', T = () => AbortSignal.timeout(20000);
const c = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual', signal: T() });
const cookie = (c.headers.getSetCookie?.() || []).map(s => s.split(';')[0]).join('; ');
const rc = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, cookie }, signal: T() });
const crumb = (await rc.text()).trim();
if (!rc.ok || !crumb || crumb.length > 40 || /[<{\s]/.test(crumb)) { console.error('Yahoo no dio sesión'); process.exit(1); }

const campos = 'regularMarketPrice,regularMarketTime,postMarketPrice,postMarketChangePercent,postMarketTime,preMarketPrice,preMarketChangePercent,preMarketTime';
const fin = x => Number.isFinite(x) ? x : null;
const porTicker = { ...(previo?.porTicker || {}) }; // si una empresa no viene, queda su último dato con su hora
const tickers = acciones.lista.map(a => a.ticker);
let llegaron = 0;
for (let i = 0; i < tickers.length; i += 50) {
  const r = await fetch(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${tickers.slice(i, i + 50).map(encodeURIComponent).join(',')}&fields=${campos}&crumb=${encodeURIComponent(crumb)}`,
    { headers: { 'User-Agent': UA, cookie }, signal: T() });
  if (!r.ok) { console.error(`Yahoo HTTP ${r.status}`); continue; }
  for (const q of (await r.json())?.quoteResponse?.result || []) {
    if (!tickers.includes(q.symbol)) continue;
    // la sesión extendida más nueva, solo si es posterior al último precio normal (si no, ya quedó vieja)
    const ops = [['post', q.postMarketPrice, q.postMarketChangePercent, q.postMarketTime], ['pre', q.preMarketPrice, q.preMarketChangePercent, q.preMarketTime]]
      .filter(([, p, , t]) => fin(p) && fin(t) && t > (q.regularMarketTime || 0)).sort((a, b) => b[3] - a[3]);
    if (!ops.length) continue;
    const [sesion, precio, cambioPct, t] = ops[0];
    porTicker[q.symbol] = { sesion, precio, cambioPct: fin(cambioPct), base: fin(q.regularMarketPrice), hora: new Date(t * 1000).toISOString() };
    llegaron++;
  }
}
if (!llegaron) { console.error('Yahoo no dio precios fuera de horario'); process.exit(1); }
const f = new URL('./extendido.js', import.meta.url), tmp = new URL(`./extendido.js.${process.pid}.tmp`, import.meta.url);
writeFileSync(tmp, 'window.EXTENDIDO = ' + JSON.stringify({ actualizado: new Date().toISOString(), fuente: 'Yahoo Finance', porTicker }) + ';\n');
renameSync(tmp, f);
marcarVersion('extendido');
console.log(`Fuera de horario: ${llegaron} empresas.`);
