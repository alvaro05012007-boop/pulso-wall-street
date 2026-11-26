// Vista Terminal: todo el mercado en una pantalla, en paneles densos (índices, movimientos, sectores, volatilidad,
// noticias, anomalías, agenda y tu lista). Solo datos reales de acciones.js y de los resúmenes; cada panel lleva su fuente.
(() => {
  'use strict';
  const P = window.Pulso; if (!P) return;
  const { el, num, pct, clase, fechaCorta, tono, mini } = P;
  const $ = id => document.getElementById(id);
  const IDX = [['sp500', 'S&P 500'], ['dow', 'Dow Jones'], ['nasdaq', 'Nasdaq Comp.'], ['nasdaq100', 'Nasdaq 100'], ['russell', 'Russell 2000'],
    ['vix', 'VIX'], ['bono10', 'Bono 10 años'], ['tbill', 'Letra 13 sem.'], ['wti', 'Petróleo WTI'], ['dolar', 'Dólar DXY']];
  const IMP = { alta: 0, media: 1, baja: 2 };
  const panel = (titulo, fuente, ...cuerpo) => el('section', { class: 'tm-panel' }, el('header', {}, el('h3', {}, titulo), fuente ? el('span', {}, fuente) : null), ...cuerpo);
  const fila = (...celdas) => el('tr', {}, celdas);

  function render() {
    const cont = $('terminal'); if (!cont) return;
    const A = P.acc(), D = P.datos();
    if (!A?.lista?.length) { cont.replaceChildren(el('p', { class: 'vacio' }, 'Faltan datos de mercado.')); return; }
    const I = A.indices || {}, hora = P.horaNY(A.actualizado), ult = D[0];
    const ord = [...A.lista].filter(a => a.cambio1d != null).sort((a, b) => b.cambio1d - a.cambio1d);
    const empresa = a => el('button', { class: 'enlace', onclick: () => P.elegirEmpresa(a.ticker) }, a.ticker);

    const indices = panel('Índices y tasas', 'Yahoo Finance, ' + hora, el('table', { class: 'tm-tabla' },
      el('thead', {}, fila(el('th', {}, ''), el('th', { class: 'num' }, 'Último'), el('th', { class: 'num' }, 'Día'), el('th', { class: 'num' }, 'Mes'), el('th', { class: 'num' }, 'Año'), el('th', {}, '30 ruedas'))),
      el('tbody', {}, IDX.filter(([k]) => I[k]).map(([k, n]) => { const s = I[k];
        return fila(el('td', {}, n, s.estado !== 'ok' ? el('span', { class: 'tm-viejo', title: 'Dato desactualizado' }, ' •') : null), el('td', { class: 'num' }, num(s.precio)),
          el('td', { class: 'num ' + clase(s.cambio1d) }, pct(s.cambio1d)), el('td', { class: 'num ' + clase(s.ret?.m1) }, pct(s.ret?.m1, 1)),
          el('td', { class: 'num ' + clase(s.ret?.a1) }, pct(s.ret?.a1, 1)), el('td', { class: 'tm-mini' }, mini(s.cierres.slice(-30))));
      }))));

    const mov = (titulo, lista) => panel(titulo, 'última rueda', el('table', { class: 'tm-tabla' },
      el('thead', {}, fila(el('th', {}, ''), el('th', { class: 'num' }, 'Precio'), el('th', { class: 'num' }, 'Día'), el('th', { class: 'num' }, 'Vol. rel.'))),
      el('tbody', {}, lista.map(a => fila(el('td', {}, empresa(a)), el('td', { class: 'num' }, num(a.precio)), el('td', { class: 'num ' + clase(a.cambio1d) }, pct(a.cambio1d)),
        el('td', { class: 'num' + (a.volRel >= 2 ? ' t-mixto' : '') }, a.volRel != null ? num(a.volRel, 1) + '×' : '—'))))));

    const S = Object.entries(A.sectores || {}).sort((a, b) => b[1].d1 - a[1].d1);
    const sectores = panel('Sectores', 'promedio simple, última rueda', el('div', { class: 'tm-calor' }, S.map(([n, s]) => {
      const m = Math.min(Math.abs(s.d1) / 2.5, 1);
      return el('div', { class: 'tm-celda' + (m > .55 ? ' oscura' : ''), style: `--c:${s.d1 >= 0 ? P.COLOR.positivo : P.COLOR.negativo};--m:${Math.round(12 + m * 70)}%`, title: `${n}: ${pct(s.d1)} hoy, ${pct(s.m1, 1)} en el mes` },
        el('b', {}, n), el('span', {}, pct(s.d1)), el('small', {}, `mes ${pct(s.m1, 1)}`));
    })));

    const am = A.amplitud, vix = I.vix;
    const riesgo = panel('Volatilidad y amplitud', 'datos medidos', el('dl', { class: 'tm-dl' },
      vix ? [el('dt', {}, 'VIX'), el('dd', { class: vix.precio >= 30 ? 'baja' : vix.precio >= 20 ? 't-mixto' : 'sube' }, `${num(vix.precio, 1)} (${pct(vix.cambio1d, 1)})`)] : null,
      am ? [el('dt', {}, 'Suben / bajan'), el('dd', {}, `${am.suben} / ${am.bajan} de ${am.total}`),
        el('dt', {}, 'Arriba de su media de 50'), el('dd', {}, `${am.sobre50} de ${am.total}`), el('dt', {}, 'Arriba de su media de 200'), el('dd', {}, `${am.sobre200} de ${am.total}`),
        el('dt', {}, 'Máximos / mínimos de 52 sem.'), el('dd', {}, `${am.nuevosMax} / ${am.nuevosMin}`)] : null,
      I.bono10 ? [el('dt', {}, 'Bono 10 años'), el('dd', {}, num(I.bono10.precio) + '%')] : null,
      I.sp500?.sma?.[200] ? [el('dt', {}, 'S&P 500 contra su media de 200'), el('dd', { class: clase(I.sp500.precio - I.sp500.sma[200]) }, pct((I.sp500.precio / I.sp500.sma[200] - 1) * 100, 1))] : null));

    const noticias = ult ? porImportancia(ult.noticias || [], ult) : [];
    const feed = panel('Noticias', ult ? `resumen del ${fechaCorta(ult.fecha)}, ${ult.hora}` : 'sin resumen', noticias.length ? el('ul', { class: 'tm-feed' }, noticias.map(n => el('li', {},
      el('span', { class: 'punto t-' + tono(n.tono), 'aria-hidden': 'true' }),
      el('button', { class: 'enlace', onclick: () => P.abrirResumen(ult) }, n.titulo),
      el('small', {}, [n.hora && n.hora + ' NY', n.importancia && 'importancia ' + n.importancia, P.puntaje ? `puntaje ${P.puntaje(n, ult)}` : null, (n.afecta || []).slice(0, 2).join(', ')].filter(Boolean).join(' · '))))) : el('p', { class: 'nota' }, 'Sin noticias guardadas.'));

    const anomalias = A.lista.flatMap(a => (a.anomalias || []).map(x => ({ ...x, a })));
    const anom = panel(`Anomalías (${anomalias.length})`, 'reglas fijas', anomalias.length ? el('ul', { class: 'tm-lista' }, anomalias.slice(0, 10).map(x => el('li', {}, empresa(x.a), el('span', {}, x.tipo))))
      : el('p', { class: 'nota' }, 'Nada fuera de lo normal hoy.'));

    const agenda = panel('Agenda', 'según el último resumen', ult?.proximos?.length ? el('ul', { class: 'tm-lista' }, ult.proximos.map(x => el('li', {}, x))) : el('p', { class: 'nota' }, 'Sin eventos anotados.'));

    const lista = (P.leer('listas', {})[P.leer('listaActual', '')] || []).filter(x => x.t === 'empresa').map(x => A.lista.find(a => a.ticker === x.id)).filter(Boolean);
    const seguidas = lista.length ? lista : A.lista.filter(a => (P.leer('favoritas', [])).includes(a.ticker));
    const mia = panel('Tu seguimiento', lista.length ? 'tu lista actual' : 'tus favoritas', seguidas.length ? el('table', { class: 'tm-tabla' },
      el('tbody', {}, seguidas.slice(0, 10).map(a => fila(el('td', {}, empresa(a)), el('td', { class: 'num' }, num(a.precio)), el('td', { class: 'num ' + clase(a.cambio1d) }, pct(a.cambio1d)), el('td', { class: 'tm-mini' }, mini(a.cierres.slice(-30)))))))
      : el('p', { class: 'nota' }, 'Marcá empresas con la estrella o armá una lista en "Mis listas".'));

    const grafico = el('div');
    const sp = panel('S&P 500', 'cierre diario', grafico);
    cont.replaceChildren(el('div', { class: 'tm-grilla' },
      el('div', { class: 'tm-a' }, indices), el('div', { class: 'tm-b' }, sp), el('div', { class: 'tm-c' }, riesgo),
      el('div', { class: 'tm-d' }, mov('Más suben', ord.slice(0, 7))), el('div', { class: 'tm-e' }, mov('Más bajan', ord.slice(-7).reverse())),
      el('div', { class: 'tm-f' }, sectores), el('div', { class: 'tm-g' }, feed), el('div', { class: 'tm-h' }, anom),
      el('div', { class: 'tm-i' }, agenda), el('div', { class: 'tm-j' }, mia)));
    if (I.sp500) P.grafico(grafico, I.sp500, { titulo: 'S&P 500', unidad: 'puntos', rango: '3M' });
  }
  function porImportancia(ns, r) { return [...ns].sort((a, b) => (P.puntaje ? P.puntaje(b, r) - P.puntaje(a, r) : (IMP[a.importancia] ?? 1) - (IMP[b.importancia] ?? 1))); }
  P.alActualizar(render);
})();
