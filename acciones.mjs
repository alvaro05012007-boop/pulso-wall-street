// Datos de mercado de la página: 5 años de precios diarios (Yahoo Finance, API pública de gráficos) de las 100 empresas
// más grandes del S&P 500 y de los índices, con indicadores calculados en cuant.mjs. Escribe acciones.js. Uso: node acciones.mjs
// Si Yahoo falla prueba su servidor alternativo; si sigue fallando conserva el último dato válido marcado como desactualizado.
// Nunca completa un valor que no vino de la fuente.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import * as q from './cuant.mjs';
import { marcarVersion } from './version.mjs';

// Mismos nombres de sector que usan los resúmenes de noticias, para poder cruzarlos en la página.
const SECTORES = {
  'Tecnología': 'AAPL GOOGL META AMZN UBER',
  'Semiconductores': 'NVDA AVGO AMD TXN QCOM AMAT ADI KLAC MU LRCX',
  'Software': 'MSFT ORCL CRM ADBE NOW INTU PANW ACN IBM ADP PLTR',
  'Hardware': 'CSCO ANET',
  'Financiero': 'BRK-B JPM V MA BAC WFC GS MS SPGI AXP BLK C SCHW PGR CB BX',
  'Energía': 'XOM CVX COP',
  'Salud': 'LLY UNH JNJ ABBV MRK TMO ABT DHR AMGN ISRG PFE SYK ELV VRTX BSX MDT REGN GILD CI BMY',
  'Consumo': 'TSLA COST WMT HD PG KO PEP MCD PM LOW TJX SBUX MO BKNG',
  'Comunicaciones': 'NFLX DIS CMCSA T VZ',
  'Industria': 'GE CAT HON ETN DE WM',
  'Defensa': 'RTX LMT',
  'Transporte': 'UNP',
  'Inmobiliario': 'PLD',
  'Servicios públicos': 'NEE SO DUK',
  'Materiales': 'LIN',
};
// Los 10 grandes sectores del Centro de inteligencia agrupan a los de arriba.
const MACRO = { 'Tecnología': ['Tecnología', 'Semiconductores', 'Software', 'Hardware'], 'Salud': ['Salud'], 'Finanzas': ['Financiero'],
  'Energía': ['Energía'], 'Consumo': ['Consumo'], 'Industria': ['Industria', 'Defensa', 'Transporte'], 'Materiales': ['Materiales'],
  'Servicios públicos': ['Servicios públicos'], 'Inmobiliario': ['Inmobiliario'], 'Comunicaciones': ['Comunicaciones'] };
const INDICES = { sp500: ['^GSPC', 'S&P 500'], dow: ['^DJI', 'Dow Jones'], nasdaq: ['^IXIC', 'Nasdaq Composite'], nasdaq100: ['^NDX', 'Nasdaq 100'],
  russell: ['^RUT', 'Russell 2000'], vix: ['^VIX', 'VIX'], bono10: ['^TNX', 'Bono del Tesoro a 10 años'], wti: ['CL=F', 'Petróleo WTI'],
  dolar: ['DX-Y.NYB', 'Dólar (DXY)'], tbill: ['^IRX', 'Letra del Tesoro a 13 semanas'] };
// Cómo las nombran las noticias cuando difiere del nombre legal (para encontrarlas en los resúmenes).
const ALIAS = { GOOGL: 'Google', META: 'Meta', 'BRK-B': 'Berkshire', LLY: 'Lilly', JPM: 'JPMorgan', XOM: 'Exxon',
  CSCO: 'Cisco', UBER: 'Uber', HON: 'Honeywell', VRTX: 'Vertex', SCHW: 'Schwab', REGN: 'Regeneron', GILD: 'Gilead',
  MU: 'Micron', ANET: 'Arista', PLTR: 'Palantir', ABT: 'Abbott', DIS: 'Disney', COST: 'Costco', TMO: 'Thermo Fisher' };
const FUENTE = 'Yahoo Finance';
const ARCHIVO = new URL('./acciones.js', import.meta.url);
const esperar = ms => new Promise(r => setTimeout(r, ms));
const r2 = (v, d = 2) => v == null || !Number.isFinite(v) ? null : +v.toFixed(d);
const pct = v => (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + '%';

function validar(res, servidor) {
  const q0 = res.indicators?.quote?.[0] || {}, tz = res.meta.exchangeTimezoneName || 'America/New_York';
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  const filas = [];
  (res.timestamp || []).forEach((ts, i) => {
    const c = q0.close?.[i];
    if (!(c > 0) || !Number.isFinite(c)) return;
    const fecha = dia.format(new Date(ts * 1000));
    if (filas.length && fecha <= filas.at(-1).fecha) return; // duplicada o fuera de orden
    const h = q0.high?.[i], l = q0.low?.[i];
    filas.push({ fecha, c, h: h > 0 ? h : c, l: l > 0 ? l : c, v: Number.isFinite(q0.volume?.[i]) ? q0.volume[i] : null });
  });
  if (filas.length < 60) { const e = new Error('menos de 60 cierres válidos'); e.definitivo = true; throw e; }
  const avisos = [], precio = res.meta.regularMarketPrice, ultimo = filas.at(-1).c;
  if (precio > 0 && Math.abs(precio / ultimo - 1) > .25) avisos.push(`el precio informado (${precio}) difiere más de 25% del último cierre (${r2(ultimo)})`);
  for (let i = filas.length - 260; i < filas.length; i++) {
    if (i < 1) continue;
    const s = filas[i].c / filas[i - 1].c - 1;
    if (Math.abs(s) > .5) avisos.push(`salto de ${(s * 100).toFixed(0)}% el ${filas[i].fecha}: revisar si fue un split`);
  }
  return { meta: res.meta, filas, avisos, servidor };
}

async function bajar(simbolo) {
  let error;
  for (const servidor of ['query1', 'query2']) for (let intento = 1; intento <= 2; intento++) {
    try {
      const r = await fetch(`https://${servidor}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=5y&interval=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.definitivo = r.status === 404; throw e; }
      const res = (await r.json())?.chart?.result?.[0];
      if (!res?.meta) throw new Error('respuesta vacía');
      return validar(res, servidor);
    } catch (e) {
      error = e;
      if (e.definitivo) throw new Error(`${simbolo}: ${e.message}`);
      await esperar(700 * intento);
    }
  }
  throw new Error(`${simbolo}: ${error.message}`);
}

function semanal(f) { // un punto cada 5 ruedas (para el gráfico de 5 años sin pesar demasiado)
  const fechas = [], cierres = [];
  for (let i = f.length - 1; i >= 0; i -= 5) { fechas.push(f[i].fecha); cierres.push(r2(f[i].c)); }
  return { fechas: fechas.reverse(), cierres: cierres.reverse() };
}

function analizar(d, ref, rf) {
  const f = d.filas, c = f.map(x => x.c), n = c.length, ult = c.at(-1);
  const ret = k => n > k ? r2((ult / c[n - 1 - k] - 1) * 100) : null;
  const anio = f.slice(-253), ca = anio.map(x => x.c);
  const hace5 = new Date(); hace5.setFullYear(hace5.getFullYear() - 5); hace5.setDate(hace5.getDate() + 10);
  const sm = Object.fromEntries([20, 50, 100, 200].map(k => [k, r2(q.sma(c, k).at(-1))]));
  const bb = q.bollinger(c), mc = q.macd(c), at = q.atr(f.map(x => x.h), f.map(x => x.l), c);
  const vols = f.slice(-21, -1).map(x => x.v).filter(v => v > 0), volHoy = f.at(-1).v;
  const volProm20 = vols.length >= 10 ? q.media(vols) : null;
  const altos = anio.map(x => x.h), bajos = anio.map(x => x.l);
  const a = {
    nombre: d.meta.longName || d.meta.shortName || null, moneda: d.meta.currency || null,
    precio: r2(d.meta.regularMarketPrice ?? ult), cambio1d: ret(1),
    retorno1a: r2((ca.at(-1) / ca[0] - 1) * 100, 1), volatilidad: r2(q.volatilidad(ca), 1), caidaMax: r2(q.caidaMaxima(ca), 1),
    fechas: anio.map(x => x.fecha), cierres: ca.map(v => r2(v)), semanal: semanal(f), desde: f[0].fecha,
    previos: c.slice(-453, -253).map(v => r2(v)), // 200 cierres antes del año: para dibujar medias de 200 y otros indicadores desde el inicio del gráfico
    volumenes: anio.map(x => x.v),
    historia: q.historia(f.map(x => x.fecha), c, !ref), // índices (sin ref) con caídas y días extremos; empresas solo meses y años
    ret: { d1: ret(1), s1: ret(5), m1: ret(21), m3: ret(63), m6: ret(126), a1: ret(252), a3: ret(756),
      a5: f[0].fecha <= hace5.toISOString().slice(0, 10) ? r2((ult / c[0] - 1) * 100) : null },
    volumen: volHoy, volProm20: r2(volProm20, 0), volRel: volHoy > 0 && volProm20 ? r2(volHoy / volProm20) : null,
    max52: r2(Math.max(...altos)), min52: r2(Math.min(...bajos)),
    nuevoMax: f.at(-1).h >= Math.max(...altos.slice(0, -1)), nuevoMin: f.at(-1).l <= Math.min(...bajos.slice(0, -1)),
    sma: sm, sobre50: sm[50] == null ? null : ult > sm[50], sobre200: sm[200] == null ? null : ult > sm[200],
    rsi: r2(q.rsi(c), 1), macd: mc && { linea: r2(mc.linea), senal: r2(mc.senal), hist: r2(mc.hist) },
    atr: r2(at), atrPct: at ? r2(at / ult * 100) : null,
    bollinger: bb && { sup: r2(bb.sup), inf: r2(bb.inf), media: r2(bb.media), pctB: r2(bb.pctB) },
    volHist20: r2(q.volatilidad(c.slice(-21)), 1), caidaMax5a: r2(q.caidaMaxima(c), 1),
    // días corridos -> ruedas (252 por año): base de la proyección estimada que muestra la ficha de cada empresa
    escenarios: Object.fromEntries([[30, 21], [60, 41], [90, 62], [180, 124], [360, 249], [720, 497]].map(([d, t]) => [d, q.escenarios(c, t)])),
    fuente: FUENTE, servidor: d.servidor, actualizadoISO: new Date(d.meta.regularMarketTime * 1000).toISOString(),
    estado: 'ok', avisos: d.avisos.slice(0, 5), anomalias: [],
  };
  const rr = q.rendimientos(ca);
  if (rr.length > 30) {
    const hist = rr.slice(0, -1), z = (rr.at(-1) - q.media(hist)) / q.desvio(hist);
    if (Math.abs(z) >= 3) a.anomalias.push({ tipo: 'Movimiento extraordinario', detalle: `${pct(rr.at(-1) * 100)} en la última rueda: ${Math.abs(z).toFixed(1).replace('.', ',')} veces su movimiento típico del año` });
  }
  if (a.volRel >= 2) a.anomalias.push({ tipo: 'Volumen anormal', detalle: `${a.volRel.toFixed(1).replace('.', ',')} veces el volumen promedio de 20 ruedas` });
  if (a.volHist20 && a.volatilidad && a.volHist20 / a.volatilidad >= 1.5) a.anomalias.push({ tipo: 'Volatilidad en alza', detalle: `la de 20 ruedas (${a.volHist20}%) supera en 50% o más a la del año (${a.volatilidad}%)` });
  if (ref) {
    const [x, m] = q.alinear(a.fechas, ca, ref.fechas, ref.cierres), rx = q.rendimientos(x), rm = q.rendimientos(m);
    a.beta = r2(q.beta(rx, rm)); a.corrSP = r2(q.correlacion(rx, rm)); a.corrSP60 = r2(q.correlacion(rx.slice(-60), rm.slice(-60)));
    a.relSP = ref.retorno1a != null ? r2(a.retorno1a - ref.retorno1a, 1) : null;
    if (a.corrSP != null && a.corrSP60 != null && Math.abs(a.corrSP60 - a.corrSP) >= .35)
      a.anomalias.push({ tipo: 'Ruptura de correlación', detalle: `su correlación con el S&P 500 pasó de ${a.corrSP} en el año a ${a.corrSP60} en 60 ruedas` });
  }
  if (rf != null && a.volatilidad) a.sharpe = r2((a.retorno1a - rf) / a.volatilidad);
  return a;
}

async function deA5(simbolos, fn) { // de a 5 para no saturar la fuente
  const ok = new Map(), fallas = new Map();
  for (let i = 0; i < simbolos.length; i += 5) {
    const lote = simbolos.slice(i, i + 5);
    (await Promise.allSettled(lote.map(fn))).forEach((r, k) => r.status === 'fulfilled' ? ok.set(lote[k], r.value) : fallas.set(lote[k], r.reason.message));
  }
  return { ok, fallas };
}

function anterior() { // último acciones.js válido, para no perder datos si una fuente falla
  try { const t = readFileSync(ARCHIVO, 'utf8'); return JSON.parse(t.slice(t.indexOf('=') + 1).trim().replace(/;\s*$/, '')); } catch { return null; }
}
const viejo = (x, motivo) => ({ ...x, estado: 'desactualizado', avisos: [`no se pudo actualizar (${motivo}); es el último dato válido`, ...(x.avisos || [])].slice(0, 5) });

const inicio = Date.now(), previo = anterior();
const idx = await deA5(Object.keys(INDICES), k => bajar(INDICES[k][0]));
const indices = {};
for (const [k, [simbolo, nombre]] of Object.entries(INDICES)) {
  if (idx.ok.has(k)) indices[k] = { ...analizar(idx.ok.get(k)), nombre, simbolo };
  else if (previo?.indices?.[k]) indices[k] = viejo(previo.indices[k], idx.fallas.get(k));
}
const ref = indices.sp500, rf = indices.tbill?.cierres?.at(-1) ?? null;

const sectorDe = Object.fromEntries(Object.entries(SECTORES).flatMap(([s, t]) => t.split(' ').map(x => [x, s])));
const emp = await deA5(Object.keys(sectorDe), bajar);
const lista = [];
for (const t of Object.keys(sectorDe)) {
  if (emp.ok.has(t)) {
    const a = analizar(emp.ok.get(t), ref, rf);
    lista.push({ ticker: t, sector: sectorDe[t], claves: [...new Set([q.nombreCorto(a.nombre || t), ALIAS[t], t.length >= 3 ? t : null].filter(Boolean))], ...a });
  } else {
    const p = previo?.lista?.find(x => x.ticker === t);
    if (p) lista.push(viejo(p, emp.fallas.get(t)));
  }
}
if (emp.ok.size < 10) { console.error(JSON.stringify({ ok: false, motivo: 'menos de 10 empresas actualizadas: no toco acciones.js', fallas: [...emp.fallas.values()] })); process.exit(1); }

// Puntajes 1-100 dentro del grupo. Son pasado, no pronóstico.
const pv = q.percentil(lista.map(a => a.volatilidad)), pd = q.percentil(lista.map(a => a.caidaMax)), pr = q.percentil(lista.map(a => a.retorno1a));
const p5 = q.percentil(lista.map(a => a.caidaMax5a ?? a.caidaMax)), pb = q.percentil(lista.map(a => a.beta ?? 1));
for (const a of lista) {
  a.estabilidad = Math.max(1, Math.round(100 * (1 - (pv(a.volatilidad) + pd(a.caidaMax)) / 2)));   // menos volatilidad y menos caída en el año
  a.agresivo = Math.max(1, Math.round(100 * (pr(a.retorno1a) + pv(a.volatilidad)) / 2));          // más suba y más volatilidad en el año
  a.riesgo = Math.max(1, Math.round(100 * (pv(a.volatilidad) + p5(a.caidaMax5a ?? a.caidaMax) + pb(a.beta ?? 1)) / 3)); // volatilidad, caída de 5 años y beta
}
lista.sort((a, b) => b.estabilidad - a.estabilidad || a.volatilidad - b.volatilidad);

// Amplitud del mercado (solo con datos frescos)
const frescas = lista.filter(a => a.estado === 'ok');
const cuenta = fn => frescas.filter(fn).length;
const amplitud = { total: frescas.length, suben: cuenta(a => a.cambio1d > 0), bajan: cuenta(a => a.cambio1d < 0),
  sobre50: cuenta(a => a.sobre50), sobre200: cuenta(a => a.sobre200), nuevosMax: cuenta(a => a.nuevoMax), nuevosMin: cuenta(a => a.nuevoMin) };

// Sectores: promedios simples (cada empresa pesa igual) y movimiento inusual del día frente a su propio año
const sectores = {};
for (const [macro, subs] of Object.entries(MACRO)) {
  const as = frescas.filter(a => subs.includes(a.sector)); if (!as.length) continue;
  const prom = k => r2(q.media(as.map(k).filter(v => v != null)));
  const porFecha = new Map();
  for (const a of as) q.rendimientos(a.cierres).forEach((r, i) => { const f = a.fechas[i + 1]; (porFecha.get(f) || porFecha.set(f, []).get(f)).push(r); });
  const serie = [...porFecha.entries()].sort((x, y) => x[0] < y[0] ? -1 : 1).map(([, v]) => q.media(v));
  const hist = serie.slice(0, -1), z = serie.length > 30 ? (serie.at(-1) - q.media(hist)) / q.desvio(hist) : null;
  const orden = [...as].sort((x, y) => y.cambio1d - x.cambio1d);
  const anios = {}; // rendimiento anual del sector: promedio de sus empresas con el año completo
  for (const a of as) for (const y of a.historia?.anual || []) if (!y.parcial) (anios[y.anio] ??= []).push(y.ret);
  sectores[macro] = { anual: Object.entries(anios).map(([anio, v]) => ({ anio, ret: r2(q.media(v), 1), n: v.length })), n: as.length, d1: prom(a => a.ret.d1), s1: prom(a => a.ret.s1), m1: prom(a => a.ret.m1), m3: prom(a => a.ret.m3), a1: prom(a => a.ret.a1),
    volatilidad: prom(a => a.volatilidad), sobre50: Math.round(as.filter(a => a.sobre50).length / as.length * 100), z: r2(z),
    mejores: orden.slice(0, 3).map(a => a.ticker), peores: orden.slice(-3).reverse().map(a => a.ticker) };
}

const estado = { generado: new Date().toISOString(), segundos: Math.round((Date.now() - inicio) / 1000), fuente: FUENTE,
  empresas: { actualizadas: emp.ok.size, desactualizadas: lista.filter(a => a.estado !== 'ok').map(a => a.ticker), fallas: [...emp.fallas.values()] },
  indices: { actualizados: idx.ok.size, desactualizados: Object.keys(indices).filter(k => indices[k].estado !== 'ok'), fallas: [...idx.fallas.values()] },
  servidorAlternativo: [...emp.ok.values(), ...idx.ok.values()].filter(d => d.servidor !== 'query1').length,
  avisos: lista.flatMap(a => (a.avisos || []).map(x => `${a.ticker}: ${x}`)).slice(0, 30) };

const salida = { version: 2, actualizado: estado.generado, estado, amplitud, sectores, lista, indices };
const tmp = new URL('./acciones.js.tmp', import.meta.url);
writeFileSync(tmp, 'window.ACCIONES = ' + JSON.stringify(salida) + ';\n');
renameSync(tmp, ARCHIVO); // escritura atómica: la página nunca lee un archivo a medio escribir
marcarVersion('acciones');
console.log(JSON.stringify({ ok: true, empresas: lista.length, frescas: frescas.length, indices: Object.keys(indices).length, fallas: estado.empresas.fallas.length + estado.indices.fallas.length, segundos: estado.segundos }));
