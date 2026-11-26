// Comparador de hasta 5 activos (empresas o índices) con datos reales: gráfico normalizado a 100, métricas del
// período y correlaciones. Las series se alinean por fecha tomando el último cierre conocido de cada activo.
(() => {
  'use strict';
  const P = window.Pulso; if (!P) return;
  const { el, svg, num, pct, clase, fechaCorta } = P;
  const $ = id => document.getElementById(id);
  const COLORES = ['#4FE3C1', '#F5C451', '#FF6B8B', '#A78BFA', '#60A5FA'];
  const PERIODOS = [['1M', 21], ['3M', 63], ['6M', 126], ['1A', 252], ['5A', 0]];
  const INDICES = ['sp500', 'dow', 'nasdaq', 'nasdaq100', 'russell', 'vix', 'bono10', 'wti', 'dolar'];
  let sel = P.leer('comparar', ['sp500', 'AAPL', 'MSFT']), periodo = P.leer('compararPeriodo', '1A');
  if (!PERIODOS.some(p => p[0] === periodo)) periodo = '1A';

  const media = a => a.reduce((s, v) => s + v, 0) / a.length;
  const desvio = a => { const m = media(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
  const corr = (a, b) => { const ma = media(a), mb = media(b); let s = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } return sa && sb ? s / Math.sqrt(sa * sb) : null; };
  const caida = c => { let p = c[0], w = 0; for (const v of c) { p = Math.max(p, v); w = Math.max(w, (p - v) / p); } return w * 100; };

  function activo(id) {
    const A = P.acc(); if (!A) return null;
    if (INDICES.includes(id) && A.indices?.[id]) return { id, tipo: 'Índice', ...A.indices[id] };
    const a = A.lista.find(x => x.ticker === id);
    return a ? { id, tipo: a.sector, ...a } : null;
  }
  function tramo(x) { // los cierres del período elegido; 5 años usa la serie semanal
    const sem = periodo === '5A', s = sem ? x.semanal : x; if (!s?.cierres?.length) return null;
    const n = sem ? s.cierres.length : Math.min(s.cierres.length, PERIODOS.find(p => p[0] === periodo)[1] + 1);
    return { fechas: s.fechas.slice(-n), cierres: s.cierres.slice(-n), sem };
  }
  function agregar(id) {
    if (sel.includes(id)) return P.aviso(`${id} ya está en el comparador`);
    if (sel.length >= 5) return P.aviso('El comparador admite hasta 5 activos. Quitá uno primero.');
    sel.push(id); P.guardar('comparar', sel); render();
  }
  function quitar(id) { sel = sel.filter(x => x !== id); P.guardar('comparar', sel); render(); }

  function render() {
    const cont = $('comparador'); if (!cont) return;
    const A = P.acc();
    if (!A?.lista?.length) { cont.replaceChildren(el('p', { class: 'vacio' }, 'Faltan datos de mercado.')); return; }
    sel = sel.filter(id => activo(id)).slice(0, 5);
    const opciones = new Map([...INDICES.filter(k => A.indices?.[k]).map(k => [`${A.indices[k].nombre} (índice)`, k]), ...A.lista.map(a => [`${a.ticker}: ${a.nombre}`, a.ticker])]);
    const entrada = el('input', { class: 'buscar', type: 'search', list: 'compararOpciones', placeholder: 'Agregar empresa o índice', 'aria-label': 'Agregar empresa o índice al comparador' });
    const elegirOpcion = () => {
      const v = entrada.value.trim(), id = opciones.get(v) || (activo(v.toUpperCase()) ? v.toUpperCase() : null);
      if (id) { entrada.value = ''; agregar(id); }
    };
    entrada.onchange = elegirOpcion;
    entrada.onkeydown = e => { if (e.key === 'Enter') elegirOpcion(); };
    const controles = el('div', { class: 'controles' }, entrada,
      el('datalist', { id: 'compararOpciones' }, [...opciones.keys()].map(k => el('option', { value: k }))),
      el('div', { class: 'segmento', role: 'group', 'aria-label': 'Período' }, PERIODOS.map(([k]) => el('button', { 'aria-pressed': String(k === periodo), onclick: () => { periodo = k; P.guardar('compararPeriodo', k); render(); } }, k))));
    const elegidos = el('div', { class: 'cmp-elegidos' }, sel.map((id, i) => {
      const x = activo(id);
      return el('span', { class: 'cmp-chip', style: `--c:${COLORES[i]}` }, el('i', { 'aria-hidden': 'true' }), `${id === x.ticker ? id : x.nombre}`,
        el('button', { 'aria-label': `Quitar ${x.nombre} del comparador`, onclick: () => quitar(id) }, '×'));
    }));
    if (sel.length < 2) { cont.replaceChildren(controles, elegidos, el('p', { class: 'vacio' }, 'Elegí al menos 2 activos para comparar.')); return; }

    const activos = sel.map(activo), tramos = activos.map(tramo);
    if (tramos.some(t => !t)) { cont.replaceChildren(controles, elegidos, el('p', { class: 'vacio' }, 'Algún activo no tiene datos para este período.')); return; }
    const base = tramos.reduce((m, t) => t.fechas.length > m.length ? t.fechas : m, []);
    const series = tramos.map(t => { let j = 0, v = null; return base.map(f => { while (j < t.fechas.length && t.fechas[j] <= f) v = t.cierres[j++]; return v; }); });
    let k0 = 0; while (k0 < base.length && series.some(s => s[k0] == null)) k0++;
    const fechas = base.slice(k0), alin = series.map(s => s.slice(k0));
    if (fechas.length < 3) { cont.replaceChildren(controles, elegidos, el('p', { class: 'vacio' }, 'No hay suficientes fechas en común para comparar en este período.')); return; }
    const norm = alin.map(c => c.map(v => v / c[0] * 100));
    const anual = tramos[0].sem ? 52 : 252;

    // gráfico normalizado
    const lienzo = el('div', { class: 'lienzo' }), tip = el('div', { class: 'tip', hidden: true, 'aria-live': 'polite' });
    const dibujar = () => {
      const ancho = lienzo.clientWidth; if (!ancho) return;
      const W = 800, H = ancho < 560 ? 480 : 300, Pd = 10, N = fechas.length, todos = norm.flat(), min = Math.min(...todos, 100), max = Math.max(...todos, 100);
      const x = i => Pd + i / (N - 1) * (W - 2 * Pd), y = v => H - Pd - (v - min) / (max - min || 1) * (H - 2 * Pd);
      const sv = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0', 'aria-label': `Comparación normalizada desde el ${fechaCorta(fechas[0], true)}: ` + activos.map((a, i) => `${a.ticker || a.nombre} ${pct(norm[i].at(-1) - 100, 1)}`).join(', ') });
      sv.append(svg('line', { x1: Pd, x2: W - Pd, y1: y(100), y2: y(100), stroke: '#8E9AD0', 'stroke-opacity': .5, 'stroke-dasharray': '4 5', 'vector-effect': 'non-scaling-stroke' }));
      norm.forEach((c, i) => sv.append(svg('path', { d: c.map((v, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(''), fill: 'none', stroke: COLORES[i], 'stroke-width': 2, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' })));
      const guia = svg('line', { y1: Pd, y2: H - Pd, stroke: '#E4EAFF', 'stroke-opacity': .45, 'stroke-dasharray': '3 4', 'vector-effect': 'non-scaling-stroke', visibility: 'hidden' });
      sv.append(guia);
      let cursor = N - 1;
      const ver = i => {
        cursor = i; guia.setAttribute('x1', x(i)); guia.setAttribute('x2', x(i)); guia.setAttribute('visibility', 'visible');
        tip.replaceChildren(el('small', {}, fechaCorta(fechas[i], true)), ...activos.map((a, k) => el('div', { class: 'tip-fila' }, el('i', { style: `background:${COLORES[k]}` }), `${a.ticker || a.nombre} ${pct(norm[k][i] - 100, 1)}`)));
        tip.hidden = false; tip.style.left = Math.max(90, Math.min(ancho - 90, x(i) / W * ancho)) + 'px'; tip.style.top = '40px';
      };
      sv.addEventListener('pointermove', e => { const r = sv.getBoundingClientRect(); ver(Math.max(0, Math.min(N - 1, Math.round(((e.clientX - r.left) / r.width * W - Pd) / (W - 2 * Pd) * (N - 1))))); });
      sv.addEventListener('pointerleave', () => { tip.hidden = true; guia.setAttribute('visibility', 'hidden'); });
      sv.addEventListener('keydown', e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); ver(Math.max(0, Math.min(N - 1, cursor + (e.key === 'ArrowLeft' ? -1 : 1)))); });
      sv.addEventListener('blur', () => { tip.hidden = true; guia.setAttribute('visibility', 'hidden'); });
      lienzo.replaceChildren(sv, tip);
    };

    // métricas del período, con cada activo sobre sus propios cierres del tramo
    const filas = activos.map((a, i) => {
      const c = tramos[i].cierres, lr = c.slice(1).map((v, k) => Math.log(v / c[k]));
      return el('tr', {}, el('td', {}, el('i', { class: 'cmp-color', style: `background:${COLORES[i]}` }), a.ticker ? el('button', { class: 'enlace', onclick: () => P.elegirEmpresa(a.ticker) }, a.ticker) : a.nombre),
        el('td', {}, a.tipo),
        el('td', { class: 'num ' + clase(c.at(-1) - c[0]) }, pct((c.at(-1) / c[0] - 1) * 100, 1)),
        el('td', { class: 'num' }, lr.length > 2 ? num(desvio(lr) * Math.sqrt(anual) * 100, 1) + '%' : 'sin dato'),
        el('td', { class: 'num baja' }, '−' + num(caida(c), 1) + '%'),
        el('td', { class: 'num' }, a.volProm20 ? Number(a.volProm20).toLocaleString('es-AR') : 'sin dato'),
        el('td', { class: 'num' }, a.rsi != null ? num(a.rsi, 1) : 'sin dato'),
        el('td', { class: 'num ' + clase(a.macd?.hist) }, a.macd ? (a.macd.hist >= 0 ? 'arriba' : 'abajo') + ' de la señal' : 'sin dato'),
        el('td', { class: 'num' }, a.bollinger ? num(a.bollinger.pctB) : 'sin dato'),
        el('td', { class: 'num ' + clase(a.sma?.[200] ? a.precio - a.sma[200] : null) }, a.sma?.[200] ? pct((a.precio / a.sma[200] - 1) * 100, 1) : 'sin dato'),
        el('td', { class: 'num' }, a.volHist20 != null ? num(a.volHist20, 1) + '%' : 'sin dato'),
        el('td', { class: 'num' }, a.sharpe != null ? num(a.sharpe) : 'sin dato'),
        el('td', { class: 'num' }, a.beta != null ? num(a.beta) : 'sin dato'));
    });
    const rets = alin.map(c => c.slice(1).map((v, k) => v / c[k] - 1));
    const matriz = el('table', { class: 'cmp-corr' }, el('thead', {}, el('tr', {}, el('th', {}, ''), activos.map(a => el('th', { class: 'num' }, a.ticker || a.nombre)))),
      el('tbody', {}, activos.map((a, i) => el('tr', {}, el('th', {}, a.ticker || a.nombre), activos.map((b, j) => {
        const r = i === j ? 1 : corr(rets[i], rets[j]);
        return el('td', { class: 'num', style: r == null ? '' : `background:color-mix(in oklab, ${r >= 0 ? '#4FE3C1' : '#FF6B8B'} ${Math.round(Math.abs(r) * 45)}%, transparent)` }, r == null ? '—' : num(r));
      })))));

    cont.replaceChildren(controles, elegidos,
      el('div', { class: 'tarjeta' }, lienzo, el('p', { class: 'nota' }, `Base 100 el ${fechaCorta(fechas[0], true)}. ${tramos[0].sem ? 'Cierres semanales.' : 'Cierres diarios.'} Fuente: Yahoo Finance.`)),
      el('h3', { class: 'cmp-titulo' }, 'Métricas del período'),
      el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel' },
        el('thead', {}, el('tr', {}, ['Activo', 'Sector o tipo', 'Rendimiento', 'Volatilidad anualizada', 'Peor caída', 'Volumen prom. 20 ruedas', 'RSI (14) hoy', 'MACD hoy', 'Bollinger %B', 'Contra su media de 200', 'Volatilidad 20 ruedas', 'Sharpe (1 año)', 'Beta (1 año)'].map((h, i) => el('th', { class: i > 1 ? 'num' : null }, h)))),
        el('tbody', {}, filas))),
      el('p', { class: 'nota' }, 'Rendimiento, volatilidad y peor caída son del período elegido; los indicadores técnicos, beta y Sharpe son de hoy (las explicaciones están en la ficha de cada empresa).'),
      el('h3', { class: 'cmp-titulo' }, 'Correlación de los rendimientos del período'),
      el('p', { class: 'nota' }, 'De −1 a 1: cuánto se movieron juntos. Cerca de 1, casi siempre en la misma dirección; cerca de 0, sin relación; negativa, en direcciones opuestas.'),
      el('div', { class: 'tabla-wrap' }, matriz));
    cont._ro?.disconnect();
    let ultimo = 0;
    cont._ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w && w !== ultimo) { ultimo = w; requestAnimationFrame(dibujar); } });
    cont._ro.observe(lienzo);
  }

  P.accionesEmpresa.push(a => el('button', { class: 'chip', onclick: () => { agregar(a.ticker); P.pestania('comparar'); } }, 'Comparar'));
  P.refrescarDetalle();
  P.alActualizar(render);
})();
