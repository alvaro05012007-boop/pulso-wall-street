// Los últimos 5 años del mercado, con precios reales (Yahoo Finance): resumen, rendimiento por año y por mes,
// grandes caídas y recuperaciones, días extremos, sectores año por año, empresas y volatilidad.
// Los resúmenes de noticias existen recién desde octubre de 2026: lo anterior se cuenta con los precios.
(() => {
  'use strict';
  const P = window.Pulso; if (!P) return;
  const { el, num, pct, clase, fechaCorta } = P;
  const $ = id => document.getElementById(id);
  const IDX = [['sp500', 'S&P 500'], ['nasdaq', 'Nasdaq Composite'], ['nasdaq100', 'Nasdaq 100'], ['dow', 'Dow Jones'], ['russell', 'Russell 2000']];
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  let elegido = P.leer('historiaIndice', 'sp500');
  const color = (v, tope = 10) => v == null ? '' : `background:color-mix(in oklab, ${v >= 0 ? P.COLOR.positivo : P.COLOR.negativo} ${Math.round(Math.min(Math.abs(v) / tope, 1) * 60)}%, transparent)`;
  const meses = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / (30.44 * 864e5)));
  const largo = iso => P.fechaCorta(iso, true);

  function render() {
    const cont = $('historia5'); if (!cont) return;
    const A = P.acc(), I = A?.indices || {};
    if (!I.sp500?.historia) { cont.replaceChildren(el('p', { class: 'vacio' }, 'Faltan los datos de 5 años: se cargan con la próxima actualización de precios.')); return; }
    const s = I[elegido]?.historia ? I[elegido] : I.sp500, h = s.historia, nombre = (IDX.find(([k]) => k === (I[elegido] ? elegido : 'sp500')) || [, 'S&P 500'])[1];
    const anios = [...new Set(IDX.flatMap(([k]) => (I[k]?.historia?.anual || []).map(y => y.anio)))].sort();
    const completos = h.anual.filter(y => !y.parcial), mejor = [...completos].sort((a, b) => b.ret - a.ret)[0], peor = [...completos].sort((a, b) => a.ret - b.ret)[0];
    const peorCaida = [...(h.caidas || [])].sort((a, b) => a.caida - b.caida)[0];
    const vix = I.vix?.semanal, vMax = vix ? vix.cierres.reduce((m, v, i) => v > m.v ? { v, f: vix.fechas[i] } : m, { v: -1 }) : null;
    const semanas30 = vix ? vix.cierres.filter(v => v >= 30).length : 0;
    const sectores = Object.entries(A.sectores || {});
    const sec5 = sectores.map(([n, x]) => [n, x.anual.reduce((acc, y) => acc * (1 + y.ret / 100), 1) - 1, x.anual.length]).filter(x => x[2]).sort((a, b) => b[1] - a[1]);
    const empresas = A.lista.filter(a => a.ret?.a5 != null).sort((a, b) => b.ret.a5 - a.ret.a5);

    // 1. Resumen de los 5 años, solo con datos medidos
    const resumen = el('section', { class: 'bloque' }, el('h2', {}, 'Resumen de los últimos 5 años'),
      el('p', { class: 'explica' }, `Con los cierres diarios reales de Yahoo Finance desde el ${largo(s.desde)}. Los resúmenes de noticias de esta página existen recién desde octubre de 2026, así que lo anterior se cuenta con los precios.`),
      el('div', { class: 'stats' },
        P.stat(`${nombre} en 5 años`, s.ret?.a5 != null ? pct(s.ret.a5, 1) : pct((h.anual.reduce((acc, y) => acc * (1 + y.ret / 100), 1) - 1) * 100, 1), `de ${num(s.semanal.cierres[0])} a ${num(s.precio)}`, clase(s.ret?.a5)),
        mejor ? P.stat('Mejor año completo', `${mejor.anio}: ${pct(mejor.ret, 1)}`, nombre, 'sube') : null,
        peor ? P.stat('Peor año completo', `${peor.anio}: ${pct(peor.ret, 1)}`, nombre, clase(peor.ret)) : null,
        peorCaida ? P.stat('Peor caída', pct(peorCaida.caida, 1), `${largo(peorCaida.desde)} al ${largo(peorCaida.piso)}`, 'baja') : null),
      el('ul', { class: 'informe' },
        peorCaida ? P.el('li', {}, el('span', { class: 'origen o-dato' }, 'Dato'), el('span', {}, `La peor caída del ${nombre} fue de ${pct(peorCaida.caida, 1)}: del máximo del ${largo(peorCaida.desde)} al piso del ${largo(peorCaida.piso)}. ${peorCaida.recuperado ? `Recuperó ese máximo el ${largo(peorCaida.recuperado)}, ${meses(peorCaida.desde, peorCaida.recuperado)} meses después.` : 'Todavía no recuperó ese máximo.'}`)) : null,
        sec5.length ? P.el('li', {}, el('span', { class: 'origen o-dato' }, 'Dato'), el('span', {}, `Sumando los años completos, el sector que más subió fue ${sec5[0][0]} (${pct(sec5[0][1] * 100, 0)}) y el que menos, ${sec5.at(-1)[0]} (${pct(sec5.at(-1)[1] * 100, 0)}). Promedio simple de las empresas seguidas de cada sector.`)) : null,
        vMax ? P.el('li', {}, el('span', { class: 'origen o-dato' }, 'Dato'), el('span', {}, `El VIX (volatilidad esperada) llegó a ${num(vMax.v, 1)} la semana del ${largo(vMax.f)} y cerró ${semanas30} semanas en 30 o más (zona de miedo).`)) : null,
        empresas.length ? P.el('li', {}, el('span', { class: 'origen o-dato' }, 'Dato'), el('span', {}, `Entre las 100 empresas seguidas, la que más subió en 5 años fue ${empresas[0].ticker} (${pct(empresas[0].ret.a5, 0)}) y la que más bajó, ${empresas.at(-1).ticker} (${pct(empresas.at(-1).ret.a5, 0)}).`)) : null,
        P.el('li', {}, el('span', { class: 'origen o-interpretacion' }, 'Interpretación'), el('span', {}, 'Esto describe el pasado: un buen o mal período no anticipa el siguiente.'))));

    // 2. Rendimiento por año de cada índice
    const anual = el('section', { class: 'bloque' }, el('h2', {}, 'Rendimiento por año'),
      el('p', { class: 'explica' }, 'Cierre del último día del año contra el del año anterior. El primer año arranca en la primera fecha disponible y el año en curso va hasta hoy: los dos están marcados como parciales.'),
      el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel tabla-calor' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Índice'), anios.map(y => el('th', { class: 'num' }, y)))),
        el('tbody', {}, IDX.filter(([k]) => I[k]?.historia).map(([k, n]) => el('tr', {}, el('td', {}, n), anios.map(y => {
          const r = I[k].historia.anual.find(a => a.anio === y);
          return el('td', { class: 'num', style: r ? color(r.ret, 30) : '', title: r?.parcial ? 'año parcial' : null }, r ? pct(r.ret, 1) + (r.parcial ? '*' : '') : '—');
        })))))),
      el('p', { class: 'nota' }, '* Año parcial.'));

    // 3. Mapa de calor mensual del índice elegido
    const filas = {};
    for (const m of h.mensual) { const [y, mm] = m.mes.split('-'); (filas[y] ??= Array(12).fill(null))[+mm - 1] = m.ret; }
    const selector = el('div', { class: 'segmento', role: 'group', 'aria-label': 'Índice' }, IDX.filter(([k]) => I[k]?.historia).map(([k, n]) =>
      el('button', { 'aria-pressed': String(k === (I[elegido] ? elegido : 'sp500')), onclick: () => { elegido = k; P.guardar('historiaIndice', k); render(); } }, n)));
    const mensual = el('section', { class: 'bloque' }, el('h2', {}, `Mes por mes: ${nombre}`), selector,
      el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel tabla-calor mensual' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Año'), MES.map(m => el('th', { class: 'num' }, m)), el('th', { class: 'num' }, 'Año'))),
        el('tbody', {}, Object.keys(filas).sort().reverse().map(y => {
          const ra = h.anual.find(a => a.anio === y);
          return el('tr', {}, el('td', {}, y), filas[y].map((v, i) => el('td', { class: 'num', style: color(v, 8), title: v == null ? null : `${MES[i]} ${y}: ${pct(v, 1)}` }, v == null ? '' : pct(v, 1))),
            el('td', { class: 'num total', style: color(ra?.ret, 30) }, ra ? pct(ra.ret, 1) + (ra.parcial ? '*' : '') : ''));
        })))));

    // 4. Caídas y días extremos del índice elegido
    const caidas = el('section', { class: 'bloque' }, el('h2', {}, `Grandes caídas y recuperaciones: ${nombre}`),
      el('p', { class: 'explica' }, 'Cada vez que el índice cayó 10% o más desde un máximo: cuándo empezó, dónde tocó piso, cuánto cayó y cuándo volvió a ese máximo.'),
      (h.caidas || []).length ? el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel' },
        el('thead', {}, el('tr', {}, ['Desde el máximo del', 'Piso', 'Caída', 'Recuperó el máximo', 'Duración'].map((t, i) => el('th', { class: i === 2 || i === 4 ? 'num' : null }, t)))),
        el('tbody', {}, h.caidas.map(c => el('tr', {}, el('td', {}, largo(c.desde)), el('td', {}, largo(c.piso)), el('td', { class: 'num baja' }, pct(c.caida, 1)),
          el('td', {}, c.recuperado ? largo(c.recuperado) : 'todavía no'), el('td', { class: 'num' }, `${meses(c.desde, c.recuperado || new Date().toISOString())} meses${c.recuperado ? '' : ' y sigue'}`))))))
        : el('p', { class: 'nota' }, 'No tuvo caídas de 10% o más en el período.'),
      el('div', { class: 'grilla2' },
        el('div', {}, el('h3', {}, 'Días de mayor suba'), el('ol', { class: 'podio' }, (h.mejores || []).map(d => el('li', {}, el('span', {}, largo(d.fecha)), el('b', { class: 'sube' }, pct(d.ret)))))),
        el('div', {}, el('h3', {}, 'Días de mayor baja'), el('ol', { class: 'podio' }, (h.peores || []).map(d => el('li', {}, el('span', {}, largo(d.fecha)), el('b', { class: 'baja' }, pct(d.ret))))))));

    // 5. Sectores año por año
    const aniosSec = [...new Set(sectores.flatMap(([, x]) => x.anual.map(y => y.anio)))].sort();
    const secc = el('section', { class: 'bloque' }, el('h2', {}, 'Sectores año por año'),
      el('p', { class: 'explica' }, 'Promedio simple del rendimiento anual de las empresas seguidas de cada sector (solo años completos). Ordenados por lo que acumularon.'),
      el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel tabla-calor' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Sector'), aniosSec.map(y => el('th', { class: 'num' }, y)), el('th', { class: 'num' }, 'Acumulado'))),
        el('tbody', {}, sec5.map(([n, acum]) => { const x = A.sectores[n];
          return el('tr', {}, el('td', {}, n), aniosSec.map(y => { const r = x.anual.find(a => a.anio === y); return el('td', { class: 'num', style: r ? color(r.ret, 40) : '' }, r ? pct(r.ret, 1) : '—'); }),
            el('td', { class: 'num total ' + clase(acum) }, pct(acum * 100, 0)));
        })))));

    // 6. Empresas en 5 años
    const fila = a => el('li', {}, el('button', { class: 'enlace', onclick: () => P.elegirEmpresa(a.ticker) }, a.ticker), el('b', { class: clase(a.ret.a5) }, pct(a.ret.a5, 0)), el('small', {}, `peor caída ${pct(-a.caidaMax5a, 0)}`));
    const emp = el('section', { class: 'bloque' }, el('h2', {}, 'Empresas en 5 años'),
      el('p', { class: 'explica' }, `Variación del precio en los últimos 5 años de las ${empresas.length} empresas con 5 años de historia, con su peor caída en el período. No incluye dividendos.`),
      el('div', { class: 'grilla2' },
        el('div', {}, el('h3', {}, 'Las que más subieron'), el('ol', { class: 'podio' }, empresas.slice(0, 10).map(fila))),
        el('div', {}, el('h3', {}, 'Las que menos subieron o más bajaron'), el('ol', { class: 'podio' }, empresas.slice(-10).reverse().map(fila)))));

    cont.replaceChildren(resumen, anual, mensual, caidas, secc, emp);
  }
  P.alActualizar(render);
})();
