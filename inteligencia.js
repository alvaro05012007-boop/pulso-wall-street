// Centro de inteligencia de mercado: diagnóstico, sectores, anomalías, seguimiento macro e informe diario.
// Todo sale de datos de mercado reales (acciones.js) o de los resúmenes de noticias (datos.js), y cada afirmación
// dice de dónde viene: Dato (medido), Noticia (lo dice una fuente citada), Interpretación (regla explícita) o Sin datos.
(() => {
  'use strict';
  const P = window.Pulso; if (!P) return;
  const { el, num, pct, clase, fechaCorta, stat, urlSegura, tono } = P;
  const $ = id => document.getElementById(id);
  const ORIGEN = { dato: 'Dato', noticia: 'Noticia', interpretacion: 'Interpretación', desconocido: 'Sin datos' };
  const etiqueta = t => el('span', { class: 'origen o-' + t }, ORIGEN[t]);
  const item = (t, ...c) => el('li', {}, etiqueta(t), el('span', {}, ...c));
  const fuentes = n => (n.fuentes || []).filter(f => urlSegura(f.url)).slice(0, 2).map(f => [' ', el('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.nombre)]);
  const INDICES = [['sp500', 'S&P 500'], ['dow', 'Dow Jones'], ['nasdaq', 'Nasdaq Composite'], ['nasdaq100', 'Nasdaq 100'], ['russell', 'Russell 2000']];
  // Cómo se llaman los sectores de los resúmenes dentro de los 10 grandes sectores
  const SUB = { 'Tecnología': ['Tecnología', 'Semiconductores', 'Software', 'Hardware'], 'Finanzas': ['Financiero'], 'Industria': ['Industria', 'Defensa', 'Transporte'] };
  const MACRO = [
    ['Reserva Federal y tasas', /(^|\W)(Fed|Reserva Federal|tasas? de inter[eé]s|Powell|FOMC)(\W|$)/i],
    ['Inflación: PCE e IPC', /(^|\W)(PCE|IPC|CPI|inflaci[oó]n)(\W|$)/i],
    ['Empleo', /(^|\W)(empleo|desempleo|n[oó]minas|payrolls|puestos de trabajo|pedidos de subsidio)(\W|$)/i],
    ['Crecimiento: PIB', /(^|\W)(PIB|PBI|GDP|recesi[oó]n)(\W|$)/i]
  ];
  const texto = n => [n.titulo, n.resumen, ...(n.afecta || [])].join(' ');
  const IMP = { alta: 0, media: 1, baja: 2 };
  const porImportancia = ns => [...ns].sort((a, b) => (IMP[a.importancia] ?? 1) - (IMP[b.importancia] ?? 1));

  function tendencia(s) { // regla explícita y conocida, no una predicción
    if (!s?.sma?.[200]) return null;
    const p = s.precio, m50 = s.sma[50], m200 = s.sma[200];
    if (p > m200 && m50 > m200) return 'tendencia de largo plazo alcista (regla: precio y media de 50 ruedas arriba de la de 200)';
    if (p < m200 && m50 < m200) return 'tendencia de largo plazo bajista (regla: precio y media de 50 ruedas debajo de la de 200)';
    return 'tendencia de largo plazo mixta (precio y medias cruzados)';
  }
  function caidaDesdeMax(s) {
    const d = (s.precio / s.max52 - 1) * 100;
    return { d, txt: d <= -20 ? 'en mercado bajista: más de 20% debajo de su máximo de 52 semanas' : d <= -10 ? 'en corrección: más de 10% debajo de su máximo de 52 semanas' : d <= -5 ? 'en un retroceso moderado, entre 5% y 10% debajo de su máximo' : 'cerca de su máximo de 52 semanas' };
  }
  function percentilVix(v) { const c = v.cierres; return Math.round(c.filter(x => x <= c.at(-1)).length / c.length * 100); }
  function tonoNoticias(macro, D, dias) { // % de menciones positivas del sector en los resúmenes de los últimos días
    const nombres = SUB[macro] || [macro], desde = D[0] ? new Date(Date.parse(D[0].fecha) - dias * 864e5).toISOString().slice(0, 10) : '';
    let p = 0, t = 0;
    for (const r of D) if (r.fecha > desde) for (const s of r.sectores || []) if (nombres.includes(s.sector)) { t++; if (tono(s.tono) === 'positivo') p++; }
    return t ? { pct: Math.round(p / t * 100), t } : null;
  }

  function render() {
    const cont = $('intel'); if (!cont) return;
    const A = P.acc(), D = P.datos();
    if (!A?.lista?.length || !A.indices?.sp500) { cont.replaceChildren(el('p', { class: 'vacio' }, 'Faltan datos de mercado. Se cargan con la próxima actualización de precios.')); return; }
    const I = A.indices, sp = I.sp500, vix = I.vix, am = A.amplitud, S = A.sectores || {}, ult = D[0];
    const horas = (Date.now() - Date.parse(A.actualizado)) / 36e5;
    const sectores = Object.entries(S).sort((a, b) => b[1].d1 - a[1].d1);
    const idx = INDICES.filter(([k]) => I[k]).map(([k, n]) => [n, I[k]]).sort((a, b) => b[1].cambio1d - a[1].cambio1d);
    const anomalias = [
      ...A.lista.filter(a => a.anomalias?.length).flatMap(a => a.anomalias.map(x => ({ ...x, tk: a.ticker, nombre: a.nombre }))),
      ...sectores.filter(([, s]) => Math.abs(s.z) >= 2).map(([n, s]) => ({ tipo: 'Movimiento sectorial inusual', detalle: `${n}: ${pct(s.d1)} en promedio, ${num(Math.abs(s.z), 1)} veces su movimiento típico del año` })),
      ...idx.filter(([, s]) => Math.abs(s.cambio1d) >= 2).map(([n, s]) => ({ tipo: 'Índice con movimiento fuerte', detalle: `${n}: ${pct(s.cambio1d)} en la rueda` })),
      ...(vix && Math.abs(vix.cambio1d) >= 15 ? [{ tipo: 'Salto del VIX', detalle: `${pct(vix.cambio1d)} en la rueda` }] : [])
    ];
    const cd = caidaDesdeMax(sp), tend = tendencia(sp);
    const zona = vix ? (vix.precio < 15 ? 'calma' : vix.precio < 20 ? 'normal' : vix.precio < 30 ? 'nervioso' : 'miedo') : null;

    // 1. Diagnóstico
    const diag = el('section', { class: 'bloque' }, el('h2', {}, 'Diagnóstico general'),
      el('p', { class: 'explica' }, `Datos de mercado de Yahoo Finance del ${P.horaNY(A.actualizado)}.`, horas > 30 ? el('b', { class: 't-mixto' }, ` Tienen más de ${Math.floor(horas)} horas: pueden no reflejar la última rueda.`) : ''),
      el('div', { class: 'stats' },
        stat('S&P 500', num(sp.precio), `${pct(sp.cambio1d)} en la rueda, ${pct(sp.ret?.m1, 1)} en un mes`, clase(sp.cambio1d)),
        vix ? stat('Volatilidad esperada (VIX)', num(vix.precio, 1), `${zona}; más alto que el ${percentilVix(vix)}% de los días del año`) : null,
        am ? stat('Amplitud', `${am.suben} suben, ${am.bajan} bajan`, `${am.sobre200} de ${am.total} arriba de su media de 200`) : null,
        am ? stat('Máximos y mínimos de 52 semanas', `${am.nuevosMax} y ${am.nuevosMin}`, 'empresas que tocaron un máximo o un mínimo del año hoy') : null),
      el('ul', { class: 'informe' },
        item('dato', `El S&P 500 está ${pct(cd.d, 1)} contra su máximo de 52 semanas (${num(sp.max52)}).`),
        item('interpretacion', `Por convención eso se describe como ${cd.txt}.`),
        tend ? item('interpretacion', `El S&P 500 muestra ${tend}.`) : null,
        am ? item('dato', `Hoy subieron ${am.suben} de las ${am.total} empresas seguidas; ${am.sobre50} están arriba de su media de 50 ruedas.`) : null),
      el('div', { class: 'grilla2' },
        el('div', {}, el('h3', {}, 'Índices, de más fuerte a más débil en la rueda'), el('ol', { class: 'podio' }, idx.map(([n, s]) => el('li', {}, el('span', {}, n), el('b', { class: clase(s.cambio1d) }, pct(s.cambio1d)), el('small', {}, `${pct(s.ret?.m1, 1)} en un mes`))))),
        el('div', {}, el('h3', {}, 'Sectores, de más fuerte a más débil en la rueda'), el('ol', { class: 'podio' }, sectores.map(([n, s]) => el('li', {}, el('span', {}, n), el('b', { class: clase(s.d1) }, pct(s.d1)), el('small', {}, `${pct(s.m1, 1)} en un mes`)))))));

    // 2. Inteligencia sectorial
    const tabla = el('table', { class: 'tabla-intel' },
      el('thead', {}, el('tr', {}, ['Sector', 'Empresas', 'Día', 'Semana', 'Mes', '3 meses', 'Año', 'Volatilidad', 'Arriba de su media de 50', 'Tono de noticias (7 días)', 'Mejor y peor hoy'].map((h, i) => el('th', { class: i > 0 && i < 9 ? 'num' : null }, h)))),
      el('tbody', {}, sectores.map(([n, s]) => {
        const tn = tonoNoticias(n, D, 7);
        return el('tr', { class: Math.abs(s.z) >= 2 ? 'inusual' : null },
          el('td', {}, n, Math.abs(s.z) >= 2 ? el('span', { class: 'marca-inusual', title: `Movimiento de ${num(Math.abs(s.z), 1)} desvíos` }, ' inusual') : null),
          el('td', { class: 'num' }, String(s.n)),
          ...['d1', 's1', 'm1', 'm3', 'a1'].map(k => el('td', { class: 'num ' + clase(s[k]) }, pct(s[k], 1))),
          el('td', { class: 'num' }, num(s.volatilidad, 1) + '%'),
          el('td', { class: 'num' }, s.sobre50 + '%'),
          el('td', {}, tn ? `${tn.pct}% positivas (${tn.t})` : 'sin menciones'),
          el('td', {}, el('span', { class: 'sube' }, s.mejores[0] || ''), ' / ', el('span', { class: 'baja' }, s.peores[0] || '')));
      })));
    const secc = el('section', { class: 'bloque' }, el('h2', {}, 'Inteligencia sectorial'),
      el('p', { class: 'explica' }, 'Promedios simples de las empresas seguidas de cada sector (todas pesan igual), con datos de mercado reales. El tono sale de los resúmenes de noticias de los últimos 7 días. "Inusual" marca un movimiento del día de 2 desvíos o más frente al año del propio sector.'),
      el('div', { class: 'tabla-wrap' }, tabla));

    // 3. Anomalías
    const anom = el('section', { class: 'bloque' }, el('h2', {}, `Anomalías detectadas (${anomalias.length})`),
      el('p', { class: 'explica' }, 'Reglas fijas sobre datos reales: movimiento de 3 desvíos o más, volumen de 2 veces el promedio de 20 ruedas o más, volatilidad de 20 ruedas 50% arriba de la del año, cambio de 0,35 o más en la correlación con el S&P 500, sectores de 2 desvíos o más, índices de 2% o más y saltos del VIX de 15% o más. Una anomalía es algo para mirar, no una señal.'),
      anomalias.length ? el('ul', { class: 'anomalias-lista' }, anomalias.slice(0, 40).map(x => el('li', {},
        el('b', {}, x.tipo), x.tk ? el('button', { class: 'chip', onclick: () => P.elegirEmpresa(x.tk) }, x.tk) : null, el('span', {}, x.detalle))))
        : el('p', { class: 'vacio' }, 'Hoy no hay movimientos fuera de lo normal según estas reglas.'));

    // 4. Seguimiento macro (de los resúmenes guardados)
    const macro = el('section', { class: 'bloque' }, el('h2', {}, 'Seguimiento macroeconómico'),
      el('p', { class: 'explica' }, 'Las últimas noticias sobre cada tema encontradas en tus resúmenes, con su fuente. Si un tema no aparece, es que no hubo noticias guardadas, no que no haya pasado nada.'),
      el('div', { class: 'grilla2' }, MACRO.map(([titulo, rx]) => {
        const ms = []; for (const r of D) for (const n of r.noticias || []) if (rx.test(texto(n)) && ms.length < 3) ms.push({ r, n });
        return el('div', { class: 'tarjeta macro' }, el('h3', {}, titulo),
          ms.length ? el('ul', {}, ms.map(({ r, n }) => el('li', {}, el('span', { class: 'punto t-' + tono(n.tono), 'aria-hidden': 'true' }),
            el('div', {}, el('button', { class: 'enlace', onclick: () => P.abrirResumen(r) }, `${fechaCorta(r.fecha)}: ${n.titulo}`), el('div', { class: 'nota' }, fuentes(n))))))
            : el('p', { class: 'nota' }, 'Sin noticias guardadas sobre este tema.'));
      })));

    // 5. Informe diario
    const top = ult ? porImportancia(ult.noticias || []).slice(0, 3) : [];
    const macroHoy = ult ? (ult.noticias || []).filter(n => MACRO.some(([, rx]) => rx.test(texto(n)))) : [];
    const pos = ult ? (ult.sectores || []).filter(s => tono(s.tono) === 'positivo').map(s => s.sector) : [];
    const neg = ult ? (ult.sectores || []).filter(s => tono(s.tono) === 'negativo').map(s => s.sector) : [];
    const pregunta = (t, ...items) => el('div', { class: 'pregunta' }, el('h3', {}, t), el('ul', { class: 'informe' }, items.flat().filter(Boolean)));
    const informe = el('section', { class: 'bloque' }, el('h2', {}, 'Informe inteligente del día'),
      el('p', { class: 'explica' }, ult ? `Combina los datos de mercado del ${P.horaNY(A.actualizado)} con el resumen de noticias del ${fechaCorta(ult.fecha)} a las ${ult.hora}. Las causas son las que dan las fuentes citadas.` : 'Todavía no hay resúmenes de noticias.'),
      el('div', { class: 'preguntas' },
        pregunta('1. ¿Qué está pasando en Wall Street?',
          item('dato', idx.slice(0, 5).map(([n, s]) => `${n} ${pct(s.cambio1d)}`).join(', ') + '.'),
          am ? item('dato', `${am.suben} empresas suben y ${am.bajan} bajan entre las 100 seguidas.`) : null,
          ult?.enSegundos?.[0] ? item('noticia', ult.enSegundos[0]) : null),
        pregunta('2. ¿Por qué está pasando?',
          top.length ? top.map(n => item('noticia', el('b', {}, n.titulo + '. '), n.resumen || '', fuentes(n))) : item('desconocido', 'No hay noticias guardadas que lo expliquen.')),
        pregunta('3. ¿Qué sectores están destacando?',
          sectores.length ? item('dato', `Más fuertes hoy: ${sectores.slice(0, 2).map(([n, s]) => `${n} (${pct(s.d1)})`).join(' y ')}. Más débiles: ${sectores.slice(-2).reverse().map(([n, s]) => `${n} (${pct(s.d1)})`).join(' y ')}.`) : null,
          pos.length || neg.length ? item('noticia', `Con noticias positivas: ${pos.join(', ') || 'ninguno'}. Con negativas: ${neg.join(', ') || 'ninguno'}.`) : null),
        pregunta('4. ¿Qué acontecimientos están afectando al mercado?',
          macroHoy.length ? macroHoy.slice(0, 4).map(n => item('noticia', n.titulo, fuentes(n))) : item('desconocido', 'El último resumen no trae noticias macroeconómicas (Fed, inflación, empleo o PIB).'),
          (ult?.contradicciones || []).map(c => item('noticia', el('b', {}, 'Fuentes que no coinciden: '), String(c)))),
        pregunta('5. ¿Cuáles son los principales riesgos?',
          vix ? item('dato', `VIX en ${num(vix.precio, 1)} (${zona}), más alto que el ${percentilVix(vix)}% de los días del último año.`) : null,
          item('interpretacion', `El S&P 500 está ${cd.txt}.`),
          anomalias.length ? item('dato', `${anomalias.length} anomalías detectadas hoy; ${anomalias.filter(x => x.tipo === 'Volatilidad en alza').length} son de volatilidad en alza.`) : null,
          ult?.riesgoHoy ? item('noticia', ult.riesgoHoy) : null),
        pregunta('6. ¿Qué datos y eventos conviene seguir?',
          ult?.proximos?.length ? ult.proximos.map(x => item('noticia', x)) : item('desconocido', 'El último resumen no trae próximos eventos.'))));

    cont.replaceChildren(informe, diag, secc, anom, macro, motorNoticias(A, D));
  }

  // ---- Motor de noticias: cruza lo que dicen los resúmenes con lo que hicieron los precios reales ----
  const palabras = t => new Set(String(t || '').toLowerCase().split(/[^a-záéíóúüñ0-9]+/).filter(w => w.length > 3));
  const parecido = (a, b) => { const c = [...a].filter(w => b.has(w)).length, u = new Set([...a, ...b]).size; return u ? c / u : 0; };
  function rueda(a, r) { // la rueda de la que habla el resumen: la previa si es antes de la apertura
    const i = a.fechas.findLastIndex(f => r.momento === 'apertura' ? f < r.fecha : f <= r.fecha);
    return i > 0 ? { fecha: a.fechas[i], cambio: (a.cierres[i] / a.cierres[i - 1] - 1) * 100 } : null;
  }
  function motorNoticias(A, D) {
    const casos = [], porEmpresa = [];
    for (const a of A.lista) {
      const ms = P.menciones(a); if (!ms.length) continue;
      const pos = ms.filter(m => tono(m.n.tono) === 'positivo').length;
      porEmpresa.push({ a, n: ms.length, pos, ult: ms[0].r.fecha });
      const vistas = new Set();
      for (const { r, n } of ms) {
        const k = r.id + n.titulo; if (vistas.has(k)) continue; vistas.add(k);
        const rd = rueda(a, r); if (rd) casos.push({ r, n, a, ...rd });
      }
    }
    casos.sort((x, y) => x.r.id < y.r.id ? 1 : -1);
    const definidos = casos.filter(c => ['positivo', 'negativo'].includes(tono(c.n.tono)) && c.cambio !== 0);
    const coinciden = definidos.filter(c => (tono(c.n.tono) === 'positivo') === (c.cambio > 0)).length;
    porEmpresa.sort((x, y) => y.n - x.n);

    // historias que se repiten en varios resúmenes (misma noticia en desarrollo)
    const historias = [];
    for (const r of [...D].reverse()) for (const n of r.noticias || []) {
      const p = palabras(n.titulo), h = historias.find(h => parecido(h.p, p) >= .5);
      if (h) { h.dias.add(r.fecha); h.ultima = n.titulo; h.ultimaR = r; h.p = p; } // compara con el último título, no con todos juntos
      else historias.push({ p, dias: new Set([r.fecha]), primera: r.fecha, ultima: n.titulo, ultimaR: r });
    }
    const enCurso = historias.filter(h => h.dias.size >= 2).sort((x, y) => y.dias.size - x.dias.size || (x.ultimaR.id < y.ultimaR.id ? 1 : -1)).slice(0, 8);

    // tono de noticias de 30 días contra rendimiento real del sector en el mes
    const sectores = Object.entries(A.sectores || {}).map(([n, s]) => ({ n, s, t: tonoNoticias(n, D, 30) })).filter(x => x.t);

    return el('section', { class: 'bloque' }, el('h2', {}, 'Motor de noticias'),
      el('p', { class: 'explica' }, 'Cruza las noticias de tus resúmenes con los precios reales del mismo día. Muestra coincidencias, no causas: que una noticia positiva coincida con una suba no prueba que la haya provocado.'),
      el('ul', { class: 'informe' },
        definidos.length ? item('dato', `En ${definidos.length} noticias con tono positivo o negativo sobre una empresa seguida, la acción se movió en la misma dirección que el tono el ${Math.round(coinciden / definidos.length * 100)}% de las veces (${coinciden} casos).`)
          : item('desconocido', 'Todavía no hay noticias con tono definido sobre las empresas seguidas.'),
        definidos.length ? item('interpretacion', 'Es esperable que sea alto: los resúmenes de cierre describen un movimiento que ya pasó, y el tono suele salir de ese mismo movimiento. Sirve para entender qué movió a cada acción, no para anticipar.') : null,
        definidos.length < 30 ? item('interpretacion', 'Con menos de 30 casos el porcentaje es poco confiable: puede cambiar mucho con cada resumen nuevo.') : null),
      el('div', { class: 'grilla2' },
        el('div', {}, el('h3', {}, 'Empresas más nombradas en tus resúmenes'),
          el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel' },
            el('thead', {}, el('tr', {}, ['Empresa', 'Menciones', 'Positivas', 'Última', 'Mes'].map((h, i) => el('th', { class: i && i !== 3 ? 'num' : null }, h)))),
            el('tbody', {}, porEmpresa.slice(0, 10).map(x => el('tr', {},
              el('td', {}, el('button', { class: 'enlace', onclick: () => P.elegirEmpresa(x.a.ticker) }, x.a.ticker)),
              el('td', { class: 'num' }, String(x.n)), el('td', { class: 'num' }, Math.round(x.pos / x.n * 100) + '%'),
              el('td', {}, fechaCorta(x.ult)), el('td', { class: 'num ' + clase(x.a.ret?.m1) }, pct(x.a.ret?.m1, 1)))))))),
        el('div', {}, el('h3', {}, 'Historias que siguen en desarrollo'),
          enCurso.length ? el('ul', { class: 'informe' }, enCurso.map(h => el('li', {}, el('span', { class: 'origen o-noticia' }, `${h.dias.size} días`),
            el('button', { class: 'enlace', onclick: () => P.abrirResumen(h.ultimaR) }, h.ultima), el('span', { class: 'nota' }, ` desde el ${fechaCorta(h.primera)}`))))
            : el('p', { class: 'nota' }, 'Ninguna noticia se repite en varios resúmenes.'))),
      el('h3', { class: 'cmp-titulo' }, 'Tono de las noticias contra el rendimiento del sector (último mes)'),
      el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel' },
        el('thead', {}, el('tr', {}, ['Sector', 'Noticias positivas (30 días)', 'Rendimiento real del mes', 'Coinciden'].map((h, i) => el('th', { class: i ? 'num' : null }, h)))),
        el('tbody', {}, sectores.map(({ n, s, t }) => {
          const tonoBueno = t.pct >= 50, coincide = tonoBueno === (s.m1 >= 0);
          return el('tr', {}, el('td', {}, n), el('td', { class: 'num' }, `${t.pct}% de ${t.t}`), el('td', { class: 'num ' + clase(s.m1) }, pct(s.m1, 1)), el('td', { class: 'num' }, coincide ? 'Sí' : 'No'));
        })))),
      el('h3', { class: 'cmp-titulo' }, 'Últimas noticias sobre empresas y cómo se movió la acción ese día'),
      el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel' },
        el('thead', {}, el('tr', {}, ['Rueda', 'Empresa', 'Noticia', 'Tono', 'Acción ese día'].map((h, i) => el('th', { class: i === 4 ? 'num' : null }, h)))),
        el('tbody', {}, casos.slice(0, 14).map(c => el('tr', {},
          el('td', {}, fechaCorta(c.fecha)), el('td', {}, el('button', { class: 'enlace', onclick: () => P.elegirEmpresa(c.a.ticker) }, c.a.ticker)),
          el('td', { class: 'celda-larga' }, c.n.titulo), el('td', { class: 't-' + tono(c.n.tono) }, tono(c.n.tono)),
          el('td', { class: 'num ' + clase(c.cambio) }, pct(c.cambio, 1))))))));
  }
  P.alActualizar(render);
})();
