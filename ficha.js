/* Ficha ampliada de cada empresa: capitalización, próximo balance, presentaciones oficiales ante la SEC (empresas.js),
   empresas que se mueven parecido (correlación de precios), temas que la mueven y restricciones/regulación (tus resúmenes). */
(() => {
  const P = window.Pulso; if (!P) return;
  const { el, num, fechaCorta, tono, urlSegura } = P;
  const REGULACION = /arancel|restricci|exportaci|importaci|regulac|regulador|impuest|sanci[oó]n|antimonopol|monopolio|prohib|controles de|veto|multa|\bFTC\b|Departamento de Comercio/i;

  const miles = v => v >= 1e12 ? num(v / 1e12, 2) + ' billones' : num(v / 1e9, 1) + ' mil millones';
  function parecidas(a, n = 3) { // correlación de los rendimientos diarios del último año, por fecha
    const ret = x => { const m = new Map(); for (let i = 1; i < x.fechas.length; i++) m.set(x.fechas[i], x.cierres[i] / x.cierres[i - 1] - 1); return m; };
    const ra = ret(a), out = [];
    for (const b of P.acc()?.lista || []) {
      if (b.ticker === a.ticker || !b.fechas) continue;
      const rb = ret(b), xs = [], ys = [];
      for (const [f, v] of ra) if (rb.has(f)) { xs.push(v); ys.push(rb.get(f)); }
      if (xs.length < 60) continue;
      const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
      if (sxx && syy) out.push({ b, c: sxy / Math.sqrt(sxx * syy) });
    }
    return out.sort((x, y) => y.c - x.c).slice(0, n);
  }

  P.seccionesEmpresa.push(a => {
    const emp = window.EMPRESAS?.porTicker?.[a.ticker], ments = P.menciones(a), hoy = new Date().toISOString().slice(0, 10);
    const temas = new Map();
    const propios = new Set([a.ticker, ...(a.claves || []), a.nombre || ''].map(s => s.toLowerCase()));
    const GENERICOS = new Set(['sector', 'empresa', 'empresas', 'mercado', 'general', 'otros']);
    for (const { n } of ments) for (const t of [n.categoria, ...(n.afecta || [])]) {
      const k = (t || '').toLowerCase();
      if (k && !propios.has(k) && !GENERICOS.has(k) && ![...propios].some(p => p && k.startsWith(p.split(' ')[0]))) temas.set(t, (temas.get(t) || 0) + 1);
    }
    const regs = [];
    for (const r of P.datos()) for (const n of r.noticias || []) {
      const texto = [n.titulo, n.resumen, n.impacto].join(' ');
      const toca = ments.some(m => m.n === n) || (n.afecta || []).includes(a.sector) || texto.includes(a.sector);
      if (toca && REGULACION.test(texto + ' ' + (n.categoria || ''))) regs.push({ r, n });
    }
    const bal = emp?.balance, par = parecidas(a);
    return el('section', { class: 'ficha-extra', 'aria-label': 'Información de la empresa' },
      el('h4', {}, 'Información de la empresa'),
      el('div', { class: 'det-stats' },
        emp?.capitalizacion ? P.stat('Capitalización', miles(emp.capitalizacion) + ' USD', 'valor de todas sus acciones') : null,
        bal?.fecha ? P.stat(bal.fecha >= hoy ? 'Próximo balance' : 'Último balance', fechaCorta(bal.fecha, true),
          bal.fecha >= hoy ? (bal.estimada ? 'fecha estimada' : 'fecha confirmada') : 'todavía no anunció el próximo') : null,
        bal?.gananciaPorAccion != null && bal.fecha >= hoy ? P.stat('Ganancia por acción esperada', num(bal.gananciaPorAccion) + ' USD', 'promedio de los analistas') : null),
      par.length ? el('div', { class: 'ficha-bloque' }, el('h5', {}, 'Se mueve parecido a'),
        el('div', { class: 'chips' }, par.map(({ b, c }) => el('button', { class: 'chip', onclick: () => P.elegirEmpresa(b.ticker), title: `Correlación de ${num(c)} en el último año` },
          `${b.nombre ? b.nombre.split(/[ ,]/)[0] : b.ticker} (${b.ticker}) · ${num(c)}`))),
        el('p', { class: 'nota' }, 'Correlación de los movimientos diarios del último año (1 = se mueven igual). Es una relación en los precios, no necesariamente en el negocio.')) : null,
      temas.size ? el('div', { class: 'ficha-bloque' }, el('h5', {}, 'Temas que la mueven en tus noticias'),
        el('div', { class: 'chips' }, [...temas].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([t, k]) => el('span', { class: 'chip' }, `${t} · ${k}`)))) : null,
      el('div', { class: 'ficha-bloque' }, el('h5', {}, 'Restricciones y regulación'),
        regs.length ? el('ul', { class: 'det-noticias' }, regs.slice(0, 5).map(({ r, n }) => el('li', {}, el('button', { onclick: () => P.abrirResumen(r) },
          el('span', { class: 'punto t-' + tono(n.tono), 'aria-hidden': 'true' }), el('span', { class: 'f' }, fechaCorta(r.fecha)), el('span', {}, n.titulo)))))
          : el('p', { class: 'nota' }, `Ninguna noticia de aranceles, controles de exportación, impuestos o regulación sobre ${a.ticker} o ${a.sector} en tus resúmenes.`)),
      emp?.presentaciones?.length ? el('div', { class: 'ficha-bloque' }, el('h5', {}, 'Presentaciones oficiales ante la SEC'),
        el('ul', { class: 'ficha-sec' }, emp.presentaciones.map(p => el('li', {}, el('span', { class: 'f' }, fechaCorta(p.fecha, true)),
          urlSegura(p.url) ? el('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer' }, `${p.formulario}: ${p.tipo}`) : el('span', {}, p.tipo)))),
        el('p', { class: 'nota' }, 'Documentos que la empresa entrega al regulador de la bolsa de EE.UU. (en inglés).')) : null,
      emp ? el('p', { class: 'nota' }, `Fuentes: Yahoo Finance${emp.yahooFecha ? ' (' + fechaCorta(emp.yahooFecha.slice(0, 10), true) + ')' : ''} y SEC EDGAR${emp.secFecha ? ' (' + fechaCorta(emp.secFecha.slice(0, 10), true) + ')' : ''}.`)
        : el('p', { class: 'nota' }, 'Los datos de analistas, balances y la SEC se bajan una vez por día con la próxima actualización.'));
  });
})();
