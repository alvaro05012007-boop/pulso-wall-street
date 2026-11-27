// Datos de cada empresa que cambian poco: precio objetivo de los analistas, próximo balance y capitalización (Yahoo Finance)
// y últimas presentaciones oficiales ante la SEC (EDGAR, gratis). Escribe empresas.js. Uso: node empresas.mjs [--forzar]
// Corre como mucho una vez cada 20 horas (lo llama actualizar.mjs). Si una fuente falla, conserva el dato anterior con su fecha.
// Nunca completa un valor que no vino de la fuente.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { marcarVersion } from './version.mjs';

const ARCHIVO = new URL('./empresas.js', import.meta.url);
const leer = (f, v) => { try { const t = readFileSync(f, 'utf8'); return JSON.parse(t.slice(t.indexOf('=') + 1).trim().replace(/;\s*$/, '')); } catch { return null; } };
const previo = leer(ARCHIVO, 'EMPRESAS');
if (!process.argv.includes('--forzar') && previo?.actualizado && Date.now() - Date.parse(previo.actualizado) < 20 * 3600e3) {
  console.log('empresas.js es de hace menos de 20 horas: no hace falta actualizarlo.'); process.exit(0);
}
const acciones = leer(new URL('./acciones.js', import.meta.url));
if (!acciones?.lista?.length) { console.error('Falta acciones.js: correr antes node acciones.mjs'); process.exit(1); }
const tickers = acciones.lista.map(a => a.ticker);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const SEC_UA = 'PulsoDeWallStreet/1.0 (proyecto personal)'; // la SEC pide identificarse; sin datos personales
const num = x => Number.isFinite(x) ? x : null;
const fechaDe = s => Number.isFinite(s) ? new Date(s * 1000).toISOString().slice(0, 10) : null;
const espera = ms => new Promise(r => setTimeout(r, ms));
async function json(url, headers) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function deA(n, items, fn, pausa = 0) { // de a n por vez, para no saturar las fuentes
  const ok = new Map(), fallas = new Map();
  for (let i = 0; i < items.length; i += n) {
    const lote = items.slice(i, i + n);
    (await Promise.allSettled(lote.map(fn))).forEach((r, k) => r.status === 'fulfilled' ? ok.set(lote[k], r.value) : fallas.set(lote[k], r.reason.message));
    if (pausa) await espera(pausa);
  }
  return { ok, fallas };
}

// ---- Yahoo: analistas, balance y capitalización (necesita cookie + "crumb", como la web de Yahoo) ----
async function sesionYahoo() {
  const c = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const cookie = (c.headers.getSetCookie?.() || []).map(s => s.split(';')[0]).join('; ');
  const r = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, cookie }, signal: AbortSignal.timeout(20000) });
  const crumb = (await r.text()).trim();
  if (!r.ok || !crumb || crumb.length > 40 || /[<{\s]/.test(crumb)) throw new Error('Yahoo no dio sesión');
  return { cookie, crumb };
}
async function yahoo(t, s) {
  const j = await json(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(t)}?modules=financialData,calendarEvents,price&crumb=${encodeURIComponent(s.crumb)}`,
    { 'User-Agent': UA, cookie: s.cookie });
  const q = j?.quoteSummary?.result?.[0];
  if (!q) throw new Error('sin datos');
  const f = q.financialData || {}, e = q.calendarEvents?.earnings || {}, p = q.price || {};
  const n = num(f.numberOfAnalystOpinions?.raw);
  return {
    analistas: n && num(f.targetMeanPrice?.raw) ? { media: num(f.targetMeanPrice.raw), alta: num(f.targetHighPrice?.raw), baja: num(f.targetLowPrice?.raw),
      mediana: num(f.targetMedianPrice?.raw), cantidad: n, recomendacion: typeof f.recommendationKey === 'string' ? f.recommendationKey.slice(0, 20) : null } : null,
    balance: e.earningsDate?.length ? { fecha: fechaDe(e.earningsDate[0]?.raw), estimada: !!e.isEarningsDateEstimate,
      gananciaPorAccion: num(e.earningsAverage?.raw), ingresos: num(e.revenueAverage?.raw) } : null,
    capitalizacion: num(p.marketCap?.raw),
  };
}

// ---- SEC EDGAR: últimas presentaciones oficiales (balances trimestrales y anuales, hechos relevantes) ----
const FORMULARIOS = { '10-K': 'Informe anual', '10-Q': 'Informe trimestral', '8-K': 'Hecho relevante', '20-F': 'Informe anual (empresa extranjera)', '6-K': 'Informe (empresa extranjera)' };
const ITEMS_8K = { '1.01': 'acuerdo importante', '2.01': 'compra o venta de activos', '2.02': 'resultados', '2.05': 'reestructuración', '2.06': 'deterioro de activos',
  '5.02': 'cambios en la dirección', '5.07': 'votación de accionistas', '7.01': 'comunicado', '8.01': 'otros hechos', '9.01': 'estados financieros' };
async function sec(cik) {
  const j = await json(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`, { 'User-Agent': SEC_UA });
  const r = j?.filings?.recent || {}, out = [];
  for (let i = 0; i < (r.form || []).length && out.length < 6; i++) {
    const form = r.form[i];
    if (!FORMULARIOS[form] || !/^[\w.-]+$/.test(r.primaryDocument?.[i] || '') || !/^[\d-]+$/.test(r.accessionNumber?.[i] || '')) continue;
    const items = form === '8-K' ? String(r.items?.[i] || '').split(',').map(x => ITEMS_8K[x.trim()]).filter(Boolean) : [];
    out.push({ fecha: String(r.filingDate[i]).slice(0, 10), formulario: form, tipo: FORMULARIOS[form] + (items.length ? ': ' + [...new Set(items)].join(', ') : ''),
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${r.accessionNumber[i].replace(/-/g, '')}/${r.primaryDocument[i]}` });
  }
  return out;
}

const inicio = Date.now(), porTicker = {}, avisos = [];
let yh = { ok: new Map(), fallas: new Map() }, sc = { ok: new Map(), fallas: new Map() };
try { const s = await sesionYahoo(); yh = await deA(4, tickers, t => yahoo(t, s), 300); } catch (e) { avisos.push('Yahoo: ' + e.message); }
try {
  const mapa = await json('https://www.sec.gov/files/company_tickers.json', { 'User-Agent': SEC_UA });
  const cik = new Map(Object.values(mapa).map(x => [String(x.ticker).toUpperCase().replace('.', '-'), x.cik_str]));
  const conCik = tickers.filter(t => cik.has(t));
  sc = await deA(5, conCik, t => sec(cik.get(t)), 700); // la SEC permite hasta 10 pedidos por segundo
} catch (e) { avisos.push('SEC: ' + e.message); }

const hoy = new Date().toISOString();
for (const t of tickers) {
  const ant = previo?.porTicker?.[t] || {}, y = yh.ok.get(t), s = sc.ok.get(t);
  porTicker[t] = {
    analistas: y ? y.analistas : ant.analistas ?? null, balance: y ? y.balance : ant.balance ?? null, capitalizacion: y ? y.capitalizacion : ant.capitalizacion ?? null,
    yahooFecha: y ? hoy : ant.yahooFecha ?? null,
    presentaciones: s ?? ant.presentaciones ?? [], secFecha: s ? hoy : ant.secFecha ?? null,
  };
}
const salida = { actualizado: hoy, fuentes: { yahoo: 'Yahoo Finance (quoteSummary)', sec: 'SEC EDGAR' }, avisos, porTicker };
const tmp = new URL(`./empresas.js.${process.pid}.tmp`, import.meta.url);
writeFileSync(tmp, 'window.EMPRESAS = ' + JSON.stringify(salida) + ';\n');
renameSync(tmp, ARCHIVO);
marcarVersion('empresas');
const resumen = { yahoo: yh.ok.size, sec: sc.ok.size, fallasYahoo: yh.fallas.size, fallasSec: sc.fallas.size, avisos, segundos: Math.round((Date.now() - inicio) / 1000) };
console.log(JSON.stringify(resumen));
process.exitCode = yh.ok.size + sc.ok.size > 0 ? 0 : 1; // falla solo si no vino nada de ninguna fuente
