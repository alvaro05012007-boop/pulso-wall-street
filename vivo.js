// Precios en vivo: con la página abierta y visible, cada 15 segundos le pide los precios al intermediario de Cloudflare
// (cloudflare/precios-en-vivo.js, que se los pide a Yahoo) y los cambia en el ranking y en la ficha, sin redibujar nada más.
// Funciona en horario normal y también antes de la apertura y después del cierre. Si falla, quedan los últimos precios guardados.
(() => {
  'use strict';
  const URL_VIVO = 'https://precios-en-vivo.alvaro05012007.workers.dev/'; // dirección del Worker publicado en Cloudflare; vacía = sin precios en vivo
  const P = window.Pulso; if (!P || !URL_VIVO) return;
  const { el, num, pct, clase } = P;
  const SESION = { pre: 'Antes de la apertura', post: 'Después del cierre' };
  const horaCorta = s => new Date(s * 1000).toLocaleTimeString('es-AR', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  let vivo = {}, ultima = null, error = false, timer = null, enCurso = false;

  // Qué mostrar de cada empresa: precio normal y, fuera de horario, la sesión extendida más nueva (si es posterior al cierre)
  function dato(tk) {
    const q = vivo[tk]; if (!q || q.precio == null) return null;
    const ext = q.estado === 'REGULAR' ? null : [['post', q.post], ['pre', q.pre]].filter(([, x]) => x?.hora > (q.hora || 0)).sort((a, b) => b[1].hora - a[1].hora)[0];
    return { precio: q.precio, cambioPct: q.cambioPct, ext: ext ? { sesion: ext[0], ...ext[1] } : null };
  }
  function destello(nodo, antes, ahora) { // como en Yahoo: un instante verde o rojo cuando cambia el precio
    if (antes == null || antes === ahora) return;
    nodo.classList.remove('destello-sube', 'destello-baja'); void nodo.offsetWidth;
    nodo.classList.add(ahora > antes ? 'destello-sube' : 'destello-baja');
  }

  function pintar() {
    for (const tr of document.querySelectorAll('#ranking tr[data-tk]')) {
      const d = dato(tr.dataset.tk); if (!d) continue;
      const tdP = tr.children[3], tdD = tr.children[4];
      if (!tdP || !tdD) continue;
      const nuevo = num(d.precio), previo = tdP.dataset.vivo != null ? +tdP.dataset.vivo : null;
      if (tdP.firstChild?.nodeType === 3) tdP.firstChild.nodeValue = nuevo; else tdP.prepend(nuevo);
      destello(tdP, previo, d.precio); tdP.dataset.vivo = d.precio;
      tdD.textContent = pct(d.cambioPct); tdD.className = 'num ' + clase(d.cambioPct);
      let s = tdP.querySelector('.ext');
      if (d.ext) {
        s ??= tdP.appendChild(el('span', {}));
        s.className = 'ext ' + clase(d.ext.cambioPct);
        s.textContent = (d.ext.sesion === 'pre' ? 'pre ' : 'post ') + pct(d.ext.cambioPct);
        s.title = `${SESION[d.ext.sesion]}: ${num(d.ext.precio)} USD, ${horaCorta(d.ext.hora)} (NY)`;
      } else s?.remove();
    }
    const caja = document.querySelector('#detalle .det-precio'), tk = document.querySelector('#detalle .det-sub span')?.textContent;
    const d = tk && dato(tk);
    if (caja && d) {
      const b = caja.querySelector(':scope > b'), sp = caja.querySelector(':scope > span');
      const previo = caja.dataset.vivo != null ? +caja.dataset.vivo : null;
      if (b) { b.textContent = num(d.precio) + ' USD'; destello(b, previo, d.precio); }
      if (sp) { sp.textContent = `${pct(d.cambioPct)} ${vivo[tk].estado === 'REGULAR' ? 'hoy' : 'en la última rueda'}`; sp.className = clase(d.cambioPct); }
      caja.dataset.vivo = d.precio;
      caja.querySelector('.det-ext')?.remove();
      caja.append(el('div', { class: 'det-ext' },
        d.ext ? [`${SESION[d.ext.sesion]}: `, el('b', {}, num(d.ext.precio) + ' USD'), ' ', el('span', { class: clase(d.ext.cambioPct) }, pct(d.ext.cambioPct))] : null,
        (h => { const fresco = Date.now() / 1000 - h < 600; // "en vivo" solo si el precio es de los últimos 10 minutos
          return el('small', {}, fresco ? el('i', { class: 'punto-vivo', 'aria-hidden': 'true' }) : null,
            (fresco ? `En vivo, ${horaCorta(h)}` : `Último precio: ${P.horaNY(h * 1000).replace(' (NY)', '')}`) + ' (NY)' +
            (d.ext ? '. Opera poca gente: puede cambiar mucho en la apertura.' : fresco ? '. Yahoo puede tener unos segundos de demora.' : '. La bolsa está cerrada.')); })((d.ext || vivo[tk]).hora)));
    }
    let est = document.getElementById('vivoEstado');
    if (!est) { est = el('p', { class: 'nota vivo-estado', id: 'vivoEstado', 'aria-live': 'off' }); document.getElementById('rankingFecha')?.before(est); }
    est.replaceChildren(...(error ? ['Sin conexión con los precios en vivo: se ven los últimos guardados.']
      : ultima ? (abierto() ? [el('i', { class: 'punto-vivo', 'aria-hidden': 'true' }), `Precios en vivo de Yahoo Finance (cada 15 segundos), consultados a las ${new Date(ultima).toLocaleTimeString('es-AR')}.`]
        : [`Bolsa cerrada: se ven los últimos precios de Yahoo Finance. Vuelven a moverse en vivo desde las 4:00 de Nueva York (antes de la apertura).`]) : []));
  }

  function abierto() { // de lunes a viernes, de 4:00 a 20:00 de Nueva York (pre, rueda y post). Los feriados piden igual: no cuesta nada
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
    const m = +p.hour * 60 + +p.minute;
    return !['Sat', 'Sun'].includes(p.weekday) && m >= 240 && m <= 1205;
  }
  async function pedir() {
    if (enCurso) return; // un pedido por vez
    clearTimeout(timer); enCurso = true;
    const lista = P.acc()?.lista;
    if (lista?.length && !document.hidden) {
      try {
        const r = await fetch(`${URL_VIVO}?s=${lista.map(a => encodeURIComponent(a.ticker)).join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (j?.precios && typeof j.precios === 'object') { vivo = j.precios; ultima = Date.now(); error = false; }
      } catch { error = true; }
      pintar();
    }
    enCurso = false;
    timer = setTimeout(pedir, error ? 60e3 : abierto() ? 15e3 : 10 * 60e3);
  }
  // Cuando la página redibuja el ranking o la ficha (filtros, otra empresa), se vuelven a poner los precios en vivo
  const obs = new MutationObserver(() => { if (ultima) pintar(); });
  for (const id of ['ranking', 'detalle']) { const n = document.getElementById(id); if (n) obs.observe(n, { childList: true }); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pedir(); });
  P.alActualizar(() => { if (!ultima) pedir(); });
})();
