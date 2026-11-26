// Listas personalizadas, alertas y "qué cambió desde tu última visita". Todo vive en el navegador (localStorage):
// las alertas se revisan cuando llegan datos nuevos con la página abierta. Avisar con la página cerrada
// necesita el actualizador independiente con un canal de avisos (ver README).
(() => {
  'use strict';
  const P = window.Pulso; if (!P) return;
  const { el, num, pct, clase, fechaCorta } = P;
  const $ = id => document.getElementById(id);
  const INDICES = { sp500: 'S&P 500', dow: 'Dow Jones', nasdaq: 'Nasdaq Composite', nasdaq100: 'Nasdaq 100', russell: 'Russell 2000', vix: 'VIX', bono10: 'Bono 10 años', wti: 'Petróleo WTI', dolar: 'Dólar (DXY)' };
  const TIPOS = { variacion: 'Variación del día mayor a', volumen: 'Volumen relativo mayor a', volatilidad: 'Volatilidad de 20 ruedas mayor a', noticia: 'Noticia que mencione', evento: 'Acontecimiento económico' };
  const UNIDAD = { variacion: '%', volumen: '×', volatilidad: '%', noticia: '', evento: '' };
  // mismas reglas que alertas.mjs: un acontecimiento aparece en las noticias o en la agenda del último resumen
  const EVENTOS = { 'Fed y tasas': /(^|\W)(Fed|Reserva Federal|FOMC|Powell|tasas? de inter[eé]s)(\W|$)/i, 'Inflación': /(^|\W)(PCE|IPC|CPI|inflaci[oó]n)(\W|$)/i,
    'Empleo': /(^|\W)(empleo|desempleo|n[oó]minas|payrolls)(\W|$)/i, 'PIB': /(^|\W)(PIB|PBI|GDP)(\W|$)/i };
  let listas = P.leer('listas', { 'Seguimiento': [] }), actual = P.leer('listaActual', 'Seguimiento');
  let alertas = P.leer('alertas', []), disparadas = P.leer('alertasDisparadas', []);
  const visita = P.leer('ultimaVisita', null); // la foto de la visita anterior: no se pisa hasta salir de la página
  if (!listas[actual]) actual = Object.keys(listas)[0] || 'Seguimiento';
  if (!listas[actual]) listas[actual] = [];
  const guardarTodo = () => { P.guardar('listas', listas); P.guardar('listaActual', actual); P.guardar('alertas', alertas); P.guardar('alertasDisparadas', disparadas.slice(0, 60)); };

  function dato(item) { // lo que se sabe hoy de un elemento seguido: empresa, índice o sector
    const A = P.acc(); if (!A) return null;
    if (item.t === 'empresa') { const a = A.lista.find(x => x.ticker === item.id); return a && { nombre: `${a.ticker}: ${a.nombre}`, valor: num(a.precio) + ' USD', d1: a.cambio1d, m1: a.ret?.m1, a1: a.ret?.a1 ?? a.retorno1a, ficha: a.ticker, precio: a.precio }; }
    if (item.t === 'indice') { const s = A.indices?.[item.id]; return s && { nombre: INDICES[item.id], valor: num(s.precio), d1: s.cambio1d, m1: s.ret?.m1, a1: s.ret?.a1, precio: s.precio }; }
    const s = A.sectores?.[item.id]; return s && { nombre: `Sector ${item.id}`, valor: `${s.n} empresas`, d1: s.d1, m1: s.m1, a1: s.a1 };
  }
  function opciones() {
    const A = P.acc(), m = new Map();
    if (!A) return m;
    for (const [k, n] of Object.entries(INDICES)) if (A.indices?.[k]) m.set(`${n} (índice)`, { t: 'indice', id: k });
    for (const s of Object.keys(A.sectores || {})) m.set(`Sector ${s}`, { t: 'sector', id: s });
    for (const a of A.lista) m.set(`${a.ticker}: ${a.nombre}`, { t: 'empresa', id: a.ticker });
    return m;
  }
  const clave = i => i.t + ':' + i.id;

  // ---- alertas: se evalúan una vez por cada versión de los datos ----
  function evaluar() {
    const A = P.acc(), D = P.datos(), nuevas = [];
    for (const al of alertas) {
      let version, hit = null;
      if (al.tipo === 'noticia') {
        const r = D[0]; if (!r) continue; version = r.id;
        const k = al.objetivo.toLowerCase();
        const n = (r.noticias || []).find(n => [n.titulo, n.resumen, ...(n.afecta || [])].join(' ').toLowerCase().includes(k));
        if (n) hit = `Noticia del ${fechaCorta(r.fecha)}: ${n.titulo}`;
      } else if (al.tipo === 'evento') {
        const r = D[0], rx = EVENTOS[al.objetivo]; if (!r || !rx) continue; version = r.id;
        const n = (r.noticias || []).find(n => rx.test([n.titulo, n.resumen].join(' '))), prox = (r.proximos || []).find(x => rx.test(x));
        if (n) hit = `${al.objetivo}: ${n.titulo}`; else if (prox) hit = `${al.objetivo}, en la agenda: ${prox}`;
      } else {
        if (!A) continue; version = A.actualizado;
        const a = A.lista.find(x => x.ticker === al.objetivo), s = A.indices?.[al.objetivo], x = a || s; if (!x) continue;
        const nombre = a ? a.ticker : INDICES[al.objetivo];
        if (al.tipo === 'variacion' && x.cambio1d != null && Math.abs(x.cambio1d) >= al.umbral) hit = `${nombre} se movió ${pct(x.cambio1d)} en la rueda`;
        if (al.tipo === 'volumen' && x.volRel != null && x.volRel >= al.umbral) hit = `${nombre} negoció ${num(x.volRel)} veces su volumen promedio`;
        if (al.tipo === 'volatilidad' && x.volHist20 != null && x.volHist20 >= al.umbral) hit = `${nombre} tiene volatilidad de 20 ruedas de ${num(x.volHist20, 1)}%`;
      }
      if (hit && al.ultimaVersion !== version) { al.ultimaVersion = version; nuevas.push({ cuando: new Date().toISOString(), texto: hit, alerta: al.id }); }
    }
    if (!nuevas.length) return;
    disparadas = [...nuevas, ...disparadas].slice(0, 60); guardarTodo();
    P.aviso(nuevas.length === 1 ? 'Alerta: ' + nuevas[0].texto : `${nuevas.length} alertas nuevas`);
    if ('Notification' in window && Notification.permission === 'granted') nuevas.slice(0, 3).forEach(x => { try { new Notification('Pulso de Wall Street', { body: x.texto }); } catch { /* el navegador no deja: queda el aviso en la página */ } });
  }

  function cambiosVisita() {
    if (!visita) return el('p', { class: 'nota' }, 'Es tu primera visita con esta función: la próxima vez vas a ver acá qué cambió.');
    const A = P.acc(), D = P.datos();
    const nuevos = D.filter(r => r.id > (visita.resumenId || ''));
    const items = [];
    for (const [k, precio] of Object.entries(visita.precios || {})) {
      const [t, id] = k.split(':'), d = dato({ t, id }); if (!d?.precio || !precio) continue;
      items.push([d.nombre, (d.precio / precio - 1) * 100]);
    }
    return el('div', {},
      el('p', { class: 'nota' }, `Tu última visita fue el ${new Date(visita.ts).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}.`),
      el('ul', { class: 'informe' },
        el('li', {}, nuevos.length ? `${nuevos.length} ${nuevos.length === 1 ? 'resumen nuevo' : 'resúmenes nuevos'} desde entonces.` : 'No llegaron resúmenes nuevos.'),
        A && visita.acc !== A.actualizado ? el('li', {}, `Los precios se actualizaron el ${P.horaNY(A.actualizado)}.`) : el('li', {}, 'Los precios no cambiaron desde entonces.'),
        ...items.slice(0, 12).map(([n, v]) => el('li', {}, `${n}: `, el('b', { class: clase(v) }, pct(v, 1)), ' desde tu última visita'))));
  }
  function guardarVisita() {
    const A = P.acc(), D = P.datos(), precios = {};
    for (const it of Object.values(listas).flat()) { const d = dato(it); if (d?.precio) precios[clave(it)] = d.precio; }
    P.guardar('ultimaVisita', { ts: Date.now(), resumenId: D[0]?.id || '', acc: A?.actualizado || '', precios });
  }
  addEventListener('pagehide', guardarVisita);

  function render() {
    evaluar();
    const cont = $('listas'); if (!cont) return;
    const ops = opciones(), items = listas[actual] || [];
    const nuevaLista = el('input', { class: 'buscar', placeholder: 'Nombre de una lista nueva', 'aria-label': 'Nombre de una lista nueva', maxlength: '40' });
    const crear = () => {
      const n = nuevaLista.value.trim().replace(/\s+/g, ' ');
      if (!n) return; if (listas[n]) return P.aviso('Ya existe una lista con ese nombre');
      listas[n] = []; actual = n; guardarTodo(); render();
    };
    nuevaLista.onkeydown = e => { if (e.key === 'Enter') crear(); };
    const agregarIn = el('input', { class: 'buscar', type: 'search', list: 'listaOpciones', placeholder: 'Agregar empresa, índice o sector', 'aria-label': 'Agregar a la lista' });
    const agregar = () => {
      const it = ops.get(agregarIn.value.trim()); if (!it) return;
      if (items.some(x => clave(x) === clave(it))) return P.aviso('Ya está en la lista');
      listas[actual].push(it); agregarIn.value = ''; guardarTodo(); render();
    };
    agregarIn.onchange = agregar; agregarIn.onkeydown = e => { if (e.key === 'Enter') agregar(); };

    const tabla = items.length ? el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel' },
      el('thead', {}, el('tr', {}, ['Elemento', 'Valor', 'Día', 'Mes', 'Año', ''].map((h, i) => el('th', { class: i && i < 5 ? 'num' : null }, h)))),
      el('tbody', {}, items.map(it => {
        const d = dato(it);
        if (!d) return el('tr', {}, el('td', {}, it.id), el('td', { colspan: '4' }, 'Sin datos por ahora'), el('td', {}, quitarBtn(it)));
        return el('tr', {}, el('td', {}, d.ficha ? el('button', { class: 'enlace', onclick: () => P.elegirEmpresa(d.ficha) }, d.nombre) : d.nombre),
          el('td', { class: 'num' }, d.valor), ...[d.d1, d.m1, d.a1].map(v => el('td', { class: 'num ' + clase(v) }, v == null ? 'sin dato' : pct(v, 1))), el('td', {}, quitarBtn(it)));
      })))) : el('p', { class: 'vacio' }, 'La lista está vacía. Agregá empresas, índices o sectores con el buscador.');
    function quitarBtn(it) { return el('button', { class: 'chip', 'aria-label': `Quitar ${it.id} de la lista`, onclick: () => { listas[actual] = listas[actual].filter(x => clave(x) !== clave(it)); guardarTodo(); render(); } }, 'Quitar'); }

    // formulario de alertas
    const tipo = el('select', { class: 'buscar', 'aria-label': 'Tipo de alerta' }, Object.entries(TIPOS).map(([k, t]) => el('option', { value: k }, t)));
    const objetivo = el('input', { class: 'buscar', list: 'alertaOpciones', placeholder: 'Empresa o índice (ej.: NVDA, sp500)', 'aria-label': 'A qué se aplica la alerta' });
    const umbral = el('input', { class: 'buscar corto', type: 'number', step: '0.1', min: '0', value: '3', 'aria-label': 'Umbral' });
    const unidad = el('span', { class: 'nota' }, '%');
    const listaEventos = el('datalist', { id: 'eventoOpciones' }, Object.keys(EVENTOS).map(k => el('option', { value: k })));
    tipo.onchange = () => {
      const n = tipo.value === 'noticia', ev = tipo.value === 'evento';
      umbral.hidden = n || ev; unidad.textContent = UNIDAD[tipo.value];
      objetivo.setAttribute('list', ev ? 'eventoOpciones' : 'alertaOpciones');
      objetivo.placeholder = ev ? 'Fed y tasas, Inflación, Empleo o PIB' : n ? 'Palabra a buscar (ej.: Fed, Nvidia, PCE)' : 'Empresa o índice (ej.: NVDA, sp500)';
      umbral.value = { variacion: 3, volumen: 2, volatilidad: 40, noticia: '', evento: '' }[tipo.value];
    };
    const crearAlerta = () => {
      const t = tipo.value, o = objetivo.value.trim(), u = +umbral.value, A = P.acc();
      if (!o) return P.aviso('Escribí a qué se aplica la alerta');
      let obj = o;
      if (t === 'evento') { obj = Object.keys(EVENTOS).find(k => k.toLowerCase() === o.toLowerCase()); if (!obj) return P.aviso('Elegí Fed y tasas, Inflación, Empleo o PIB'); }
      else if (t !== 'noticia') {
        const it = ops.get(o); obj = it ? it.id : (A?.lista.some(a => a.ticker === o.toUpperCase()) ? o.toUpperCase() : (INDICES[o] ? o : null));
        if (!obj || ops.get(o)?.t === 'sector') return P.aviso('Elegí una empresa o un índice de la lista');
        if (!(u > 0)) return P.aviso('El umbral tiene que ser un número mayor que 0');
      } else if (o.length < 2) return P.aviso('Escribí al menos 2 letras');
      alertas.push({ id: Date.now().toString(36), tipo: t, objetivo: obj, umbral: t === 'noticia' || t === 'evento' ? null : u, creada: new Date().toISOString() });
      guardarTodo(); objetivo.value = ''; render(); P.aviso('Alerta creada');
    };
    const exportar = alertas.length ? el('button', { class: 'chip', title: 'Descarga pulso-alertas.json; el actualizador de Windows lo toma solo de tu carpeta Descargas', onclick: () => {
      const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(alertas, null, 2)], { type: 'application/json' })), download: 'pulso-alertas.json' });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      P.aviso('Listo: el actualizador de Windows va a avisar estas alertas aunque la página esté cerrada');
    } }, 'Avisar también con la página cerrada') : null;
    const permiso = 'Notification' in window ? (Notification.permission === 'granted' ? el('span', { class: 'nota' }, 'Avisos del sistema activados.')
      : Notification.permission === 'denied' ? el('span', { class: 'nota' }, 'El navegador bloqueó los avisos del sistema; las alertas se ven igual en esta página.')
        : el('button', { class: 'chip', onclick: () => Notification.requestPermission().then(render) }, 'Activar avisos del sistema')) : null;

    cont.replaceChildren(
      el('div', { class: 'grilla2' },
        el('section', { class: 'tarjeta' }, el('h3', {}, 'Qué cambió desde tu última visita'), cambiosVisita()),
        el('section', { class: 'tarjeta' }, el('h3', {}, 'Alertas disparadas'),
          disparadas.length ? el('ul', { class: 'informe' }, disparadas.slice(0, 8).map(x => el('li', {}, el('span', { class: 'nota' }, new Date(x.cuando).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) + ' '), x.texto)))
            : el('p', { class: 'nota' }, 'Ninguna por ahora.'))),
      el('h3', { class: 'cmp-titulo' }, 'Listas'),
      el('div', { class: 'controles' },
        el('div', { class: 'segmento', role: 'group', 'aria-label': 'Listas' }, Object.keys(listas).map(n => el('button', { 'aria-pressed': String(n === actual), onclick: () => { actual = n; guardarTodo(); render(); } }, n))),
        nuevaLista, el('button', { class: 'chip', onclick: crear }, 'Crear lista'),
        Object.keys(listas).length > 1 ? el('button', { class: 'chip', onclick: () => { if (confirm(`¿Borrar la lista "${actual}"? Esto no se puede deshacer.`)) { delete listas[actual]; actual = Object.keys(listas)[0]; guardarTodo(); render(); } } }, 'Borrar esta lista') : null),
      el('div', { class: 'controles' }, agregarIn, el('datalist', { id: 'listaOpciones' }, [...ops.keys()].map(k => el('option', { value: k })))),
      tabla,
      el('p', { class: 'nota' }, 'Las empresas con estrella siguen apareciendo arriba de todo en "Tus favoritas".'),
      el('h3', { class: 'cmp-titulo' }, 'Alertas'),
      el('div', { class: 'controles' }, tipo, objetivo, listaEventos, el('datalist', { id: 'alertaOpciones' }, [...ops.entries()].filter(([, v]) => v.t !== 'sector').map(([k]) => el('option', { value: k }))),
        umbral, unidad, el('button', { class: 'chip primario', onclick: crearAlerta }, 'Crear alerta'), permiso, exportar),
      alertas.length ? el('ul', { class: 'anomalias-lista' }, alertas.map(al => el('li', {},
        el('b', {}, TIPOS[al.tipo]), el('span', {}, al.tipo === 'noticia' ? `"${al.objetivo}"` : al.tipo === 'evento' ? al.objetivo : `${num(al.umbral, al.tipo === 'volumen' ? 1 : 1)}${UNIDAD[al.tipo]} en ${INDICES[al.objetivo] || al.objetivo}`),
        el('button', { class: 'chip', onclick: () => { alertas = alertas.filter(x => x.id !== al.id); guardarTodo(); render(); } }, 'Borrar'))))
        : el('p', { class: 'nota' }, 'No tenés alertas. Ejemplo: "Variación del día mayor a 3%" en NVDA.'));
  }
  P.alActualizar(render);
})();
