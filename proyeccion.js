/* Proyección estimada en la ficha de cada empresa (30 a 720 días). NO es una predicción ni un consejo de inversión:
   es una cuenta transparente con datos, y la página lo dice siempre. La cuenta, para cada plazo:
   - Pasado de la empresa: el retorno de todos sus tramos de ese largo en 5 años (acciones.mjs -> escenarios). Las noticias
     de tus resúmenes de los últimos 30 días mueven el percentil que se toma (regla fija, de 40 a 60).
   - Mercado: la mediana del S&P 500 en tramos del mismo largo (para no copiar una racha excepcional de una sola empresa).
   - Analistas: el precio objetivo promedio a 12 meses (Yahoo Finance), llevado al plazo.
   Central = promedio de los que haya. Pesimista y optimista = central más la dispersión histórica de la empresa (percentiles 10 y 90). */
(() => {
  const P = window.Pulso; if (!P) return;
  const { el, svg, num, pct, fechaCorta, tono } = P;
  const PLAZOS = [30, 60, 90, 180, 360, 720];
  const DIA = 864e5;

  function enPercentil(e, p) { // interpola entre los percentiles guardados
    const pts = [[10, e.p10], [25, e.p25], [50, e.p50], [75, e.p75], [90, e.p90]];
    for (let i = 1; i < pts.length; i++) if (p <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (p - x0) / (x1 - x0); }
    return e.p90;
  }
  function noticias(a) { // tono de las menciones de la empresa en los resúmenes de los últimos 30 días
    const d = P.datos(); if (!d.length) return { pos: 0, neg: 0, total: 0, s: 0 };
    const desde = new Date(Date.parse(d[0].fecha + 'T12:00:00') - 30 * DIA).toISOString().slice(0, 10);
    let pos = 0, neg = 0, total = 0;
    for (const { r, n } of P.menciones(a)) if (r.fecha >= desde) { total++; const t = tono(n.tono); if (t === 'positivo') pos++; else if (t === 'negativo') neg++; }
    return { pos, neg, total, s: (pos - neg) / (pos + neg + 2) }; // +2: con pocas noticias el ajuste es chico
  }
  // Exportada para poder probarla desde la consola: Pulso.proyectar(a)
  function proyectar(a) {
    const E = a.escenarios, M = P.acc()?.indices?.sp500?.escenarios, AN = window.EMPRESAS?.porTicker?.[a.ticker]?.analistas;
    if (!E || !a.precio) return null;
    const nt = noticias(a), pCentral = 50 + 10 * nt.s;
    const filas = PLAZOS.map(h => {
      const e = E[h]; if (!e) return null;
      const hist = enPercentil(e, pCentral), mkt = M?.[h]?.p50 ?? null;
      const anal = AN?.media > 0 ? ((AN.media / a.precio) ** (h / 365) - 1) * 100 : null;
      const partes = [hist, mkt, anal].filter(Number.isFinite), central = partes.reduce((s, v) => s + v, 0) / partes.length;
      const piso = v => Math.max(v, -95); // una acción no puede perder más del 100%
      const r = { h, central, pes: piso(central + e.p10 - e.p50), opt: central + e.p90 - e.p50,
        q25: piso(central + e.p25 - e.p50), q75: central + e.p75 - e.p50, hist, mkt, anal, independientes: e.independientes };
      for (const k of ['central', 'pes', 'opt', 'q25', 'q75']) r[k + 'Precio'] = a.precio * (1 + r[k] / 100);
      return r;
    }).filter(Boolean);
    return { filas, nt, pCentral, AN };
  }
  P.proyectar = proyectar;

  function grafico(a, pr) {
    const W = 720, H = 260, L = 56, R = 14, T = 14, B = 30;
    const hoy = Date.parse(a.fechas.at(-1) + 'T12:00:00'), x0 = Date.parse(a.fechas[0] + 'T12:00:00'), x1 = hoy + 720 * DIA;
    const AN = pr.AN, vals = [...a.cierres, ...pr.filas.flatMap(f => [f.pesPrecio, f.optPrecio]), ...(AN ? [AN.baja, AN.alta] : [])].filter(v => v > 0);
    const lmin = Math.log(Math.min(...vals) * .95), lmax = Math.log(Math.max(...vals) * 1.05);
    const X = t => L + (t - x0) / (x1 - x0) * (W - L - R), Y = v => T + (lmax - Math.log(v)) / (lmax - lmin) * (H - T - B);
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'proy-graf', role: 'img',
      'aria-label': `Precio de ${a.ticker} en el último año y proyección estimada hasta 720 días. Los valores están en la tabla de abajo.` });
    for (let i = 0; i <= 4; i++) { // escala logarítmica: igual distancia = igual porcentaje
      const v = Math.exp(lmin + (lmax - lmin) * i / 4), y = Y(v);
      s.append(svg('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'proy-grilla' }));
      const t = svg('text', { x: L - 6, y: y + 4, class: 'proy-eje', 'text-anchor': 'end' }); t.textContent = num(v, v < 100 ? 2 : 0); s.append(t);
    }
    const futuro = [{ t: hoy, f: null }, ...pr.filas.map(f => ({ t: hoy + f.h * DIA, f }))];
    const pt = (k) => futuro.map(({ t, f }) => `${X(t).toFixed(1)},${Y(f ? f[k] : a.precio).toFixed(1)}`);
    const banda = (alto, bajo, cls) => s.append(svg('polygon', { points: [...pt(alto), ...pt(bajo).reverse()].join(' '), class: cls }));
    banda('optPrecio', 'pesPrecio', 'proy-banda'); banda('q75Precio', 'q25Precio', 'proy-banda fuerte');
    s.append(svg('polyline', { points: a.fechas.map((f, i) => `${X(Date.parse(f + 'T12:00:00')).toFixed(1)},${Y(a.cierres[i]).toFixed(1)}`).join(' '), class: 'proy-real' }));
    s.append(svg('polyline', { points: pt('centralPrecio').join(' '), class: 'proy-central' }));
    s.append(svg('line', { x1: X(hoy), x2: X(hoy), y1: T, y2: H - B, class: 'proy-hoy' }));
    const th = svg('text', { x: X(hoy), y: H - B + 18, class: 'proy-eje', 'text-anchor': 'middle' }); th.textContent = 'hoy'; s.append(th);
    for (const f of pr.filas) {
      const c = svg('circle', { cx: X(hoy + f.h * DIA), cy: Y(f.centralPrecio), r: 3.5, class: 'proy-punto' });
      const ti = svg('title'); ti.textContent = `${f.h} días: central ${num(f.centralPrecio)} USD (${num(f.pesPrecio)} a ${num(f.optPrecio)})`; c.append(ti); s.append(c);
      if (f.h >= 90) { const t = svg('text', { x: X(hoy + f.h * DIA), y: H - B + 18, class: 'proy-eje', 'text-anchor': 'middle' }); t.textContent = f.h + 'd'; s.append(t); }
    }
    if (AN?.baja && AN?.alta) { // opinión de los analistas a 12 meses, aparte de nuestra cuenta
      const xa = X(hoy + 365 * DIA);
      s.append(svg('line', { x1: xa, x2: xa, y1: Y(AN.alta), y2: Y(AN.baja), class: 'proy-analistas' }));
      const d = svg('rect', { x: xa - 4, y: Y(AN.media) - 4, width: 8, height: 8, class: 'proy-analistas-media' });
      const ti = svg('title'); ti.textContent = `Analistas, 12 meses: promedio ${num(AN.media)} USD (de ${num(AN.baja)} a ${num(AN.alta)})`; d.append(ti); s.append(d);
    }
    return s;
  }

  P.seccionesEmpresa.push(a => {
    const pr = proyectar(a); if (!pr || !pr.filas.length) return null;
    const { nt, AN } = pr, emp = window.EMPRESAS?.porTicker?.[a.ticker];
    const base = Date.parse(a.fechas.at(-1) + 'T12:00:00');
    const celda = (precio, r) => el('td', {}, el('b', {}, num(precio)), el('small', { class: r > 0 ? 'sube' : r < 0 ? 'baja' : null }, pct(r, 1)));
    const confianza = n => n >= 20 ? 'media' : n >= 5 ? 'baja' : 'muy baja';
    return el('section', { class: 'proyeccion', 'aria-label': 'Proyección estimada' },
      el('h4', {}, 'Proyección estimada'),
      el('p', { class: 'aviso-proy', role: 'note' }, el('b', {}, 'Es una proyección estimada, no algo real ni un consejo de inversión: solo datos. '),
        'Nadie sabe cuánto va a valer una acción. Es una cuenta con el pasado de la empresa y del mercado, la opinión publicada de los analistas y el tono de tus noticias; el precio real puede quedar fuera de estos rangos.'),
      grafico(a, pr),
      el('div', { class: 'proy-ley', 'aria-hidden': 'true' },
        el('span', { class: 'l-real' }, 'Precio real'), el('span', { class: 'l-central' }, 'Escenario central'),
        el('span', { class: 'l-banda' }, 'Entre pesimista y optimista'), AN ? el('span', { class: 'l-anal' }, 'Analistas a 12 meses') : null),
      el('div', { class: 'tabla-scroll' }, el('table', { class: 'proy-tabla' },
        el('thead', {}, el('tr', {}, ['Plazo', 'Hacia el', 'Pesimista', 'Central', 'Optimista', 'Confianza'].map(t => el('th', { scope: 'col' }, t)))),
        el('tbody', {}, pr.filas.map(f => el('tr', {},
          el('th', { scope: 'row' }, `${f.h} días`), el('td', {}, fechaCorta(new Date(base + f.h * DIA).toISOString().slice(0, 10), true)),
          celda(f.pesPrecio, f.pes), celda(f.centralPrecio, f.central), celda(f.optPrecio, f.opt),
          el('td', { title: `${f.independientes} tramos de ${f.h} días que no se pisan en 5 años de historia` }, confianza(f.independientes))))))),
      el('details', { class: 'proy-como' }, el('summary', {}, 'Cómo se calcula'),
        el('ul', {},
          el('li', {}, el('b', {}, 'Pasado de la empresa: '), 'cuánto rindió en todos sus tramos del mismo largo de los últimos 5 años (Yahoo Finance, cierres diarios).'),
          el('li', {}, el('b', {}, 'Noticias: '), nt.total ? `en los últimos 30 días salió ${nt.total} ${nt.total === 1 ? 'vez' : 'veces'} en tus resúmenes (${nt.pos} positivas, ${nt.neg} negativas). Por regla fija eso mueve el escenario del pasado al percentil ${num(pr.pCentral, 0)} (sin noticias sería el 50; como máximo va de 40 a 60).`
            : 'no salió en tus resúmenes de los últimos 30 días: no hay ajuste. Se recalcula sola cada vez que llega un resumen nuevo.'),
          el('li', {}, el('b', {}, 'Mercado: '), 'la mediana del S&P 500 en tramos del mismo largo, para no copiar una racha excepcional de una sola empresa.'),
          el('li', {}, el('b', {}, 'Analistas: '), AN ? `precio objetivo promedio a 12 meses de ${AN.cantidad} analistas: ${num(AN.media)} USD (de ${num(AN.baja)} a ${num(AN.alta)}), según Yahoo Finance${emp?.yahooFecha ? ', ' + fechaCorta(emp.yahooFecha.slice(0, 10), true) : ''}. Es su opinión publicada; para otros plazos se lleva proporcionalmente, y a 720 días es una extrapolación.`
            : 'sin precio objetivo disponible para esta empresa: se usan las otras dos partes.'),
          el('li', {}, el('b', {}, 'Central: '), 'el promedio de las partes disponibles. ', el('b', {}, 'Pesimista y optimista: '), 'el central más lo que se apartaron los peores y mejores tramos de la empresa (percentiles 10 y 90): en el pasado, 8 de cada 10 tramos quedaron entre esos dos.'),
          el('li', {}, el('b', {}, 'Confianza: '), 'cuántos tramos que no se pisan entran en 5 años. A 360 y 720 días son muy pocos: tomalo con mucha cautela.')),
        el('p', { class: 'nota' }, `A ${pr.filas.at(-1).h} días, por partes: pasado ${pct(pr.filas.at(-1).hist, 1)}, mercado ${pct(pr.filas.at(-1).mkt, 1)}, analistas ${pct(pr.filas.at(-1).anal, 1)}.`)),
      el('p', { class: 'nota' }, 'Se recalcula sola con cada actualización de precios y con cada resumen de noticias nuevo.'));
  });
})();
