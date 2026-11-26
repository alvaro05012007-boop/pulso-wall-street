// Estado del sistema: frescura y origen de cada dato, fallas de la última actualización, resúmenes que faltan
// y el registro del actualizador independiente (logs/ejecuciones.js).
(() => {
  'use strict';
  const P = window.Pulso; if (!P) return;
  const { el, num, fechaCorta } = P;
  const $ = id => document.getElementById(id);
  const hace = iso => { const h = (Date.now() - Date.parse(iso)) / 36e5; return h < 1 ? `hace ${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `hace ${Math.round(h)} h` : `hace ${Math.round(h / 24)} días`; };
  const estadoTxt = (ok, txt) => el('span', { class: 'pastilla ' + (ok ? 'abierto' : 'alerta') }, txt);

  function faltantes(D) { // ruedas recientes (según la serie real del S&P 500) sin resumen de cierre guardado
    const sp = P.serie('sp500'); if (!sp) return [];
    const conCierre = new Set(D.filter(r => r.momento === 'cierre').map(r => r.fecha));
    return sp.fechas.slice(-10).filter(f => !conCierre.has(f));
  }

  // El servidor en modo red (Abrir en el celular.cmd) da el link con clave; acá se muestra como código QR.
  let red; // se consulta una sola vez
  async function pintarCelular(caja) {
    const pasos = el('ol', {},
      el('li', {}, 'En la carpeta bolsa-ny, hacé doble clic en "Abrir en el celular.cmd" y dejá abierta esa ventana.'),
      el('li', {}, 'Si Windows pregunta por Node.js, permitilo solo en redes privadas.'),
      el('li', {}, 'Conectá el celular al mismo Wi-Fi que la PC y escaneá el código que aparece acá.'));
    if (!location.protocol.startsWith('http')) { caja.append(pasos, el('p', { class: 'nota' }, 'Ahora la abriste con doble clic; el código aparece cuando la abrís con ese archivo.')); return; }
    try { red ??= await (await fetch('/api/red')).json(); } catch { red = { red: false }; }
    if (!red.red || !red.urls?.length) { caja.append(pasos, el('p', { class: 'nota' }, 'El servidor está en modo solo esta PC. Usá "Abrir en el celular.cmd".')); return; }
    const url = red.urls[0], img = el('img', { class: 'qr', alt: 'Código QR para abrir la página en el celular' });
    caja.append(el('div', { class: 'celular-cuerpo' }, img,
      el('div', {}, el('p', {}, 'Escaneá el código con la cámara del celular (mismo Wi-Fi que la PC). El link trae una clave: no lo compartas.'),
        el('p', { class: 'nota' }, 'Funciona mientras la PC esté prendida y la ventana del servidor abierta. Para usarla desde cualquier lugar falta la nube (ver pendientes).'),
        el('button', { class: 'chip', onclick: () => navigator.clipboard?.writeText(url).then(() => P.aviso('Link copiado'), () => P.aviso('No se pudo copiar')) }, 'Copiar link'))));
    const pintar = () => { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); img.src = q.createDataURL(5, 8); };
    if (window.qrcode) return pintar();
    const s = el('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js' });
    s.onload = pintar; s.onerror = () => img.replaceWith(el('p', { class: 'nota' }, 'Sin internet para dibujar el código. Abrí este link en el celular: ' + url));
    document.head.append(s);
  }

  function render() {
    const cont = $('estado'); if (!cont) return;
    const A = P.acc(), D = P.datos(), E = window.EJECUCIONES || [];
    const edad = A ? (Date.now() - Date.parse(A.actualizado)) / 36e5 : Infinity;
    const est = A?.estado;
    const filasIdx = A ? Object.entries(A.indices || {}).map(([k, s]) => el('tr', {},
      el('td', {}, s.nombre || k), el('td', {}, s.simbolo || ''), el('td', {}, s.fuente || 'Yahoo Finance'),
      el('td', {}, s.actualizadoISO ? P.horaNY(s.actualizadoISO) : 'sin hora'),
      el('td', {}, estadoTxt(s.estado === 'ok', s.estado === 'ok' ? 'Al día' : 'Desactualizado')))) : [];
    const faltan = faltantes(D);
    const PENDIENTES = [ // copia de PENDIENTES.md: lo que solo puede hacer el usuario (cuentas, claves, pagos)
      ['Noticias sin Claude abierto', 'Crear una clave en console.anthropic.com, pegarla en bolsa-ny/.env (ANTHROPIC_API_KEY) y avisar para probarla.'],
      ['Página con la PC apagada y desde cualquier lugar', 'Crear una cuenta en un servicio de nube (por ejemplo GitHub) y decidir si la página queda pública o con contraseña.'],
      ['Segunda fuente de precios y capitalización bursátil', 'Crear una clave gratuita en un proveedor de datos (Alpha Vantage o Twelve Data) y pegarla en bolsa-ny/.env.'],
      ['Cifras oficiales de la economía', 'Crear una clave gratuita de FRED (Reserva Federal de St. Louis) y pegarla en bolsa-ny/.env (FRED_API_KEY) para seguir IPC, PCE, empleo, PIB y la tasa de la Fed con datos oficiales.'],
      ['Probar en tus dispositivos', 'Abrir la página en Safari y revisar mañana entre las 10:00 y 10:45 que el actualizador corrió solo.']
    ];
    const celular = el('section', { class: 'tarjeta celular', id: 'celular' }, el('h3', {}, 'Abrir en el celular'));
    pintarCelular(celular);
    cont.replaceChildren(...[ // replaceChildren escribiría "null" como texto: se filtran los bloques que no aplican
      celular,
      el('section', { class: 'tarjeta pendientes' }, el('h3', {}, 'Pendientes que solo podés hacer vos'),
        el('ol', {}, PENDIENTES.map(([t, d]) => el('li', {}, el('b', {}, t + ': '), d))),
        el('p', { class: 'nota' }, 'La lista completa, con casillas para tildar, está en bolsa-ny/PENDIENTES.md.')),
      el('div', { class: 'stats' },
        A ? P.stat('Datos de mercado', hace(A.actualizado), P.horaNY(A.actualizado), edad > 30 ? 't-mixto' : null) : P.stat('Datos de mercado', 'sin datos', 'falta acciones.js'),
        est ? P.stat('Empresas actualizadas', `${est.empresas.actualizadas} de ${A.lista.length}`, est.empresas.desactualizadas.length ? `desactualizadas: ${est.empresas.desactualizadas.join(', ')}` : 'ninguna desactualizada') : null,
        D[0] ? P.stat('Último resumen de noticias', `${fechaCorta(D[0].fecha)} ${D[0].hora}`, `${D.length} resúmenes guardados`) : P.stat('Último resumen de noticias', 'ninguno', ''),
        P.stat('Actualizador independiente', E.length ? hace(E.at(-1).inicio) : 'nunca corrió', E.length ? (E.at(-1).ok ? 'última ejecución sin errores' : 'la última ejecución tuvo errores') : 'ver README para instalarlo', E.length && !E.at(-1).ok ? 't-negativo' : null)),
      edad > 30 && A ? el('p', { class: 'aviso-riesgo' }, `Los datos de mercado tienen más de ${Math.floor(edad)} horas. Si hubo ruedas desde entonces, los precios que ves no son los últimos.`) : null,
      el('section', { class: 'bloque' }, el('h3', { class: 'cmp-titulo' }, 'Fuentes de los índices'),
        el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel' }, el('thead', {}, el('tr', {}, ['Índice', 'Símbolo', 'Fuente', 'Último dato', 'Estado'].map(h => el('th', {}, h)))), el('tbody', {}, filasIdx))),
        el('p', { class: 'nota' }, 'Yahoo Finance puede publicar con unos minutos de demora. Si falla, el sistema prueba su servidor alternativo; si también falla, conserva el último dato válido y lo marca como desactualizado. Nunca completa un valor que no vino de la fuente.')),
      est && (est.empresas.fallas.length || est.indices.fallas.length || est.avisos.length) ? el('section', { class: 'bloque' }, el('h3', { class: 'cmp-titulo' }, 'Problemas de la última actualización de precios'),
        el('ul', { class: 'informe' }, [...est.empresas.fallas, ...est.indices.fallas].map(f => el('li', {}, P.el('span', { class: 'origen o-desconocido' }, 'Falla'), f)), est.avisos.map(a => el('li', {}, P.el('span', { class: 'origen o-interpretacion' }, 'Aviso'), a)))) : null,
      el('section', { class: 'bloque' }, el('h3', { class: 'cmp-titulo' }, 'Resúmenes de cierre que faltan'),
        faltan.length ? el('p', {}, `En las últimas 10 ruedas no hay resumen de cierre del: ${faltan.map(f => fechaCorta(f)).join(', ')}. Suele pasar si la app de Claude estaba cerrada a la hora de la tarea.`)
          : el('p', { class: 'nota' }, 'Hay resumen de cierre para cada una de las últimas 10 ruedas.')),
      el('section', { class: 'bloque' }, el('h3', { class: 'cmp-titulo' }, 'Registro del actualizador independiente'),
        E.length ? el('div', { class: 'tabla-wrap' }, el('table', { class: 'tabla-intel' },
          el('thead', {}, el('tr', {}, ['Inicio', 'Motivo', 'Duración', 'Resultado', 'Detalle'].map(h => el('th', {}, h)))),
          el('tbody', {}, [...E].reverse().slice(0, 20).map(e => el('tr', {},
            el('td', {}, new Date(e.inicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })), el('td', {}, e.motivo),
            el('td', { class: 'num' }, `${e.segundos} s`), el('td', {}, estadoTxt(e.ok, e.ok ? 'Bien' : 'Con errores')),
            el('td', { class: 'detalle-log' }, e.pasos.map(p => `${p.paso}: ${p.omitido ? (p.paso === 'noticias' ? 'omitido (sin clave de API)' : 'ya hecho') : p.ok ? 'ok' : 'falló'}${p.intentos > 1 ? ` (${p.intentos} intentos)` : ''}`).join(', ')))))))
          : el('p', { class: 'nota' }, 'Todavía no corrió. Los precios se actualizan igual cada vez que corre la tarea de Claude.')),
      el('section', { class: 'bloque' }, el('h3', { class: 'cmp-titulo' }, 'Cómo se actualiza cada cosa'),
        el('ul', { class: 'informe' },
          el('li', {}, el('b', {}, 'Precios e indicadores: '), 'acciones.mjs, desde Yahoo Finance. Lo corre la tarea de Claude y también puede correrlo el actualizador independiente (actualizar.mjs), que no necesita a Claude.'),
          el('li', {}, el('b', {}, 'Resúmenes de noticias: '), 'por ahora los escribe la tarea programada de Claude a las 9:30 y 17:30 (hora de tu PC), y necesita la app abierta. Hacerlos sin Claude requiere una clave de API de un modelo de IA: ver README.'),
          el('li', {}, el('b', {}, 'Historial: '), 'datos.mjs valida cada resumen antes de publicarlo; los inválidos se saltean con aviso y nunca se borran.')))].filter(Boolean));
  }
  P.alActualizar(render);
})();
