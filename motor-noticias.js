// Motor de noticias con reglas fijas (no depende de la IA que escribió el resumen):
// - puntaje de importancia 0-100 y urgencia de cada noticia, con criterios a la vista;
// - verificación de las cifras del resumen contra los datos reales de mercado (Yahoo Finance);
// - detección de cifras distintas para el mismo índice dentro de un mismo resumen.
(() => {
  'use strict';
  const P = window.Pulso; if (!P) return;
  const { el, num, pct, fechaCorta } = P;
  const $ = id => document.getElementById(id);
  const texto = n => [n.titulo, n.resumen, ...(n.afecta || [])].join(' ');
  const CATEGORIAS = [ // peso de base por tema: lo macro mueve a todo el mercado
    ['Fed y tasas', 30, /(^|\W)(Fed|Reserva Federal|tasas? de inter[eé]s|Powell|FOMC)(\W|$)/i],
    ['Inflación', 28, /(^|\W)(PCE|IPC|CPI|inflaci[oó]n)(\W|$)/i],
    ['Empleo', 25, /(^|\W)(empleo|desempleo|n[oó]minas|payrolls)(\W|$)/i],
    ['PIB', 22, /(^|\W)(PIB|PBI|GDP|recesi[oó]n)(\W|$)/i],
    ['Geopolítica', 18, /(^|\W)(guerra|Ir[aá]n|Ormuz|China|aranceles?|sanciones|Rusia|Ucrania)(\W|$)/i],
    ['Resultados', 15, /(^|\W)(resultados|balances?|ganancias|ingresos)(\W|$)/i]
  ];
  const AMPLIO = /(^|\W)(todo el mercado|S&P 500|Wall Street|Nasdaq|Dow)(\W|$)/i;
  const cacheMov = new Map();

  function categoria(n) { const t = texto(n); return CATEGORIAS.find(([, , rx]) => rx.test(t)) || ['Empresa o sector', 10]; }
  function movimientoMaximo(n, r) { // mayor movimiento del día entre las empresas seguidas que nombra la noticia
    const k = r.id + '|' + n.titulo; if (cacheMov.has(k)) return cacheMov.get(k);
    const A = P.acc(); let max = null;
    if (A) for (const a of A.lista) {
      if (!(a.claves || []).some(c => new RegExp(`(^|[^A-Za-z0-9ÁÉÍÓÚáéíóúñ])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9ÁÉÍÓÚáéíóúñ])`, c.length > 5 ? 'i' : '').test(texto(n)))) continue;
      const cd = P.cambioDia(a, r.fecha); if (cd != null && (max == null || Math.abs(cd) > Math.abs(max))) max = cd;
    }
    cacheMov.set(k, max); return max;
  }
  // Puntaje 0-100: tema (hasta 30) + alcance (hasta 27) + fuentes que lo confirman (hasta 12) + tono definido (5)
  // + señal de volatilidad (10) + movimiento real de 3% o más en una empresa nombrada (10) + importancia que dio el resumen (hasta 10)
  P.puntaje = (n, r) => {
    let s = categoria(n)[1];
    if (AMPLIO.test(texto(n))) s += 15;
    s += Math.min((n.afecta || []).length * 3, 12);
    const f = (n.fuentes || []).length; s += f >= 3 ? 12 : f === 2 ? 8 : 0;
    if (n.tono === 'positivo' || n.tono === 'negativo') s += 5;
    if (n.volatilidad === true) s += 10;
    const mov = r ? movimientoMaximo(n, r) : null; if (mov != null && Math.abs(mov) >= 3) s += 10;
    s += { alta: 10, media: 5 }[n.importancia] || 0;
    return Math.min(100, s);
  };
  // Urgencia: solo para el resumen más nuevo; depende de hace cuánto se publicó (hora de NY de la noticia o del resumen)
  P.urgencia = (n, r) => {
    const D = P.datos(); if (!r || r !== D[0]) return null;
    const horas = (Date.now() - new Date(`${r.fecha}T${r.hora}:00`).getTime()) / 36e5;
    return horas <= 3 ? 'alta' : horas <= 12 ? 'media' : 'baja';
  };

  // ---- verificación de cifras ----
  const TERMINOS = { 'S&P 500': /S&P\s*500/i, 'Dow Jones': /(^|\W)Dow(\W|$)/i, 'Nasdaq': /Nasdaq(?!\s*100)/i, 'Petróleo WTI': /(^|\W)(WTI|petr[oó]leo)(\W|$)/i };
  const CLAVE = { 'S&P 500': 'sp500', 'Dow Jones': 'dow', 'Nasdaq': 'nasdaq', 'Petróleo WTI': 'wti', 'Dólar (DXY)': 'dolar' };
  function cifrasEnTexto(r) { // porcentaje pegado al índice: hasta 30 caracteres después y sin cruzar el fin de la oración
    const out = {}, textos = [...(r.enSegundos || []), ...(r.noticias || []).map(n => n.titulo + '. ' + (n.resumen || ''))];
    const OTRO_PERIODO = /semana|semanal|mes(es)?\b|mensual|año|anual|racha|en lo que va|desde (el|su)|acumul/i; // solo cifras del día
    const oraciones = textos.flatMap(t => t.split(/(?<=[.;])\s+/)).filter(o => !OTRO_PERIODO.test(o));
    for (const t of oraciones) for (const [nombre, rx] of Object.entries(TERMINOS)) {
      const m = rx.exec(t); if (!m) continue;
      // el número tiene que estar pegado al índice ("el Nasdaq 1,5%") o después de un verbo de movimiento ("cayó 3,7%")
      const resto = t.slice(m.index + m[0].length).split(/[.;:]\s/)[0];
      const p = /^\s*(?:(?:subi[oó]|baj[oó]|cay[oó]|gan[oó]|perdi[oó]|avanz[oó]|retrocedi[oó]|cedi[oó]|trep[oó]|se hundi[oó]|termin[oó]|cerr[oó]|sube|baja|cae|gana|pierde|avanza|retrocede)\s+(?:un\s+)?)?[+−-]?(\d+(?:,\d+)?)\s?%/i.exec(resto), tramo = m[0] + resto.slice(0, 30);
      if (p) (out[nombre] ??= []).push({ v: parseFloat(p[1].replace(',', '.')), t: tramo.trim() });
    }
    return out;
  }
  P.verificar = r => {
    const avisos = [], ok = [];
    for (const x of r.indices || []) { // tabla de índices del resumen contra Yahoo
      const k = CLAVE[x.nombre], b = k && P.barraEn(k, r); if (!b || x.cambioPct == null) continue;
      const dif = Math.abs(x.cambioPct - b.cambio);
      (dif > .3 ? avisos : ok).push(dif > .3 ? `${x.nombre}: el resumen dice ${pct(x.cambioPct)}, Yahoo Finance da ${pct(b.cambio)} para la rueda del ${fechaCorta(b.s.fechas[b.i])}. La página muestra el dato de Yahoo.${k === 'wti' ? ' En el petróleo es común: Yahoo usa el contrato de futuros más cercano y su cierre puede ser a otra hora que el de las notas.' : ''}` : x.nombre);
    }
    for (const [nombre, vs] of Object.entries(cifrasEnTexto(r))) { // mismo índice con cifras distintas dentro del resumen
      const distintos = [...new Set(vs.map(v => v.v))];
      if (distintos.length > 1 && Math.max(...distintos) - Math.min(...distintos) > .3) avisos.push(`${nombre} aparece con cifras distintas en el resumen: ${distintos.map(v => num(v)).join('% y ')}%. Puede ser otro momento del día u otro contrato.`);
    }
    return { avisos, ok };
  };

  P.alMostrar(r => {
    const caja = $('verificacion'); if (!caja) return;
    const { avisos, ok } = P.verificar(r);
    if (!avisos.length && !ok.length) { caja.replaceChildren(); return; }
    caja.replaceChildren(el('div', { class: 'verificacion ' + (avisos.length ? 'con-avisos' : 'sin-avisos') },
      el('b', {}, avisos.length ? `Verificación de cifras: ${avisos.length} ${avisos.length === 1 ? 'diferencia' : 'diferencias'} con los datos de mercado` : 'Verificación de cifras: todo coincide con los datos de mercado'),
      avisos.length ? el('ul', {}, avisos.map(a => el('li', {}, a))) : el('p', { class: 'nota' }, `Coinciden con Yahoo Finance: ${ok.join(', ')}.`),
      el('details', {}, el('summary', {}, 'Cómo se calculan el puntaje y la urgencia de cada noticia'),
        el('p', { class: 'nota' }, 'Puntaje de 0 a 100, con reglas fijas: tema (Fed y tasas 30, inflación 28, empleo 25, PIB 22, geopolítica 18, resultados 15, empresa o sector 10), más 15 si afecta a todo el mercado, 3 por cada sector o empresa afectada (hasta 12), 8 si la confirman 2 fuentes y 12 si son 3 o más, 5 si el tono es claro, 10 si es de las que suelen mover el mercado, 10 si una empresa nombrada se movió 3% o más ese día, y hasta 10 por la importancia que le dio el resumen. Urgencia, solo en el resumen más nuevo: alta hasta 3 horas después, media hasta 12, baja después.'))));
  });
})();
