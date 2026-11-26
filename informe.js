// Informe para imprimir o guardar como PDF (botón "Informe PDF"): resumen ejecutivo, índices reales, noticias con fuentes,
// sectores, riesgos, indicadores de mercado, tendencias y conclusión. Usa el diálogo de impresión del navegador.
(() => {
  'use strict';
  const P = window.Pulso; if (!P) return;
  const { el, num, pct, fechaLarga, tono } = P;
  const CLAVE = { 'S&P 500': 'sp500', 'Dow Jones': 'dow', 'Nasdaq': 'nasdaq', 'Bono 10 años': 'bono10', 'Petróleo WTI': 'wti', 'Dólar (DXY)': 'dolar' };

  function armar(r) {
    const A = P.acc(), h2 = t => el('h2', {}, t), lista = xs => el('ul', {}, xs.map(x => el('li', {}, x)));
    const indices = (r.indices || []).map(x => {
      const b = CLAVE[x.nombre] && P.barraEn(CLAVE[x.nombre], r);
      return b ? [x.nombre, num(b.v) + (CLAVE[x.nombre] === 'bono10' ? '%' : ''), CLAVE[x.nombre] === 'bono10' ? `${b.cambio >= 0 ? '+' : '−'}${num(Math.abs(b.cambio))} pp` : pct(b.cambio), 'Yahoo Finance']
        : [x.nombre, x.valor ?? 'sin dato', x.cambio ?? 'sin dato', 'resumen de noticias'];
    });
    const ver = P.verificar ? P.verificar(r) : { avisos: [] };
    const am = A?.amplitud, sec = r === P.datos()[0] && A?.sectores ? Object.entries(A.sectores).sort((a, b) => b[1].d1 - a[1].d1) : [];
    return el('article', { class: 'informe-pdf' },
      el('header', {}, el('h1', {}, 'Pulso de Wall Street'), el('p', {}, `Informe del ${fechaLarga(r.fecha, true)}, ${P.momento(r).toLowerCase()} (${r.hora} hs). Generado el ${new Date().toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}.`)),
      h2('Resumen ejecutivo'), lista(P.resumenEjecutivo(r)),
      h2('Lo más importante, según las noticias'), lista(r.enSegundos || []),
      h2('Índices'), el('table', {}, el('thead', {}, el('tr', {}, ['Índice', 'Valor', 'Variación', 'Fuente'].map(t => el('th', {}, t)))), el('tbody', {}, indices.map(f => el('tr', {}, f.map(c => el('td', {}, c)))))),
      ver.avisos.length ? [h2('Verificación de cifras'), lista(ver.avisos)] : null,
      h2('Noticias'), el('ol', {}, (r.noticias || []).map(n => el('li', {}, el('b', {}, n.titulo), ` (tono ${tono(n.tono)}${P.puntaje ? `, puntaje ${P.puntaje(n, r)}` : ''}). ${n.resumen || ''} `,
        el('span', { class: 'fuentes-pdf' }, (n.fuentes || []).filter(f => P.urlSegura(f.url)).map(f => `${f.nombre}: ${f.url}`).join(' | '))))),
      h2('Sectores'), lista([...(r.sectores || []).map(s => `${s.sector}: tono ${tono(s.tono)}. ${s.porque || ''}`), ...(sec.length ? [`Según los precios de la rueda, el más fuerte fue ${sec[0][0]} (${pct(sec[0][1].d1)}) y el más débil ${sec.at(-1)[0]} (${pct(sec.at(-1)[1].d1)}).`] : [])]),
      h2('Riesgos'), lista([r.riesgoHoy || 'Sin observaciones en el resumen.']),
      am ? [h2('Indicadores del mercado'), lista([`Suben ${am.suben} y bajan ${am.bajan} de ${am.total} empresas seguidas.`, `${am.sobre50} arriba de su media de 50 ruedas y ${am.sobre200} arriba de la de 200.`, `Máximos de 52 semanas: ${am.nuevosMax}; mínimos: ${am.nuevosMin}.`])] : null,
      h2('Tendencias de los últimos 90 días'), lista(P.tendenciasEnFrases(r)),
      r.proximos?.length ? [h2('Para seguir'), lista(r.proximos)] : null,
      h2('Conclusión'), el('p', {}, P.resumenEjecutivo(r)[0] || 'Sin datos de mercado para la fecha.'),
      el('p', { class: 'aviso-pdf' }, 'Información, no asesoramiento financiero. Describe lo que pasó y no anticipa precios ni recomienda comprar o vender. Precios: Yahoo Finance; noticias: fuentes citadas.'));
  }

  function imprimir() {
    const r = P.actual(); if (!r) return P.aviso('Todavía no hay un resumen para el informe');
    document.querySelector('.informe-pdf')?.remove();
    document.body.append(armar(r));
    document.body.classList.add('imprimiendo');
    const fin = () => { document.body.classList.remove('imprimiendo'); document.querySelector('.informe-pdf')?.remove(); removeEventListener('afterprint', fin); };
    addEventListener('afterprint', fin);
    setTimeout(() => print(), 50); // el navegador ofrece "Guardar como PDF" en el diálogo
  }
  document.getElementById('informePdf')?.addEventListener('click', imprimir);
  P.informe = { armar, imprimir };
})();
