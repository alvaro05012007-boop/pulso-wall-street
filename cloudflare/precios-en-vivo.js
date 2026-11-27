// Intermediario de precios en vivo para Pulso de Wall Street (Cloudflare Worker, plan gratis).
// Yahoo no deja que una página le pida precios directo desde el navegador: este Worker se los pide y se los pasa a la página.
// Uso: GET https://<tu-worker>.workers.dev/?s=AAPL,NVDA,...   -> { hora, precios: { AAPL: {...}, ... } }
// Solo lectura, sin claves. Guarda la respuesta 10 segundos para que muchos visitantes compartan el mismo pedido a Yahoo.
const PERMITIDOS = ['https://pulso-wallstreet.pages.dev', 'https://alvaro05012007-boop.github.io', 'http://localhost:8787', 'http://127.0.0.1:8787', 'null']; // null = doble clic en index.html
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const CAMPOS = 'marketState,regularMarketPrice,regularMarketChangePercent,regularMarketTime,postMarketPrice,postMarketChangePercent,postMarketTime,preMarketPrice,preMarketChangePercent,preMarketTime';
let sesion = null; // cookie + crumb de Yahoo, reutilizados mientras el Worker siga vivo

async function nuevaSesion() {
  const c = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' });
  const cookie = (c.headers.getSetCookie?.() || [c.headers.get('set-cookie') || '']).map(s => s.split(';')[0]).filter(Boolean).join('; ');
  const r = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, cookie } });
  const crumb = (await r.text()).trim();
  if (!r.ok || !crumb || crumb.length > 40 || /[<{\s]/.test(crumb)) throw new Error('Yahoo no dio sesión');
  return { cookie, crumb };
}
async function cotizar(simbolos) {
  for (let intento = 0; intento < 2; intento++) {
    sesion ??= await nuevaSesion();
    const out = {};
    let vencida = false;
    for (let i = 0; i < simbolos.length; i += 60) {
      const r = await fetch(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${simbolos.slice(i, i + 60).map(encodeURIComponent).join(',')}&fields=${CAMPOS}&crumb=${encodeURIComponent(sesion.crumb)}`,
        { headers: { 'User-Agent': UA, cookie: sesion.cookie } });
      if (r.status === 401 || r.status === 403) { vencida = true; break; }
      if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
      const fin = x => Number.isFinite(x) ? x : null;
      for (const q of (await r.json())?.quoteResponse?.result || []) out[q.symbol] = {
        estado: typeof q.marketState === 'string' ? q.marketState.slice(0, 12) : null,
        precio: fin(q.regularMarketPrice), cambioPct: fin(q.regularMarketChangePercent), hora: fin(q.regularMarketTime),
        post: fin(q.postMarketPrice) ? { precio: q.postMarketPrice, cambioPct: fin(q.postMarketChangePercent), hora: fin(q.postMarketTime) } : null,
        pre: fin(q.preMarketPrice) ? { precio: q.preMarketPrice, cambioPct: fin(q.preMarketChangePercent), hora: fin(q.preMarketTime) } : null,
      };
    }
    if (!vencida) return out;
    sesion = null; // la sesión venció: se pide otra una vez
  }
  throw new Error('Yahoo rechazó la sesión');
}

// Lista de espera de Pulso Premium: guarda solo el email y la fecha (sin IP ni nada más) en el KV "LISTA" de tu cuenta.
// Para verla o exportarla: node exportar-lista.mjs (en la PC, con la sesión de wrangler).
async function anotar(req, env, responder) {
  if (req.method !== 'POST') return responder({ error: 'solo POST' }, 405);
  if (!env?.LISTA) return responder({ error: 'lista no configurada' }, 500);
  let d;
  try { d = JSON.parse((await req.text()).slice(0, 2000)); } catch { return responder({ error: 'pedido inválido' }, 400); }
  if (d?.web) return responder({ ok: true }); // campo trampa que solo llenan los robots: se ignora sin avisar
  const email = String(d?.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(email)) return responder({ error: 'Ese email no parece válido.' }, 400);
  if (d?.acepto !== true) return responder({ error: 'Falta aceptar que te escribamos.' }, 400);
  const ya = await env.LISTA.get(email);
  if (ya === null) await env.LISTA.put(email, '1', { metadata: { fecha: new Date().toISOString() } }); // la fecha va como metadato: el listado la trae sin leer cada email
  return responder({ ok: true, ya: !!ya });
}

export default {
  async fetch(req, env, ctx) {
    const origen = req.headers.get('Origin');
    const cors = { 'Access-Control-Allow-Origin': PERMITIDOS.includes(origen) ? origen : PERMITIDOS[0], 'Vary': 'Origin' };
    const responder = (cuerpo, estado = 200, extra = {}) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, ...extra } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (origen && !PERMITIDOS.includes(origen)) return responder({ error: 'origen no permitido' }, 403);
    const url = new URL(req.url);
    if (url.pathname === '/lista') return anotar(req, env, responder);
    if (req.method !== 'GET') return responder({ error: 'solo GET' }, 405);
    const simbolos = [...new Set((url.searchParams.get('s') || '').toUpperCase().split(',').filter(Boolean))].sort();
    if (!simbolos.length || simbolos.length > 150 || !simbolos.every(s => /^[A-Z0-9.^=-]{1,12}$/.test(s))) return responder({ error: 'símbolos inválidos' }, 400);

    const clave = new Request(`https://cache.local/?s=${simbolos.join(',')}`); // misma lista = misma respuesta guardada
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const guardada = await cache?.match(clave);
    if (guardada) return responder(await guardada.json(), 200, { 'X-Cache': 'HIT' });
    try {
      const cuerpo = { hora: new Date().toISOString(), fuente: 'Yahoo Finance', precios: await cotizar(simbolos) };
      const p = cache?.put(clave, new Response(JSON.stringify(cuerpo), { headers: { 'Cache-Control': 'max-age=10' } }));
      if (p) ctx?.waitUntil ? ctx.waitUntil(p) : await p;
      return responder(cuerpo, 200, { 'Cache-Control': 'no-store' });
    } catch (e) {
      return responder({ error: String(e.message).slice(0, 100) }, 502);
    }
  },
};
