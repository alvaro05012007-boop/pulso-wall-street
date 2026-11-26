// Fórmulas cuantitativas usadas por acciones.mjs. Todas reciben series de cierres (más viejo primero).
// Las pruebas están en cuant.test.mjs (node --test).

export const media = a => a.reduce((s, v) => s + v, 0) / a.length;
export const desvio = a => { const m = media(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };

export const rendimientos = c => c.slice(1).map((v, i) => v / c[i] - 1); // simples, diarios

export function volatilidad(c) { // anualizada en %, con rendimientos logarítmicos y 252 ruedas por año
  if (c.length < 3) return null;
  return desvio(c.slice(1).map((v, i) => Math.log(v / c[i]))) * Math.sqrt(252) * 100;
}
export function caidaMaxima(c) { // peor caída desde un máximo previo, en % (positivo)
  let pico = c[0], peor = 0;
  for (const v of c) { pico = Math.max(pico, v); peor = Math.max(peor, (pico - v) / pico); }
  return peor * 100;
}
export function sma(c, n) { // media móvil simple: serie (null hasta tener n datos)
  const out = new Array(c.length).fill(null); let s = 0;
  for (let i = 0; i < c.length; i++) { s += c[i]; if (i >= n) s -= c[i - n]; if (i >= n - 1) out[i] = s / n; }
  return out;
}
export function ema(c, n) { // media exponencial, arranca con la SMA de los primeros n datos
  const out = new Array(c.length).fill(null), k = 2 / (n + 1);
  if (c.length < n) return out;
  out[n - 1] = media(c.slice(0, n));
  for (let i = n; i < c.length; i++) out[i] = c[i] * k + out[i - 1] * (1 - k);
  return out;
}
export function rsi(c, n = 14) { // RSI de Wilder (0-100)
  if (c.length <= n) return null;
  let g = 0, p = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; d > 0 ? g += d : p -= d; }
  g /= n; p /= n;
  for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; p = (p * (n - 1) + Math.max(-d, 0)) / n; }
  if (p === 0) return g === 0 ? 50 : 100;
  return 100 - 100 / (1 + g / p);
}
export function macd(c, rapida = 12, lenta = 26, senal = 9) { // línea = EMA12 - EMA26; señal = EMA9 de la línea
  const a = ema(c, rapida), b = ema(c, lenta);
  const linea = c.map((_, i) => a[i] != null && b[i] != null ? a[i] - b[i] : null).filter(v => v != null);
  if (linea.length < senal) return null;
  const s = ema(linea, senal).at(-1);
  return { linea: linea.at(-1), senal: s, hist: linea.at(-1) - s };
}
export function atr(h, l, c, n = 14) { // Average True Range de Wilder, en las mismas unidades que el precio
  if (c.length <= n) return null;
  const tr = c.map((_, i) => i === 0 ? h[0] - l[0] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
  let v = media(tr.slice(1, n + 1));
  for (let i = n + 1; i < tr.length; i++) v = (v * (n - 1) + tr[i]) / n;
  return v;
}
export function bollinger(c, n = 20, k = 2) { // media de 20 ± 2 desvíos (poblacionales); pctB = dónde está el precio dentro de las bandas
  if (c.length < n) return null;
  const v = c.slice(-n), m = media(v), d = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / n);
  const sup = m + k * d, inf = m - k * d;
  return { media: m, sup, inf, pctB: sup === inf ? .5 : (c.at(-1) - inf) / (sup - inf) };
}
export function covarianza(a, b) { const ma = media(a), mb = media(b); return a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / (a.length - 1); }
export function correlacion(a, b) { const da = desvio(a), db = desvio(b); return da && db ? covarianza(a, b) / (da * db) : null; }
export function beta(ra, rm) { const v = covarianza(rm, rm); return v ? covarianza(ra, rm) / v : null; } // sensibilidad frente al mercado
export function alinear(fa, ca, fb, cb) { // deja solo las fechas que están en las dos series
  const m = new Map(fb.map((f, i) => [f, cb[i]])), a = [], b = [];
  fa.forEach((f, i) => { if (m.has(f)) { a.push(ca[i]); b.push(m.get(f)); } });
  return [a, b];
}
export function nombreCorto(n) { // "JPMorgan Chase & Co." -> "JPMorgan Chase"
  let s = n.replace(/^The /, '').replace(/\.com\b/, ''), antes;
  do {
    antes = s;
    s = s.replace(/[\s,]+(Inc\.?|Incorporated|Corporation|Corp\.?|Company|Companies|Co\.?|plc|N\.V\.|Holdings|Group|Limited|Ltd\.?|International|Communications)$/i, '').replace(/\s*&$/, '');
  } while (s !== antes);
  return s.trim();
}
// Historia de una serie diaria: rendimiento de cada mes y de cada año (cierre contra cierre del período anterior),
// caídas de 10% o más con su piso y su recuperación, y los días de mayor suba y baja. Todo en %.
export function historia(fechas, cierres, detalle = false) {
  const finMes = new Map(), finAnio = new Map(); // último índice de cada mes y de cada año
  fechas.forEach((f, i) => { finMes.set(f.slice(0, 7), i); finAnio.set(f.slice(0, 4), i); });
  const r1 = v => Math.round(v * 1000) / 10;
  const mensual = [], anual = [];
  let prev = null;
  for (const [mes, i] of finMes) { if (prev != null) mensual.push({ mes, ret: r1(cierres[i] / cierres[prev] - 1) }); prev = i; }
  prev = null;
  for (const [anio, i] of finAnio) { // el primer año va desde el primer cierre disponible: se marca como parcial
    const base = prev ?? 0;
    anual.push({ anio, ret: r1(cierres[i] / cierres[base] - 1), parcial: prev == null || i === fechas.length - 1 });
    prev = i;
  }
  const out = { mensual, anual };
  if (!detalle) return out;
  const caidas = []; let pico = cierres[0], iPico = 0, ep = null;
  for (let i = 1; i < cierres.length; i++) {
    const c = cierres[i];
    if (c >= pico) { if (ep) { ep.recuperado = fechas[i]; caidas.push(ep); ep = null; } pico = c; iPico = i; continue; }
    const dd = c / pico - 1;
    if (dd <= -.1) { if (!ep) ep = { desde: fechas[iPico], piso: fechas[i], caida: dd, recuperado: null }; else if (dd < ep.caida) { ep.caida = dd; ep.piso = fechas[i]; } }
  }
  if (ep) caidas.push(ep);
  out.caidas = caidas.map(e => ({ ...e, caida: r1(e.caida) }));
  const dias = cierres.slice(1).map((v, i) => ({ fecha: fechas[i + 1], ret: Math.round((v / cierres[i] - 1) * 10000) / 100 }));
  const ord = [...dias].sort((a, b) => b.ret - a.ret);
  out.mejores = ord.slice(0, 5); out.peores = ord.slice(-5).reverse();
  return out;
}

export function percentil(valores) { // puesto relativo 0..1 dentro del grupo (empates comparten el primero)
  const s = [...valores].sort((a, b) => a - b);
  return v => s.length > 1 ? s.indexOf(v) / (s.length - 1) : .5;
}
