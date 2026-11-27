(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const COLOR = { positivo: '#4FE3C1', negativo: '#FF6B8B', mixto: '#F5C451' };
  const TABS = [...document.querySelectorAll('[role=tab]')].map(b => b.id.slice(2)); // el orden lo da el HTML
  const LETRA = 'A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ';

  /* ---------- utilidades ---------- */
  function el(tag, props, ...hijos) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k.startsWith('on')) n[k] = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const h of hijos.flat(Infinity)) if (h != null && h !== false) n.append(h);
    return n;
  }
  function svg(tag, a) { const n = document.createElementNS(NS, tag); for (const k in a || {}) if (a[k] != null) n.setAttribute(k, a[k]); return n; }
  const ICONOS = {
    estrella: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    pausa: '<path d="M8 5v14M16 5v14"/>', play: '<path d="M8.5 5.5v13l10.5-6.5z" fill="currentColor"/>',
    voz: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>', mudo: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9.5l4 5M21 9.5l-4 5"/>'
  };
  function ico(n) { const s = svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }); s.innerHTML = ICONOS[n]; return s; }
  const leer = (k, d) => { try { const v = localStorage.getItem('pulso.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const guardar = (k, v) => { try { localStorage.setItem('pulso.' + k, JSON.stringify(v)); } catch { /* sin almacenamiento: solo se pierde la preferencia */ } };
  const num = (v, d = 2) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v, d = 2) => v == null ? 'sin dato' : (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v), d) + '%';
  const clase = v => v == null ? 'igual' : v > 0 ? 'sube' : v < 0 ? 'baja' : 'igual';
  const dia = iso => new Date(iso + 'T12:00:00');
  const fechaLarga = (iso, anio) => dia(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', ...(anio ? { year: 'numeric' } : {}) });
  const fechaCorta = (iso, anio) => dia(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', ...(anio ? { year: 'numeric' } : {}) });
  const tono = t => t === 'positivo' || t === 'negativo' ? t : 'mixto';
  const momento = r => r.momento === 'cierre' ? 'Después del cierre' : 'Antes de la apertura';
  const urlSegura = u => /^https?:\/\//i.test(u || ''); // los links vienen de la web: nada de javascript:
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sumarDias = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const stat = (titulo, valor, sub, cl) => el('div', { class: 'stat' }, el('span', {}, titulo), el('b', { class: cl || null }, valor), sub ? el('small', {}, sub) : null);
  let avisoT;
  function aviso(t) { const n = $('toast'); n.textContent = t; n.classList.add('ver'); clearTimeout(avisoT); avisoT = setTimeout(() => n.classList.remove('ver'), 4000); }

  let datos = [], actual = null, firmaDatos = '', acc = null, firmaAcc = '';
  const favs = new Set(leer('favoritas', []));
  const serie = k => acc?.indices?.[k];
  function valorEn(s, fecha) { if (!s) return null; let v = null; for (let i = 0; i < s.fechas.length && s.fechas[i] <= fecha; i++) v = s.cierres[i]; return v; }
  function cambioDia(s, fecha) { if (!s) return null; const i = s.fechas.indexOf(fecha); return i > 0 ? (s.cierres[i] / s.cierres[i - 1] - 1) * 100 : null; }

  /* ---------- glosario ---------- */
  const BONO = 'La tasa que paga el gobierno de EE.UU. por pedir prestado a 10 años. Es la referencia para créditos e hipotecas.';
  const GLOSARIO = {
    'Fed': 'La Reserva Federal, el banco central de Estados Unidos. Decide la tasa de interés de referencia.',
    'PCE': 'Índice de precios del gasto en consumo. Es la medida de inflación que más mira la Fed.',
    'CPI': 'Índice de precios al consumidor: la inflación que pagan las personas.',
    'IPC': 'Índice de precios al consumidor: la inflación que pagan las personas.',
    'S&P 500': 'Índice con las 500 empresas más grandes de Estados Unidos. Es el termómetro principal de la bolsa.',
    'Dow Jones': 'Índice con 30 empresas grandes y tradicionales de Estados Unidos.',
    'Nasdaq': 'Índice con mucho peso de empresas tecnológicas.',
    'Russell 2000': 'Índice con 2000 empresas chicas de Estados Unidos.',
    'bono a 10 años': BONO, 'bono del Tesoro a 10 años': BONO,
    'DXY': 'Índice que mide el dólar contra otras monedas fuertes.',
    'WTI': 'El tipo de petróleo de referencia en Estados Unidos.',
    'pp': 'Puntos porcentuales: pasar de 4% a 4,25% es una suba de 0,25 pp.',
    'ETF': 'Un fondo que cotiza en la bolsa como una acción y reúne muchas acciones o bonos.',
    'volatilidad': 'Cuánto sube y baja un precio. Más volatilidad quiere decir movimientos más bruscos.',
    'corrección': 'Una caída de 10% o más desde un máximo reciente.',
    'recompra': 'Cuando una empresa compra sus propias acciones.',
    'futuros': 'Contratos que se negocian antes de la apertura y anticipan cómo puede arrancar el mercado.',
    'VIX': 'Mide cuánta volatilidad espera el mercado para los próximos 30 días. Le dicen "el índice del miedo".',
    'PBI': 'Producto bruto interno: el tamaño de la economía de un país.',
    'balances': 'Los informes de ganancias que las empresas presentan cada trimestre.',
    'Thanksgiving': 'El Día de Acción de Gracias. Ese jueves la bolsa de Nueva York cierra.'
  };
  const DEF = Object.fromEntries(Object.entries(GLOSARIO).map(([k, v]) => [k.toLowerCase(), v]));
  const RX_GLOS = new RegExp(`(^|[^${LETRA}])(${Object.keys(GLOSARIO).sort((a, b) => b.length - a.length).map(esc).join('|')})(?![${LETRA}])`, 'gi');
  function conGlosario(texto, vistos) { // marca solo la primera aparición de cada término en la vista
    if (!texto) return [];
    const out = []; let ult = 0;
    for (const m of texto.matchAll(RX_GLOS)) {
      const term = m[2], k = term.toLowerCase(), i = m.index + m[1].length;
      if (vistos.has(k)) continue;
      vistos.add(k);
      out.push(texto.slice(ult, i), el('dfn', { class: 'term', tabindex: '0', 'data-def': DEF[k], 'aria-label': `${term}: ${DEF[k]}` }, term));
      ult = i + term.length;
    }
    out.push(texto.slice(ult));
    return out;
  }
  const vixTerm = document.querySelector('#vix .term');
  vixTerm.dataset.def = GLOSARIO.VIX; vixTerm.setAttribute('aria-label', 'VIX: ' + GLOSARIO.VIX);

  /* ---------- reloj de Nueva York ---------- */
  // shortcut: feriados y medias jornadas cargados hasta 2027; sumar los de 2028 cuando se publiquen
  const FERIADOS = new Set(('2026-01-01 2026-01-19 2026-02-16 2026-04-03 2026-05-25 2026-06-19 2026-07-03 2026-09-07 2026-11-26 2026-12-25 ' +
    '2027-01-01 2027-01-18 2027-02-15 2027-03-26 2027-05-31 2027-06-18 2027-07-05 2027-09-06 2027-11-25 2027-12-24').split(' '));
  const MEDIA_JORNADA = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);
  const fmtNY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const dur = m => m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d ${Math.floor(m % 1440 / 60)} h`;
  function estadoMercado() {
    const p = Object.fromEntries(fmtNY.formatToParts(new Date()).map(x => [x.type, x.value]));
    const hoy = `${p.year}-${p.month}-${p.day}`, ahora = +p.hour * 60 + +p.minute, hora = `${p.hour}:${p.minute}`;
    for (let d = 0; d < 12; d++) {
      const f = sumarDias(hoy, d), dw = new Date(f + 'T12:00:00Z').getUTCDay();
      if (dw === 0 || dw === 6 || FERIADOS.has(f)) continue;
      const abre = 570, cierra = MEDIA_JORNADA.has(f) ? 780 : 960;
      if (d === 0 && ahora >= cierra) continue;
      if (d === 0 && ahora >= abre) return { hora, abierto: true, falta: cierra - ahora, media: cierra === 780 };
      return { hora, abierto: false, falta: d * 1440 + abre - ahora, feriado: FERIADOS.has(hoy) };
    }
    return { hora, abierto: false, falta: 0 };
  }
  function reloj() {
    const e = estadoMercado();
    $('relojNY').textContent = e.hora;
    $('estadoMercado').replaceChildren(el('span', { class: 'pastilla ' + (e.abierto ? 'abierto' : 'cerrado') }, e.abierto ? 'Abierto' : e.feriado ? 'Feriado' : 'Cerrado'),
      e.abierto ? ` cierra en ${dur(e.falta)}${e.media ? ' (media jornada)' : ''}` : ` abre en ${dur(e.falta)}`);
    const ahora = new Date();
    for (let d = 0; d < 8; d++) for (const [h, m] of [[9, 30], [17, 30]]) {
      const t = new Date(ahora); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0);
      if (t > ahora && t.getDay() > 0 && t.getDay() < 6) {
        const cuando = d === 0 ? 'hoy' : d === 1 ? 'mañana' : t.toLocaleDateString('es-AR', { weekday: 'long' });
        $('proximo').replaceChildren('Próximo resumen ', el('strong', {}, `${cuando} ${h}:${String(m).padStart(2, '0')}`));
        return;
      }
    }
  }

  /* ---------- orbe 3D: color = tono del día, agitación = nerviosismo (VIX) ---------- */
  const orbe = (() => {
    const cont = $('orbe'), nada = { set() {}, montar() {}, devolver() {} };
    const sin3d = () => { cont.prepend(el('div', { class: 'sin-3d' })); return nada; };
    if (!window.THREE) return sin3d();
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return sin3d(); }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    cont.prepend(canvas);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100); cam.position.z = 4.8;
    const geo = new THREE.IcosahedronGeometry(1, 48);
    const azar = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < azar.length; i++) azar[i] = Math.random() * 2 - 1;
    geo.setAttribute('aRand', new THREE.BufferAttribute(azar, 3));
    const uni = { uT: { value: 0 }, uAmp: { value: .08 }, uColor: { value: new THREE.Color(COLOR.positivo) }, uPR: { value: renderer.getPixelRatio() },
      uIntro: { value: reduce ? 1 : 0 }, uMouse: { value: new THREE.Vector2(9, 9) }, uHover: { value: 0 } };
    const puntos = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uT, uAmp, uPR, uIntro, uHover; uniform vec2 uMouse; attribute vec3 aRand; varying float vD;
        void main() {
          vec3 p = position;
          float n = sin(p.x * 3.1 + uT) * sin(p.y * 3.7 + uT * 1.3) * sin(p.z * 2.9 + uT * .7);
          p *= 1.0 + uAmp * n;
          vec4 c = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          float d = distance(c.xy / c.w, uMouse);
          p *= 1.0 + uHover * .2 * exp(-d * d * 14.0);
          p = mix(p + aRand * 2.6, p, uIntro);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vD = n;
          gl_PointSize = uPR * 1.8 * (3.5 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uIntro; varying float vD;
        void main() {
          float d = length(gl_PointCoord - .5); if (d > .5) discard;
          vec3 c = mix(uColor, vec3(1.0), clamp(vD * .6, 0.0, .35));
          gl_FragColor = vec4(c, (1.0 - d * 2.0) * .22 * (.3 + .7 * uIntro));
        }`
    }));
    scene.add(puntos);
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(1.55, .004, 8, 160), new THREE.MeshBasicMaterial({ color: 0x8E9AD0, transparent: true, opacity: .35 }));
    anillo.rotation.x = Math.PI / 2.4; scene.add(anillo);
    const pe = new Float32Array(700 * 3);
    for (let i = 0; i < pe.length; i += 3) { pe[i] = (Math.random() * 2 - 1) * 7; pe[i + 1] = (Math.random() * 2 - 1) * 7; pe[i + 2] = -2 - Math.random() * 12; }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pe, 3));
    const estrellas = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0x8E9AD0, size: .025, transparent: true, opacity: .6, depthWrite: false }));
    scene.add(estrellas);

    let meta = new THREE.Color(COLOR.positivo), ampMeta = .08, hoverMeta = 0, rotX = 0, rotY = 0, velX = 0, velY = .0015;
    let arrastre = null, visible = true, corriendo = false, enShow = false, t0 = null, padre = cont;
    canvas.addEventListener('pointerdown', e => { arrastre = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      uni.uMouse.value.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
      if (!reduce) hoverMeta = 1;
      if (arrastre) {
        const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
        rotY += dx * .008; rotX += dy * .008; velY = dx * .0006; velX = dy * .0006;
        arrastre = { x: e.clientX, y: e.clientY };
      }
      arrancar();
    });
    const soltar = () => { arrastre = null; };
    canvas.addEventListener('pointerup', soltar);
    canvas.addEventListener('pointercancel', soltar);
    canvas.addEventListener('pointerleave', () => { hoverMeta = 0; });
    function tam() { const w = padre.clientWidth || 300; renderer.setSize(w, w, false); }
    addEventListener('resize', tam); tam();
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; arrancar(); }).observe(cont);
    function arrancar() { if (!corriendo && (visible || enShow)) { corriendo = true; requestAnimationFrame(cuadro); } }
    function cuadro(ms) {
      if (!visible && !enShow) { corriendo = false; return; }
      const t = ms / 1000; if (t0 == null) t0 = t;
      const k = reduce ? 1 : .04;
      if (!reduce) {
        uni.uT.value = t * .6;
        if (uni.uIntro.value < 1) uni.uIntro.value = 1 - Math.pow(1 - Math.min(1, (t - t0) / 2.4), 3);
        if (!arrastre) { rotY += velY; rotX += velX; velY += (.0015 - velY) * .02; velX *= .94; rotX *= .985; }
        estrellas.rotation.z = t * .01;
      }
      uni.uColor.value.lerp(meta, k);
      uni.uAmp.value += (ampMeta - uni.uAmp.value) * k;
      uni.uHover.value += (hoverMeta - uni.uHover.value) * (reduce ? 1 : .08);
      puntos.rotation.set(rotX, rotY, 0);
      anillo.rotation.z = rotY * .4;
      renderer.render(scene, cam);
      if (reduce) { corriendo = false; return; }
      requestAnimationFrame(cuadro);
    }
    return {
      set(color, amp) { meta = new THREE.Color(color); ampMeta = amp; arrancar(); },
      montar(destino) { enShow = true; padre = destino; destino.append(canvas); tam(); arrancar(); },
      devolver() { enShow = false; padre = cont; cont.prepend(canvas); tam(); arrancar(); }
    };
  })();

  /* ---------- resumen ---------- */
  let primera = true, lecturaPrev = 0;
  const alMostrar = []; // módulos que dependen del resumen que se está viendo (por ejemplo, la verificación de cifras)
  function contar(nodo, de, a) {
    const tok = nodo._tok = {};
    nodo.className = clase(a);
    if (reduce || de === a) { nodo.textContent = pct(a); return; }
    const t0 = performance.now();
    const paso = ahora => {
      if (nodo._tok !== tok) return;
      const k = Math.min(1, (ahora - t0) / 650);
      nodo.textContent = pct(de + (a - de) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }
  function favicon(color) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(24, 22, 3, 32, 32, 30);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.38, color); g.addColorStop(1, '#0E2F4F');
    x.fillStyle = g; x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.fill();
    document.querySelector('link[rel=icon]').href = c.toDataURL();
  }
  function mostrar(r, op = {}) {
    if (!r) return;
    actual = r; // ya, no al pintar: la transición pinta después y otra flecha rápida tiene que partir de acá
    if (op.transicion && document.startViewTransition && !reduce && !document.hidden) {
      // si llega otro pedido antes de pintar, esta transición se cancela: solo se pinta el último día pedido
      const t = document.startViewTransition(() => { if (actual === r) pintarResumen(r); });
      for (const p of [t.ready, t.finished, t.updateCallbackDone]) p.catch(() => {});
    } else pintarResumen(r);
  }
  function pintarResumen(r) {
    actual = r;
    const i = datos.indexOf(r), prev = datos[i + 1], t = tono(r.tonoGeneral), vistos = new Set();
    $('anterior').disabled = i >= datos.length - 1;
    $('siguiente').disabled = i <= 0;
    $('alUltimo').hidden = i <= 0;
    $('titulo').textContent = fechaLarga(r.fecha, dia(r.fecha).getFullYear() !== new Date().getFullYear());
    $('meta').replaceChildren(`${momento(r)}, ${r.hora} hs`, el('span', { class: 'tono-chip t-' + t }, 'Tono ' + t));
    $('titular').replaceChildren(...titular(r));
    const claves = r.enSegundos || [], verTodas = !!$('claves').dataset.todas;
    $('claves').replaceChildren(...claves.map((x, k) => el('li', { hidden: !verTodas && k >= 3 }, conGlosario(x, vistos))));
    $('verMasClaves').hidden = claves.length <= 3;
    $('verMasClaves').textContent = verTodas ? 'Ver menos' : `Ver ${claves.length - 3} ${claves.length - 3 === 1 ? 'punto' : 'puntos'} más`;
    const giros = prev ? (r.sectores || []).flatMap(s => {
      const a = (prev.sectores || []).find(p => p.sector === s.sector);
      return a && tono(a.tono) !== tono(s.tono) ? [[s.sector, tono(a.tono), tono(s.tono)]] : [];
    }).slice(0, 4) : [];
    $('cambiosDet').hidden = !giros.length;
    $('cambiosSum').textContent = `Qué cambió desde el resumen anterior (${giros.length})`;
    $('cambios').replaceChildren(...giros.map(([s, de, a]) =>
      el('span', { class: 'cambio' }, `${s} pasó de `, el('span', { class: 't-' + de }, de), ' a ', el('span', { class: 't-' + a }, a))));
    $('indices').replaceChildren(...(r.indices || []).map(x => indiceReal(x, r)));
    const dups = duplicadas(r.noticias || []);
    $('noticias').replaceChildren(...(r.noticias || []).map((x, k) => el('details', { class: 'noticia', open: k === 0 },
      el('summary', {}, el('span', { class: 'punto t-' + tono(x.tono), 'aria-hidden': 'true' }), el('span', {}, x.titulo, el('span', { class: 'sr' }, `, tono ${tono(x.tono)}`)),
        el('span', { class: 'afecta' }, (x.afecta || []).join(', '))),
      el('div', { class: 'cuerpo' }, insignias(x, dups[k], r), el('p', {}, conGlosario(x.resumen, vistos)),
        x.impacto ? el('p', { class: 'nota' }, 'Impacto estimado por la fuente o el resumen: ' + x.impacto) : null,
        el('div', { class: 'fuentes' }, (x.fuentes || []).filter(f => urlSegura(f.url)).map(f => el('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.nombre)))))));
    if (r.contradicciones?.length) $('noticias').append(el('div', { class: 'aviso-riesgo contradicciones' }, el('b', {}, 'Fuentes que no coinciden'),
      el('ul', {}, r.contradicciones.map(c => el('li', {}, String(c))))));
    $('sectores').replaceChildren(...(r.sectores || []).map(s => el('div', { class: 'sector' },
      el('span', { class: 'nom' }, s.sector), el('span', { class: 't-' + tono(s.tono) }, tono(s.tono)), el('span', { class: 'porque' }, conGlosario(s.porque, vistos)))));
    $('riesgoHoy').replaceChildren(...conGlosario(r.riesgoHoy || 'Sin observaciones especiales.', vistos));
    $('proximos').replaceChildren(...(r.proximos || []).map(x => el('li', {}, x)));

    const sp0 = (r.indices || [])[0], spReal = barraEn('sp500', r);
    const sp = spReal ? { nombre: 'S&P 500', cambioPct: spReal.cambio } : sp0;
    const vs = serie('vix'), vix = valorEn(vs, r.fecha);
    if (sp?.cambioPct != null) { contar($('lecturaV'), lecturaPrev, sp.cambioPct); lecturaPrev = sp.cambioPct; }
    else { $('lecturaV').textContent = sp?.cambio || '—'; $('lecturaV').className = ''; }
    $('lecturaN').textContent = sp?.nombre || '';
    $('vix').hidden = vix == null;
    if (vix != null) {
      const zona = vix < 15 ? 'calma' : vix < 20 ? 'normal' : vix < 30 ? 'nervioso' : 'miedo';
      $('vixV').textContent = `${num(vix, 1)}, ${zona}`;
      $('vixMarca').style.setProperty('--x', Math.max(0, Math.min(100, (vix - 10) / 30 * 100)) + '%');
      $('vixFecha').textContent = r.fecha >= vs.fechas.at(-1) ? '' : `al ${fechaCorta(r.fecha)}`;
    }
    const amp = vix != null ? .04 + Math.min(Math.max(vix - 12, 0), 28) / 28 * .24 : .05 + Math.min(Math.abs(sp?.cambioPct || 0), 6) * .035;
    orbe.set(COLOR[t], amp);
    document.documentElement.style.setProperty('--tono', COLOR[t]);
    document.title = (sp?.cambioPct != null ? `S&P ${pct(sp.cambioPct)} | ` : '') + 'Pulso de Wall Street';
    favicon(COLOR[t]);
    if (!primera) history.replaceState(null, '', i === 0 ? location.pathname + location.search : '#' + r.id);
    document.querySelectorAll('[data-id]').forEach(b => b.classList.toggle('activo', b.dataset.id === r.id));
    for (const f of alMostrar) { try { f(r); } catch (e) { console.error('Pulso:', e); } }
    if (primera) {
      primera = false;
      if (!reduce) {
        const h = $('heroTexto');
        [...h.children].forEach((c, k) => c.style.setProperty('--i', k));
        h.classList.add('entrada');
        setTimeout(() => h.classList.remove('entrada'), 1800);
      }
    }
  }
  // Frase simple de arriba: cómo le fue al mercado, qué tan nervioso está y cuántas empresas subieron
  function titular(r) {
    const sp = barraEn('sp500', r), vix = valorEn(serie('vix'), r.fecha), am = r === datos[0] ? acc?.amplitud : null;
    if (!sp) return [];
    const cuando = r.momento === 'apertura' ? 'Ayer' : 'Hoy';
    const zona = vix == null ? null : vix < 15 ? 'tranquilo' : vix < 20 ? 'normal' : vix < 30 ? 'nervioso' : 'con miedo';
    return [`${cuando} el mercado `, el('b', { class: clase(sp.cambio) }, `${sp.cambio >= 0 ? 'subió' : 'bajó'} ${num(Math.abs(sp.cambio))}%`),
      '. ', zona ? ['El ánimo está ', el('b', {}, zona), '. '] : null, am ? `Subieron ${am.suben} de ${am.total} empresas grandes.` : null].flat().filter(x => x != null);
  }
  $('verMasClaves').onclick = () => { const c = $('claves'); c.dataset.todas = c.dataset.todas ? '' : '1'; if (actual) pintarResumen(actual); };
  // Datos opcionales de cada noticia (los resúmenes nuevos los traen; los viejos no, y se ven igual que antes)
  const TIPO_NOTICIA = { hecho: 'Hecho confirmado', interpretacion: 'Interpretación', hipotesis: 'Hipótesis' };
  function insignias(x, dup, r) {
    const pz = window.Pulso?.puntaje?.(x, r), urg = window.Pulso?.urgencia?.(x, r);
    const b = [
      pz != null && el('span', { class: 'insignia ' + (pz >= 60 ? 'imp-alta' : pz >= 40 ? 'imp-media' : ''), title: 'Puntaje de importancia calculado con reglas fijas (ver Inteligencia)' }, `Puntaje ${pz}`),
      urg && el('span', { class: 'insignia' + (urg === 'alta' ? ' imp-alta' : '') }, `Urgencia ${urg}`),
      x.hora && el('span', { class: 'insignia' }, x.hora + ' (NY)'),
      x.importancia && el('span', { class: 'insignia imp-' + x.importancia }, 'Importancia ' + x.importancia),
      TIPO_NOTICIA[x.tipo] && el('span', { class: 'insignia tipo-' + x.tipo }, TIPO_NOTICIA[x.tipo]),
      x.categoria && el('span', { class: 'insignia' }, x.categoria),
      x.volatilidad && el('span', { class: 'insignia imp-media' }, 'Puede mover el mercado'),
      dup != null && el('span', { class: 'insignia imp-media' }, `Parecida a la noticia ${dup + 1}`)
    ].filter(Boolean);
    return b.length ? el('div', { class: 'insignias' }, b) : null;
  }
  function duplicadas(ns) { // títulos que comparten 60% o más de sus palabras: probablemente la misma noticia
    const pal = ns.map(n => new Set(String(n.titulo || '').toLowerCase().split(/[^a-záéíóúüñ0-9]+/).filter(w => w.length > 3)));
    const out = {};
    for (let i = 0; i < ns.length; i++) for (let j = 0; j < i; j++) {
      const a = pal[i], b = pal[j], comunes = [...a].filter(w => b.has(w)).length, union = new Set([...a, ...b]).size;
      if (union && comunes / union >= .6) { out[i] = j; break; }
    }
    return out;
  }
  // Índices con datos reales de mercado. El resumen de antes de la apertura habla del cierre anterior, por eso usa la rueda previa.
  const CLAVE_INDICE = { 'S&P 500': 'sp500', 'Dow Jones': 'dow', 'Nasdaq': 'nasdaq', 'Bono 10 años': 'bono10', 'Petróleo WTI': 'wti', 'Dólar (DXY)': 'dolar' };
  const horaNY = iso => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/New_York', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' (NY)';
  function barraEn(key, r) {
    const s = serie(key); if (!s) return null;
    let i = -1; for (let k = 0; k < s.fechas.length; k++) if (r.momento === 'apertura' ? s.fechas[k] < r.fecha : s.fechas[k] <= r.fecha) i = k;
    if (i < 1) return null;
    const ultimo = i === s.fechas.length - 1, v = ultimo && s.precio != null ? s.precio : s.cierres[i], p = s.cierres[i - 1];
    return { s, i, v, p, ultimo, cambio: key === 'bono10' ? v - p : (v / p - 1) * 100 };
  }
  function indiceReal(x, r) {
    const key = CLAVE_INDICE[x.nombre], b = key && barraEn(key, r);
    if (!b) return el('div', { class: 'indice' }, el('div', { class: 'n' }, x.nombre), el('div', { class: 'v' }, x.valor ?? 'sin dato'),
      el('div', { class: 'c ' + clase(x.cambioPct) }, x.cambio ?? ''), el('div', { class: 'fuente' }, 'Según el resumen de noticias'));
    const valor = key === 'bono10' ? num(b.v) + '%' : key === 'wti' ? num(b.v) + ' USD' : num(b.v);
    const cambio = key === 'bono10' ? `${b.cambio > 0 ? '+' : b.cambio < 0 ? '−' : ''}${num(Math.abs(b.cambio))} pp` : pct(b.cambio);
    const viejo = b.s.estado && b.s.estado !== 'ok';
    return el('div', { class: 'indice' + (viejo ? ' viejo' : ''), title: viejo ? (b.s.avisos || [])[0] : null },
      el('div', { class: 'n' }, x.nombre), el('div', { class: 'v' }, valor), el('div', { class: 'c ' + clase(b.cambio) }, cambio),
      b.i > 2 ? mini(b.s.cierres.slice(Math.max(0, b.i - 29), b.i + 1)) : null,
      el('div', { class: 'fuente' }, (viejo ? 'Desactualizado. ' : '') + 'Yahoo Finance, ' + (b.ultimo && b.s.actualizadoISO ? horaNY(b.s.actualizadoISO) : 'cierre del ' + fechaCorta(b.s.fechas[b.i]))));
  }
  function navegar(delta) { const i = datos.indexOf(actual) + delta; if (i >= 0 && i < datos.length) mostrar(datos[i], { transicion: true }); }
  function abrirResumen(r) { if (show.abierto()) show.cerrar(); mostrar(r, { transicion: true }); pestania('resumen'); scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
  async function copiar(r) {
    if (!r) return;
    const txt = [`Bolsa de Nueva York, ${fechaLarga(r.fecha)} (${momento(r).toLowerCase()})`, '', ...(r.enSegundos || []).map(x => '• ' + x), '',
      ...(r.indices || []).map(x => `${x.nombre}: ${x.valor ?? 'sin dato'} (${x.cambio ?? 'sin dato'})`)].join('\n');
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Pulso de Wall Street', text: txt });
      else { await navigator.clipboard.writeText(txt); aviso('Resumen copiado'); }
    } catch (e) { if (e.name !== 'AbortError') aviso('No se pudo copiar el resumen'); }
  }

  /* ---------- historial: calendario + lista ---------- */
  function historial() {
    const q = $('buscar').value.trim(), ql = q.toLowerCase();
    const coincide = r => !ql || JSON.stringify(r).toLowerCase().includes(ql);
    const lista = datos.filter(coincide);
    $('buscarInfo').textContent = ql ? `${lista.length} ${lista.length === 1 ? 'resumen menciona' : 'resúmenes mencionan'} “${q}”` : '';
    const porFecha = new Map();
    for (const r of datos) if (!porFecha.has(r.fecha)) porFecha.set(r.fecha, r); // datos va del más nuevo al más viejo
    const sp = serie('sp500'), ruedas = new Set(sp?.fechas || []), hoy = isoLocal(new Date());
    const anios = [...new Set(datos.map(r => r.fecha.slice(0, 4)))].sort().reverse();
    $('calendario').replaceChildren(...anios.map(a => el('div', { class: 'cal-anio' }, el('h3', {}, a),
      el('div', { class: 'cal-meses' }, MESES.map((nombre, mes) => {
        const celdas = [], dow1 = (new Date(Date.UTC(+a, mes, 1)).getUTCDay() + 6) % 7;
        if (dow1 < 5) for (let k = 0; k < dow1; k++) celdas.push(el('span', { class: 'celda vacia' }));
        for (let d = 1, fin = new Date(Date.UTC(+a, mes + 1, 0)).getUTCDate(); d <= fin; d++) {
          const dw = new Date(Date.UTC(+a, mes, d)).getUTCDay();
          if (dw === 0 || dw === 6) continue;
          const f = `${a}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, r = porFecha.get(f), hoyCl = f === hoy ? ' hoy' : '';
          if (!r) {
            const cl = FERIADOS.has(f) ? ' feriado' : f > hoy ? ' futuro' : ruedas.has(f) ? ' rueda' : '';
            celdas.push(el('span', { class: 'celda' + cl + hoyCl, title: `${fechaLarga(f)}: ${cl === ' feriado' ? 'feriado, la bolsa no abrió' : cl === ' futuro' ? 'todavía no llegó' : 'rueda sin resumen'}` }));
            continue;
          }
          const t = tono(r.tonoGeneral), cd = cambioDia(sp, f) ?? r.indices?.[0]?.cambioPct ?? null;
          const o = cd == null ? .75 : .45 + Math.min(Math.abs(cd) / 2.5, 1) * .55;
          celdas.push(el('button', { class: 'celda' + hoyCl + (coincide(r) ? '' : ' atenuada') + (actual?.id === r.id ? ' activo' : ''), 'data-id': r.id,
            style: `--c:${COLOR[t]};--o:${o.toFixed(2)}`, title: `${fechaLarga(f)}: tono ${t}${cd != null ? `, S&P 500 ${pct(cd)}` : ''}`, onclick: () => abrirResumen(r) }));
        }
        return el('div', { class: 'cal-mes' }, el('h4', {}, nombre), el('div', { class: 'cal-grilla' }, celdas));
      })))));
    if (!lista.length) { $('historial').replaceChildren(el('p', { class: 'vacio' }, ql ? `Ningún resumen menciona “${q}”. Probá con otra palabra.` : 'Todavía no hay resúmenes guardados.')); return; }
    const arbol = {};
    for (const r of lista) { const [a, m] = r.fecha.split('-'); ((arbol[a] ??= {})[m] ??= []).push(r); }
    $('historial').replaceChildren(...Object.keys(arbol).sort().reverse().map(a => el('div', { class: 'anio' }, el('h3', {}, a),
      Object.keys(arbol[a]).sort().reverse().map(m => el('div', { class: 'mes' }, el('h4', {}, MESES[+m - 1]),
        el('div', { class: 'dias' }, arbol[a][m].map(r => el('button', { class: 'dia' + (actual?.id === r.id ? ' activo' : ''), 'data-id': r.id, onclick: () => abrirResumen(r) },
          el('div', { class: 'f' }, fechaLarga(r.fecha)),
          el('div', { class: 'm' }, el('span', {}, `${momento(r)}, ${r.hora}`), el('span', { class: 't-' + tono(r.tonoGeneral) }, tono(r.tonoGeneral)))))))))));
  }

  /* ---------- gráfico de líneas con períodos, cursor y marcas de noticias ---------- */
  const RANGOS = [['1M', 21], ['3M', 63], ['6M', 126], ['1A', Infinity]];
  function promedioMovil(c, n) { const out = new Array(c.length).fill(null); let s = 0; for (let i = 0; i < c.length; i++) { s += c[i]; if (i >= n) s -= c[i - n]; if (i >= n - 1) out[i] = s / n; } return out; }
  // Series de indicadores para dibujar (mismas fórmulas que cuant.mjs, probadas en cuant.test.mjs)
  function emaSerie(c, n) {
    const out = new Array(c.length).fill(null), k = 2 / (n + 1); if (c.length < n) return out;
    out[n - 1] = c.slice(0, n).reduce((a, b) => a + b, 0) / n;
    for (let i = n; i < c.length; i++) out[i] = c[i] * k + out[i - 1] * (1 - k);
    return out;
  }
  function rsiSerie(c, n = 14) {
    const out = new Array(c.length).fill(null); if (c.length <= n) return out;
    let g = 0, p = 0; for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; d > 0 ? g += d : p -= d; }
    g /= n; p /= n;
    const val = () => p === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / p);
    out[n] = val();
    for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; p = (p * (n - 1) + Math.max(-d, 0)) / n; out[i] = val(); }
    return out;
  }
  function bollSerie(c, n = 20, k = 2) {
    const sup = [], inf = [];
    for (let i = 0; i < c.length; i++) {
      if (i < n - 1) { sup.push(null); inf.push(null); continue; }
      const v = c.slice(i - n + 1, i + 1), m = v.reduce((a, b) => a + b, 0) / n, d = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / n);
      sup.push(m + k * d); inf.push(m - k * d);
    }
    return { sup, inf };
  }
  function macdSerie(c) {
    const a = emaSerie(c, 12), b = emaSerie(c, 26), linea = c.map((_, i) => a[i] != null && b[i] != null ? a[i] - b[i] : null);
    const desde = linea.findIndex(v => v != null), sen = new Array(c.length).fill(null);
    if (desde >= 0) emaSerie(linea.slice(desde), 9).forEach((v, i) => { sen[desde + i] = v; });
    return { linea, senal: sen, hist: linea.map((v, i) => v != null && sen[i] != null ? v - sen[i] : null) };
  }
  const CAPAS = [['m20', 'Media 20', '#A78BFA'], ['m50', 'Media 50', '#E4EAFF'], ['m200', 'Media 200', '#F5C451'], ['boll', 'Bollinger'], ['vol', 'Volumen'], ['rsi', 'RSI'], ['macd', 'MACD']];
  function grafico(destino, s, op) {
    let rango = op.rango || '3M', ultAncho = 0;
    const media = promedioMovil(s.cierres, 50);
    const conCapas = !!(op.indicadores && s.previos?.length), capas = new Set(leer('capas', ['m50']));
    const botones = el('div', { class: 'rangos', role: 'group', 'aria-label': 'Período del gráfico' });
    const lienzo = el('div', { class: 'lienzo' }), leyenda = el('div', { class: 'leyenda' }), sub = el('div', { class: 'subgraficos' });
    for (const [k] of s.semanal ? [...RANGOS, ['5A']] : RANGOS) botones.append(el('button', { 'aria-pressed': String(k === rango), onclick: e => {
      rango = k; for (const b of botones.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); dibujar();
    } }, k));
    const selCapas = conCapas ? el('div', { class: 'capas', role: 'group', 'aria-label': 'Indicadores dibujados en el gráfico' },
      CAPAS.filter(([k]) => k !== 'vol' || s.volumenes?.some(v => v > 0)).map(([k, t]) => el('button', { class: 'chip', 'aria-pressed': String(capas.has(k)), onclick: e => {
        capas.has(k) ? capas.delete(k) : capas.add(k); guardar('capas', [...capas]); e.currentTarget.setAttribute('aria-pressed', String(capas.has(k))); dibujar();
      } }, t))) : null;
    destino.replaceChildren(...[botones, selCapas, lienzo, sub, leyenda].filter(Boolean));
    destino._ro?.disconnect();
    destino._ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w && w !== ultAncho) { ultAncho = w; requestAnimationFrame(dibujar); } }); // en el cuadro siguiente, para no encadenar avisos de tamaño
    destino._ro.observe(lienzo);
    function dibujar() {
      const ancho = lienzo.clientWidth; if (!ancho) return;
      const sem = rango === '5A' && s.semanal, base = sem ? s.semanal : s; // 5 años: un punto por semana
      const N = sem ? base.cierres.length : Math.min(s.cierres.length, RANGOS.find(r => r[0] === rango)[1]), off = base.cierres.length - N;
      const c = base.cierres.slice(off), f = base.fechas.slice(off), m = (sem ? promedioMovil(base.cierres, 40) : media).slice(off);
      const W = 800, H = ancho < 560 ? 480 : 260, P = 10, k = W / ancho;
      // capas de indicadores: se calculan con 200 cierres previos para que las medias existan desde el inicio del gráfico
      const ind = conCapas && !sem, ext = ind ? s.previos.concat(s.cierres) : null, corte = arr => arr.slice(arr.length - N);
      const lineas = ind ? CAPAS.filter(([q, , col]) => col && capas.has(q)).map(([q, t, col]) => ({ v: corte(promedioMovil(ext, +q.slice(1))), col, t })) : [];
      const bb = ind && capas.has('boll') ? (b => ({ sup: corte(b.sup), inf: corte(b.inf) }))(bollSerie(ext)) : null;
      const todos = c.concat(ind ? [] : m.filter(v => v != null), ...lineas.map(l => l.v.filter(v => v != null)), bb ? bb.sup.concat(bb.inf).filter(v => v != null) : []);
      const min = Math.min(...todos), max = Math.max(...todos);
      const x = i => P + (N > 1 ? i / (N - 1) : .5) * (W - 2 * P), y = v => H - P - (v - min) / (max - min || 1) * (H - 2 * P);
      const linea = arr => { let d = '', pluma = false; arr.forEach((v, i) => { if (v == null) { pluma = false; return; } d += (pluma ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pluma = true; }); return d; };
      const color = c.at(-1) >= c[0] ? COLOR.positivo : COLOR.negativo, gid = 'g' + Math.random().toString(36).slice(2, 9);
      const sv = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0',
        'aria-label': `${op.titulo}: de ${num(c[0])} a ${num(c.at(-1))} ${op.unidad} entre el ${fechaCorta(f[0], true)} y el ${fechaCorta(f.at(-1), true)}. Con las flechas recorrés los días.` });
      const defs = svg('defs'), grad = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.append(svg('stop', { offset: 0, 'stop-color': color, 'stop-opacity': .28 }), svg('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }));
      defs.append(grad); sv.append(defs);
      for (const v of [min, (min + max) / 2, max]) sv.append(svg('line', { x1: P, x2: W - P, y1: y(v), y2: y(v), stroke: '#26306B', 'stroke-dasharray': '2 6', 'vector-effect': 'non-scaling-stroke' }));
      sv.append(svg('path', { d: linea(c) + `L${x(N - 1)},${H - P}L${x(0)},${H - P}Z`, fill: `url(#${gid})` }));
      if (bb) { // banda entre la línea de arriba y la de abajo
        const i0 = bb.sup.findIndex(v => v != null), idx = [...bb.inf.keys()].slice(i0).reverse();
        sv.append(svg('path', { d: linea(bb.sup) + idx.map(i => `L${x(i).toFixed(1)},${y(bb.inf[i]).toFixed(1)}`).join('') + 'Z', fill: '#60A5FA', 'fill-opacity': .08 }),
          svg('path', { d: linea(bb.sup), fill: 'none', stroke: '#60A5FA', 'stroke-opacity': .55, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }),
          svg('path', { d: linea(bb.inf), fill: 'none', stroke: '#60A5FA', 'stroke-opacity': .55, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }));
      }
      if (!ind) sv.append(svg('path', { d: linea(m), fill: 'none', stroke: '#E4EAFF', 'stroke-opacity': .35, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
      for (const l of lineas) sv.append(svg('path', { d: linea(l.v), fill: 'none', stroke: l.col, 'stroke-opacity': l.col === '#E4EAFF' ? .45 : .8, 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke' }));
      sv.append(svg('path', { d: linea(c), fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }),
        svg('circle', { cx: x(N - 1), cy: y(c.at(-1)), r: 4 * k, fill: color }));
      const guia = svg('line', { y1: P, y2: H - P, stroke: '#E4EAFF', 'stroke-opacity': .45, 'stroke-dasharray': '3 4', 'vector-effect': 'non-scaling-stroke', visibility: 'hidden' });
      const bola = svg('circle', { r: 5 * k, fill: color, stroke: '#070B24', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', visibility: 'hidden' });
      sv.append(guia, bola);
      const tip = el('div', { class: 'tip', hidden: true, 'aria-live': 'polite' });
      let cursor = N - 1;
      const verTip = (i, texto) => {
        cursor = i;
        for (const [a, v] of [['x1', x(i)], ['x2', x(i)]]) guia.setAttribute(a, v);
        bola.setAttribute('cx', x(i)); bola.setAttribute('cy', y(c[i]));
        guia.setAttribute('visibility', 'visible'); bola.setAttribute('visibility', 'visible');
        tip.replaceChildren(el('small', {}, fechaCorta(f[i], true)), `${num(c[i])} ${op.unidad}`, el('small', {}, texto || `${pct((c[i] / c[0] - 1) * 100, 1)} desde el inicio del gráfico`));
        tip.hidden = false;
        tip.style.left = Math.max(90, Math.min(ancho - 90, x(i) / W * ancho)) + 'px';
        tip.style.top = y(c[i]) / W * ancho + 'px';
      };
      const ocultar = () => { tip.hidden = true; guia.setAttribute('visibility', 'hidden'); bola.setAttribute('visibility', 'hidden'); };
      const capa = svg('g');
      let hayMarcas = false;
      for (const mk of op.marcas || []) {
        if (mk.fecha < f[0]) continue;
        let j = -1; for (let q = 0; q < N && f[q] <= mk.fecha; q++) j = q;
        if (j < 0) continue;
        hayMarcas = true;
        const g = svg('g', { class: 'marcador', tabindex: '0', role: 'button', 'aria-label': mk.etiqueta });
        g.append(svg('circle', { cx: x(j), cy: y(c[j]), r: 13 * k, fill: 'transparent' }),
          svg('circle', { class: 'm-punto', cx: x(j), cy: y(c[j]), r: 5.5 * k, fill: COLOR[mk.tono], stroke: '#070B24', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
        g.addEventListener('click', mk.accion);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mk.accion(); } });
        g.addEventListener('pointerenter', () => verTip(j, mk.etiqueta));
        g.addEventListener('focus', () => verTip(j, mk.etiqueta));
        capa.append(g);
      }
      sv.append(capa);
      sv.addEventListener('pointermove', e => {
        if (e.target.closest('.marcador')) return;
        const r = sv.getBoundingClientRect();
        verTip(Math.max(0, Math.min(N - 1, Math.round(((e.clientX - r.left) / r.width * W - P) / (W - 2 * P) * (N - 1)))));
      });
      sv.addEventListener('pointerleave', ocultar);
      sv.addEventListener('keydown', e => {
        if (e.target !== sv || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        verTip(Math.max(0, Math.min(N - 1, cursor + (e.key === 'ArrowLeft' ? -1 : 1))));
      });
      sv.addEventListener('focusout', e => { if (!sv.contains(e.relatedTarget)) ocultar(); });
      lienzo.replaceChildren(sv, tip);
      // paneles de abajo: volumen, RSI y MACD del mismo período
      const panelSub = (titulo, valor, dibujo, alto = ancho < 560 ? 150 : 70) => {
        const ps = svg('svg', { viewBox: `0 0 ${W} ${alto}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `${titulo}: ${valor}` });
        dibujo(ps, alto);
        return el('div', { class: 'subgrafico' }, el('div', { class: 'sub-cab' }, el('span', {}, titulo), el('b', {}, valor)), ps);
      };
      const subs = [];
      if (ind && capas.has('vol') && s.volumenes?.some(v => v > 0)) {
        const vs = corte(s.volumenes), mx = Math.max(...vs.filter(v => v > 0)), bw = Math.max(1, (W - 2 * P) / N * .7);
        subs.push(panelSub('Volumen', `${(vs.at(-1) || 0).toLocaleString('es-AR')} acciones`, (ps, h) => vs.forEach((v, i) => { if (v > 0) ps.append(svg('rect', { x: x(i) - bw / 2, y: h - v / mx * (h - 4), width: bw, height: v / mx * (h - 4), fill: i && c[i] < c[i - 1] ? COLOR.negativo : COLOR.positivo, 'fill-opacity': .55 })); })));
      }
      if (ind && capas.has('rsi')) {
        const r = corte(rsiSerie(ext));
        subs.push(panelSub('RSI 14', num(r.at(-1), 1), (ps, h) => {
          const yy = v => h - 2 - v / 100 * (h - 4);
          for (const v of [30, 70]) ps.append(svg('line', { x1: P, x2: W - P, y1: yy(v), y2: yy(v), stroke: '#8E9AD0', 'stroke-opacity': .5, 'stroke-dasharray': '3 5', 'vector-effect': 'non-scaling-stroke' }));
          ps.append(svg('path', { d: r.map((v, i) => v == null ? '' : `${i && r[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${yy(v).toFixed(1)}`).join(''), fill: 'none', stroke: '#A78BFA', 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke' }));
        }));
      }
      if (ind && capas.has('macd')) {
        const mc = macdSerie(ext), li = corte(mc.linea), se = corte(mc.senal), hi = corte(mc.hist);
        const vals = [...li, ...se, ...hi].filter(v => v != null), lo = Math.min(...vals, 0), hi2 = Math.max(...vals, 0);
        subs.push(panelSub('MACD (12, 26, 9)', `${num(li.at(-1))} / señal ${num(se.at(-1))}`, (ps, h) => {
          const yy = v => h - 2 - (v - lo) / (hi2 - lo || 1) * (h - 4), bw = Math.max(1, (W - 2 * P) / N * .7);
          ps.append(svg('line', { x1: P, x2: W - P, y1: yy(0), y2: yy(0), stroke: '#8E9AD0', 'stroke-opacity': .4, 'vector-effect': 'non-scaling-stroke' }));
          hi.forEach((v, i) => { if (v != null) ps.append(svg('rect', { x: x(i) - bw / 2, y: Math.min(yy(v), yy(0)), width: bw, height: Math.abs(yy(v) - yy(0)), fill: v >= 0 ? COLOR.positivo : COLOR.negativo, 'fill-opacity': .45 })); });
          for (const [serieM, col] of [[li, '#E4EAFF'], [se, '#F5C451']]) ps.append(svg('path', { d: serieM.map((v, i) => v == null ? '' : `${i && serieM[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${yy(v).toFixed(1)}`).join(''), fill: 'none', stroke: col, 'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke' }));
        }));
      }
      sub.replaceChildren(...subs);
      leyenda.replaceChildren(...[
        el('span', { style: `--c:${color}` }, `${op.titulo}, cierre ${sem ? 'semanal' : 'diario'}`),
        ...(ind ? lineas.map(l => el('span', { style: `--c:${l.col}` }, l.t)) : [el('span', { style: '--c:#E4EAFF59' }, sem ? 'Promedio de 40 semanas' : 'Promedio de 50 días')]),
        bb ? el('span', { style: '--c:#60A5FA' }, 'Bandas de Bollinger (20, 2)') : null,
        conCapas && sem ? el('span', { class: 'ley-nota' }, 'Los indicadores se dibujan en los períodos de hasta 1 año') : null,
        hayMarcas && el('span', { class: 'ley-marca' }, op.leyendaMarcas),
        el('span', { class: 'ley-nota' }, `Mín. ${num(Math.min(...c))}, máx. ${num(Math.max(...c))}`)].filter(Boolean));
    }
  }

  /* ---------- tendencias (todo el historial) ---------- */
  let diasT = leer('horizonte', 90);
  function porDia() { const m = new Map(); for (const r of datos) if (!m.has(r.fecha)) m.set(r.fecha, r); return [...m.values()]; }
  function graficoTendencias() {
    const sp = serie('sp500');
    $('tendGraficoBloque').hidden = !sp;
    if (!sp) return;
    grafico($('tendGrafico'), sp, { titulo: 'S&P 500', unidad: 'puntos', rango: '3M', leyendaMarcas: 'Días con resumen, del color de su tono', indicadores: true,
      marcas: porDia().map(r => ({ fecha: r.fecha, tono: tono(r.tonoGeneral), etiqueta: `${fechaCorta(r.fecha)}: tono ${tono(r.tonoGeneral)}. Tocá para abrirlo`, accion: () => abrirResumen(r) })) });
  }
  function tendencias() {
    document.querySelectorAll('.horizontes button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.dias === diasT)));
    if (!datos.length) { $('tendencias').replaceChildren(el('p', { class: 'vacio' }, 'Las tendencias aparecen cuando haya resúmenes guardados.')); $('tendStats').replaceChildren(); $('temas').replaceChildren(); return; }
    const desde = diasT ? sumarDias(datos[0].fecha, -(diasT - 1)) : '';
    const ventana = datos.filter(r => r.fecha >= desde);
    const noticias = ventana.flatMap(r => r.noticias || []), posN = noticias.filter(n => tono(n.tono) === 'positivo').length;
    const stats = [stat('Noticias positivas', noticias.length ? Math.round(posN / noticias.length * 100) + '%' : '—', `${posN} de ${noticias.length} noticias en ${ventana.length} ${ventana.length === 1 ? 'resumen' : 'resúmenes'}`)];
    const sp = serie('sp500');
    if (sp) {
      const c = sp.cierres, desdeSp = diasT ? sumarDias(sp.fechas.at(-1), -(diasT - 1)) : sp.fechas[0];
      const i0 = Math.max(1, sp.fechas.findIndex(f => f >= desdeSp));
      let alza = 0; for (let i = i0; i < c.length; i++) if (c[i] > c[i - 1]) alza++;
      const sube = c.at(-1) >= c.at(-2); let racha = 0;
      for (let i = c.length - 1; i > 0 && (c[i] >= c[i - 1]) === sube; i--) racha++;
      const v = (c.at(-1) / c[i0 - 1] - 1) * 100;
      stats.push(stat('S&P 500 en el período', pct(v, 1), `desde el ${fechaCorta(sp.fechas[i0 - 1], true)}`, clase(v)),
        stat('Ruedas en alza', `${alza} de ${c.length - i0}`, 'días de bolsa en que el S&P 500 subió'),
        stat('Racha actual', `${racha} ${racha === 1 ? 'rueda' : 'ruedas'}`, sube ? 'seguidas en alza' : 'seguidas en baja', sube ? 'sube' : 'baja'));
    }
    $('tendStats').replaceChildren(...stats);
    const cuenta = {};
    for (const r of [...ventana].reverse()) for (const s of r.sectores || []) {
      const c = cuenta[s.sector] ??= { p: 0, x: 0, n: 0, hist: [] }, t = tono(s.tono);
      c[t === 'positivo' ? 'p' : t === 'negativo' ? 'n' : 'x']++; c.hist.push([r.fecha, t]);
    }
    const filas = Object.entries(cuenta).map(([s, c]) => ({ s, ...c, tot: c.p + c.x + c.n })).sort((a, b) => b.p / b.tot - a.p / a.tot || b.tot - a.tot);
    $('tendencias').replaceChildren(
      ...(ventana.length < 10 ? [el('p', { class: 'nota' }, `Con ${ventana.length} ${ventana.length === 1 ? 'resumen' : 'resúmenes'} el porcentaje todavía cambia mucho de un día al otro.`)] : []),
      ...filas.map(f => {
        const pc = k => f[k] / f.tot * 100;
        return el('div', { class: 'barra-fila' }, el('span', { class: 'nom' }, f.s),
          el('div', { class: 'barra', role: 'img', 'aria-label': `${Math.round(pc('p'))}% positivo, ${Math.round(pc('x'))}% mixto, ${Math.round(pc('n'))}% negativo` }, ['p', 'x', 'n'].map(k => el('i', { class: k, style: `width:${pc(k)}%` }))),
          el('span', { class: 'pct' }, Math.round(pc('p')) + '%', el('small', {}, `${f.tot} ${f.tot === 1 ? 'mención' : 'menciones'}`)),
          el('div', { class: 'puntos', 'aria-hidden': 'true' }, f.hist.slice(-36).map(([d, t]) => el('i', { style: `--c:${COLOR[t]}`, title: `${fechaCorta(d)}: ${t}` }))));
      }));
    const temas = {};
    for (const r of ventana) for (const n of r.noticias || []) for (const a of n.afecta || []) { const k = String(a).trim(); if (k && !/^todo el mercado$/i.test(k)) temas[k] = (temas[k] || 0) + 1; }
    const top = Object.entries(temas).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 18);
    $('temas').replaceChildren(...(top.length ? top.map(([k, n]) => el('button', { class: 'chip', onclick: () => { pestania('historial'); $('buscar').value = k; historial(); $('buscar').focus(); } }, k, el('b', {}, String(n))))
      : [el('p', { class: 'nota' }, 'Todavía no hay temas en este plazo.')]));
  }

  /* ---------- ranking, mapa, detalle y favoritas ---------- */
  let orden = { k: 'estabilidad', dir: -1 }, sectorSel = '', soloFav = false, vista = leer('vista', 'tabla'), elegida = null, modo = leer('modoRanking', 'estable');
  const MODOS = {
    estable: { k: 'estabilidad', puesto: 'puestoEst', col: 'Estabilidad', titulo: 'Ranking por estabilidad histórica',
      texto: 'Las 100 empresas más grandes del S&P 500, ordenadas según cuánto se movió y cuánto llegó a caer su acción en el último año. 100 es la más estable del grupo. Mide el pasado: no predice el futuro ni dice qué comprar.' },
    riesgo: { k: 'agresivo', puesto: 'puestoAgr', col: 'Riesgo y crec.', titulo: 'Ranking de más riesgo y más crecimiento',
      texto: 'Las mismas 100 empresas, ordenadas según cuánto subió su acción en el último año y cuántos sacudones tuvo en el camino. 100 es la que más creció con más movimiento. Es el pasado: lo que más subió también puede caer fuerte, y nada de esto predice el futuro ni dice qué comprar.' },
    historico: { k: 'riesgo', puesto: 'puestoRie', col: 'Riesgo hist.', titulo: 'Ranking de riesgo histórico',
      texto: 'Las mismas 100 empresas, ordenadas por cuánto riesgo mostraron: volatilidad del último año, peor caída de los últimos 5 años y beta frente al S&P 500. 100 es la de más riesgo histórico del grupo. Describe el pasado, no anticipa el futuro.' }
  };
  function aplicarModo() {
    const m = MODOS[modo];
    $('rankTitulo').textContent = m.titulo; $('rankTexto').textContent = m.texto;
    $('thPuntajeTxt').textContent = m.col; $('thPuntaje').dataset.k = m.k;
    document.querySelectorAll('[data-modo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === modo)));
    $('vistaTabla').classList.toggle('modo-riesgo', modo !== 'estable');
    orden = { k: m.k, dir: -1 };
  }
  if (!MODOS[modo]) modo = 'estable';
  const ASC = new Set(['nombre', 'volatilidad', 'caidaMax', 'beta']);
  function barraEstab(v) { return el('div', { class: 'barra' }, el('i', { style: `width:${v}%` })); }
  function estrella(a) {
    return el('button', { class: 'estrella', 'data-tk': a.ticker, 'aria-pressed': String(favs.has(a.ticker)), 'aria-label': `Seguir ${a.nombre}`,
      onclick: e => { e.stopPropagation(); alternarFav(a.ticker); } }, ico('estrella'));
  }
  function armarFiltros() {
    const sectores = [...new Set((acc?.lista || []).map(a => a.sector))].sort((a, b) => a.localeCompare(b, 'es'));
    $('filtroSectores').replaceChildren(...['', ...sectores].map(s => el('button', { class: 'chip', 'data-sector': s, 'aria-pressed': String(s === sectorSel), onclick: () => {
      sectorSel = s; document.querySelectorAll('[data-sector]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sector === s))); ranking();
    } }, s || 'Todos')));
  }
  // Precio antes de la apertura o después del cierre (extendido.js), solo si es posterior al último precio normal
  const SESION = { pre: 'Antes de la apertura', post: 'Después del cierre' };
  function extendido(a) { const x = window.EXTENDIDO?.porTicker?.[a.ticker]; return x && Date.parse(x.hora) > Date.parse(a.actualizadoISO || 0) ? x : null; }
  function ranking() {
    const todas = acc?.lista || [];
    $('rankingSinDatos').hidden = todas.length > 0;
    $('rankingCuerpo').hidden = !todas.length;
    if (!todas.length) return;
    const q = $('buscarEmpresa').value.trim().toLowerCase();
    const lista = todas.filter(a => (!sectorSel || a.sector === sectorSel) && (!soloFav || favs.has(a.ticker)) && (!q || a.nombre.toLowerCase().includes(q) || a.ticker.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (orden.k === 'nombre') return a.nombre.localeCompare(b.nombre, 'es') * orden.dir;
        const va = a[orden.k], vb = b[orden.k];
        if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1; // sin dato siempre al final
        return (va - vb) * orden.dir;
      });
    document.querySelectorAll('#rankingCab th[data-k]').forEach(th => th.setAttribute('aria-sort', th.dataset.k === orden.k ? (orden.dir === 1 ? 'ascending' : 'descending') : 'none'));
    document.querySelectorAll('[data-vista]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vista === vista)));
    $('soloFav').setAttribute('aria-pressed', String(soloFav));
    $('vistaTabla').hidden = vista !== 'tabla' || !lista.length;
    $('vistaMapa').hidden = vista !== 'mapa' || !lista.length;
    $('rankingVacio').hidden = lista.length > 0;
    $('rankingVacio').textContent = soloFav && !favs.size ? 'Todavía no marcaste favoritas. Tocá la estrella de una empresa para seguirla.' : 'Ninguna empresa coincide con la búsqueda.';
    if (vista === 'tabla') {
      $('ranking').replaceChildren(...lista.map(a => {
        const tr = el('tr', { tabindex: '0', 'data-tk': a.ticker, class: a.ticker === elegida ? 'activo' : null, onclick: () => elegir(a.ticker, true),
          onkeydown: e => { if (e.target === tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); elegir(a.ticker, true); } } },
          el('td', {}, estrella(a)),
          el('td', { class: 'num' }, String(a[MODOS[modo].puesto])),
          el('td', { class: 'emp', title: a.sector }, a.nombre, el('span', { class: 'tk' }, a.ticker)),
          (x => el('td', { class: 'num' }, num(a.precio), x ? el('span', { class: 'ext ' + clase(x.cambioPct), title: `${SESION[x.sesion]}: ${num(x.precio)} USD, ${horaNY(x.hora)}` },
            (x.sesion === 'pre' ? 'pre ' : 'post ') + pct(x.cambioPct)) : null))(extendido(a)),
          el('td', { class: 'num ' + clase(a.cambio1d) }, pct(a.cambio1d)),
          el('td', { class: 'num opc ' + clase(a.retorno1a) }, pct(a.retorno1a, 1)),
          el('td', {}, el('div', { class: 'estab' }, barraEstab(a[MODOS[modo].k] ?? 0), el('b', {}, String(a[MODOS[modo].k] ?? '—')))),
          el('td', { class: 'num opc' }, num(a.volatilidad, 1) + '%'),
          el('td', { class: 'num opc baja' }, '−' + num(a.caidaMax, 1) + '%'),
          el('td', { class: 'num opc opc3 ' + clase(a.ret3a) }, a.ret3a == null ? 'sin dato' : pct(a.ret3a, 0)),
          el('td', { class: 'num opc opc3' }, a.sharpe == null ? 'sin dato' : num(a.sharpe)),
          el('td', { class: 'num opc opc3' }, a.beta == null ? 'sin dato' : num(a.beta)),
          el('td', { class: 'num opc opc3 ' + clase(a.relSP) }, a.relSP == null ? 'sin dato' : pct(a.relSP, 1)));
        return tr;
      }));
    } else {
      const grupos = {};
      for (const a of lista) (grupos[a.sector] ??= []).push(a);
      $('vistaMapa').replaceChildren(...Object.entries(grupos).sort((a, b) => b[1].length - a[1].length).map(([s, as]) => {
        const prom = as.reduce((t, a) => t + a.cambio1d, 0) / as.length;
        return el('section', { class: 'mapa-sector' }, el('h3', {}, s, el('span', { class: clase(prom) }, `${pct(prom)} en promedio`)),
          el('div', { class: 'mosaico' }, [...as].sort((a, b) => b.cambio1d - a.cambio1d).map(a => {
            const m = Math.min(Math.abs(a.cambio1d) / 3, 1);
            return el('button', { class: 'tesela' + (m > .5 ? ' oscura' : ''), style: `--c:${a.cambio1d >= 0 ? COLOR.positivo : COLOR.negativo};--m:${Math.round(14 + m * 72)}%`,
              title: `${a.nombre}: ${pct(a.cambio1d)} en la última rueda`, onclick: () => elegir(a.ticker, true) }, el('b', {}, a.ticker), el('span', {}, pct(a.cambio1d)));
          })));
      }));
    }
    $('rankingFecha').textContent = `Precios de Yahoo Finance actualizados el ${new Date(acc.actualizado).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}. "Día" es la variación de la última rueda; debajo del precio, "pre" o "post" es cuánto se movió antes de la apertura o después del cierre. Volatilidad: cuánto se mueve el precio en un año típico. Peor caída: la mayor baja desde un máximo en el último año.`;
  }
  function menciones(a) {
    const rxs = (a.claves || [a.ticker]).map(k => new RegExp(`(^|[^${LETRA}])${esc(k)}(?![${LETRA}])`, k.length > 5 ? 'i' : ''));
    const out = [];
    for (const r of datos) for (const n of r.noticias || []) if (rxs.some(rx => rx.test([n.titulo, n.resumen, ...(n.afecta || [])].join(' | ')))) out.push({ r, n });
    return out;
  }
  function detalle(a) {
    const ments = menciones(a), maxA = Math.max(...a.cierres), dist = (a.precio / maxA - 1) * 100;
    let p = 0, t = 0;
    for (const r of datos) for (const s of r.sectores || []) if (s.sector === a.sector) { t++; if (tono(s.tono) === 'positivo') p++; }
    const caja = el('div');
    $('detalle').replaceChildren(
      el('div', { class: 'det-cab' },
        el('div', {}, el('h3', {}, a.nombre), el('div', { class: 'det-sub' }, el('span', {}, a.ticker), el('span', {}, a.sector), estrella(a))),
        el('div', { class: 'det-precio' }, el('b', {}, num(a.precio) + ' USD'), el('span', { class: clase(a.cambio1d) }, `${pct(a.cambio1d)} en la última rueda`),
          (x => x ? el('div', { class: 'det-ext' }, `${SESION[x.sesion]}: `, el('b', {}, num(x.precio) + ' USD'), ' ', el('span', { class: clase(x.cambioPct) }, pct(x.cambioPct)),
            el('small', {}, horaNY(x.hora) + '. Opera poca gente: puede cambiar mucho en la apertura.')) : null)(extendido(a)))),
      el('div', { class: 'det-stats' },
        stat('Estabilidad', `${a.estabilidad} de 100`, `puesto ${a.puestoEst} de ${acc.lista.length}`),
        a.agresivo != null ? stat('Riesgo y crecimiento', `${a.agresivo} de 100`, `puesto ${a.puestoAgr} de ${acc.lista.length}`) : null,
        stat('Último año', pct(a.retorno1a, 1), 'variación del precio', clase(a.retorno1a)),
        stat('Volatilidad', num(a.volatilidad, 1) + '%', 'movimiento típico en un año'),
        stat('Peor caída', '−' + num(a.caidaMax, 1) + '%', 'desde un máximo, en el año', 'baja'),
        stat('Contra su máximo', pct(dist, 1), `máximo del año: ${num(maxA)} USD`, clase(dist))),
      el('p', { class: 'nota frescura' + (a.estado && a.estado !== 'ok' ? ' viejo' : '') }, (a.estado && a.estado !== 'ok' ? 'Dato desactualizado: ' + ((a.avisos || [])[0] || '') + '. ' : '') +
        `Precio de ${a.fuente || 'Yahoo Finance'}${a.actualizadoISO ? ', ' + horaNY(a.actualizadoISO) : ''}. Puede tener unos minutos de demora.`),
      a.ret ? el('div', { class: 'rets' }, [['d1', '1 día'], ['s1', '1 semana'], ['m1', '1 mes'], ['m3', '3 meses'], ['m6', '6 meses'], ['a1', '1 año'], ['a3', '3 años'], ['a5', '5 años']]
        .map(([k, t]) => el('div', {}, el('span', {}, t), el('b', { class: clase(a.ret[k]) }, a.ret[k] == null ? 'sin dato' : pct(a.ret[k], 1))))) : null,
      el('div', { class: 'det-acciones' }, ...(window.Pulso?.accionesEmpresa || []).map(f => f(a))),
      caja,
      a.rsi != null ? indicadores(a) : null,
      ...(window.Pulso?.seccionesEmpresa || []).map(f => { try { return f(a); } catch (e) { console.error('Pulso:', e); return null; } }).filter(Boolean),
      el('div', { class: 'det-pie' },
        el('h4', {}, ments.length ? `En tus resúmenes (${ments.length})` : 'En tus resúmenes'),
        ments.length ? el('ul', { class: 'det-noticias' }, ments.slice(0, 6).map(({ r, n }) => el('li', {}, el('button', { onclick: () => abrirResumen(r) },
          el('span', { class: 'punto t-' + tono(n.tono), 'aria-hidden': 'true' }), el('span', { class: 'f' }, fechaCorta(r.fecha)), el('span', {}, n.titulo),
          (() => { const cd = cambioDia(a, r.fecha); return el('span', { class: 'num ' + clase(cd), title: 'Variación de la acción ese día' }, cd == null ? '' : pct(cd, 1)); })()))))
          : el('p', { class: 'nota' }, 'Todavía no aparece en las noticias de tus resúmenes.'),
        t ? el('p', { class: 'nota' }, `Noticias de ${a.sector} en todo tu historial: ${Math.round(p / t * 100)}% positivas, sobre ${t} ${t === 1 ? 'mención' : 'menciones'}.`) : null));
    const vistas = new Set(), marcas = [];
    for (const { r, n } of ments) if (!vistas.has(r.fecha)) { vistas.add(r.fecha); marcas.push({ fecha: r.fecha, tono: tono(n.tono), etiqueta: `${fechaCorta(r.fecha)}: ${n.titulo}`, accion: () => abrirResumen(r) }); }
    grafico(caja, a, { titulo: a.ticker, unidad: 'USD', rango: '6M', marcas, leyendaMarcas: 'Días en que salió en tus resúmenes', indicadores: true });
  }
  const EXPLICA = {
    rsi: 'RSI de 14 ruedas: compara las subas y bajas recientes en una escala de 0 a 100. Por convención, más de 70 se llama sobrecompra y menos de 30 sobreventa. Describe lo que pasó, no predice el próximo movimiento.',
    macd: 'MACD: media exponencial de 12 ruedas menos la de 26. La señal es la media de 9 ruedas del MACD. Si el MACD está arriba de la señal, el impulso reciente fue al alza.',
    atr: 'ATR de 14 ruedas: cuánto se mueve el precio en un día típico, contando también los saltos entre un cierre y la apertura siguiente.',
    boll: 'Bandas de Bollinger: media de 20 ruedas más y menos 2 desvíos. %B indica dónde está el precio: 0 es la banda de abajo, 1 la de arriba.',
    sma: 'Medias móviles: promedio de los cierres de las últimas 20, 50, 100 y 200 ruedas. Mucha gente mira si el precio está arriba o abajo de la de 200 para describir la tendencia de largo plazo.',
    beta: 'Beta: cuánto se movió la acción, en promedio, cuando el S&P 500 se movió 1% en el último año. 1 es igual que el mercado, 2 es el doble y menos de 1 es más tranquila.',
    sharpe: 'Sharpe: (rendimiento del último año menos la tasa de la letra del Tesoro a 13 semanas) dividido la volatilidad del año. Más alto quiere decir más rendimiento por unidad de riesgo, en el pasado.',
    corr: 'Correlación con el S&P 500: de −1 a 1, cuánto se movieron juntos día a día. Se compara el último año con las últimas 60 ruedas.',
    vol: 'Volumen relativo: acciones negociadas en la última rueda dividido el promedio de las 20 ruedas anteriores. Más de 2 es un volumen poco habitual.',
    rango: 'Rango de 52 semanas: el precio más bajo y el más alto del último año, y dónde está hoy.'
  };
  const termino = (texto, k) => el('dfn', { class: 'term', tabindex: '0', 'data-def': EXPLICA[k], 'aria-label': `${texto}: ${EXPLICA[k]}` }, texto);
  function indicadores(a) {
    const rsiLect = a.rsi >= 70 ? 'zona que por convención se llama sobrecompra' : a.rsi <= 30 ? 'zona que por convención se llama sobreventa' : 'zona intermedia';
    const sobre = n => a.sma?.[n] != null ? el('li', {}, `Media de ${n}: ${num(a.sma[n])} `, el('b', { class: clase(a.precio - a.sma[n]) }, `${pct((a.precio / a.sma[n] - 1) * 100, 1)}`)) : null;
    const pos = a.max52 > a.min52 ? (a.precio - a.min52) / (a.max52 - a.min52) * 100 : 50;
    return el('section', { class: 'indicadores', 'aria-label': 'Indicadores técnicos' },
      el('h4', {}, 'Indicadores técnicos y de riesgo'),
      el('p', { class: 'nota' }, 'Calculados con los cierres diarios reales de los últimos 5 años. Describen el pasado reciente: no son señales de compra o venta ni garantizan nada.'),
      el('div', { class: 'det-stats' },
        stat(termino('RSI (14)', 'rsi'), num(a.rsi, 1), rsiLect),
        a.macd ? stat(termino('MACD', 'macd'), num(a.macd.linea), `señal ${num(a.macd.senal)}: ${a.macd.hist >= 0 ? 'arriba de la señal' : 'debajo de la señal'}`, clase(a.macd.hist)) : null,
        a.atr != null ? stat(termino('ATR (14)', 'atr'), num(a.atr) + ' USD', `${num(a.atrPct)}% del precio por día`) : null,
        a.bollinger ? stat(termino('Bollinger %B', 'boll'), num(a.bollinger.pctB), `bandas ${num(a.bollinger.inf)} a ${num(a.bollinger.sup)}`) : null,
        a.beta != null ? stat(termino('Beta', 'beta'), num(a.beta), 'frente al S&P 500, último año') : null,
        a.sharpe != null ? stat(termino('Sharpe', 'sharpe'), num(a.sharpe), 'último año') : null,
        a.corrSP != null ? stat(termino('Correlación', 'corr'), num(a.corrSP), `${num(a.corrSP60)} en 60 ruedas`) : null,
        a.relSP != null ? stat('Contra el S&P 500', pct(a.relSP, 1), 'diferencia de rendimiento, último año', clase(a.relSP)) : null,
        a.volRel != null ? stat(termino('Volumen relativo', 'vol'), num(a.volRel) + '×', `${(a.volumen || 0).toLocaleString('es-AR')} acciones`) : null,
        stat('Volatilidad 20 ruedas', num(a.volHist20, 1) + '%', `anualizada; la del año es ${num(a.volatilidad, 1)}%`),
        a.caidaMax5a != null ? stat('Peor caída en 5 años', '−' + num(a.caidaMax5a, 1) + '%', `desde ${fechaCorta(a.desde, true)}`, 'baja') : null),
      el('div', { class: 'medias' }, el('h5', {}, termino('Medias móviles', 'sma')), el('ul', {}, [20, 50, 100, 200].map(sobre))),
      el('div', { class: 'rango52' }, el('h5', {}, termino('Rango de 52 semanas', 'rango')),
        el('div', { class: 'pista52', role: 'img', 'aria-label': `Precio a ${Math.round(pos)}% del camino entre el mínimo y el máximo del año` }, el('i', { style: `left:${pos}%` })),
        el('div', { class: 'ext52' }, el('span', {}, 'Mín. ' + num(a.min52)), el('span', {}, 'Máx. ' + num(a.max52)))),
      a.anomalias?.length ? el('div', { class: 'anomalias' }, el('h5', {}, 'Anomalías detectadas hoy'), el('ul', {}, a.anomalias.map(x => el('li', {}, el('b', {}, x.tipo + ': '), x.detalle)))) : null);
  }
  function elegir(tk, desplazar, conHash = true) {
    const a = acc?.lista?.find(x => x.ticker === tk); if (!a) return;
    elegida = tk;
    document.querySelectorAll('#ranking tr').forEach(tr => tr.classList.toggle('activo', tr.dataset.tk === tk));
    detalle(a);
    if (conHash) history.replaceState(null, '', '#empresa-' + tk);
    if (desplazar) $('detalle').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  function alternarFav(tk) {
    const ya = favs.has(tk);
    ya ? favs.delete(tk) : favs.add(tk);
    guardar('favoritas', [...favs]);
    document.querySelectorAll(`.estrella[data-tk="${tk}"]`).forEach(b => b.setAttribute('aria-pressed', String(!ya)));
    if (soloFav) ranking();
    favoritas();
    aviso(ya ? `${tk} ya no está en tus favoritas` : `${tk} agregada a tus favoritas`);
  }
  function mini(c) {
    const W = 160, H = 34, min = Math.min(...c), max = Math.max(...c);
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    s.append(svg('path', { d: c.map((v, i) => `${i ? 'L' : 'M'}${(i / (c.length - 1) * W).toFixed(1)},${(H - 2 - (v - min) / (max - min || 1) * (H - 4)).toFixed(1)}`).join(''),
      fill: 'none', stroke: c.at(-1) >= c[0] ? COLOR.positivo : COLOR.negativo, 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke' }));
    return s;
  }
  function favoritas() {
    const lista = (acc?.lista || []).filter(a => favs.has(a.ticker));
    $('favoritas').hidden = !lista.length;
    $('favLista').replaceChildren(...lista.map(a => el('button', { class: 'fav', onclick: () => { pestania('ranking'); elegir(a.ticker, true); } },
      el('b', {}, a.ticker), el('span', { class: 'p ' + clase(a.cambio1d) }, pct(a.cambio1d)),
      el('span', { class: 'n' }, a.nombre), el('span', { class: 'p' }, num(a.precio)), mini(a.cierres.slice(-30)))));
  }
  function cinta() { // cotizaciones reales: índices y las 4 empresas que más suben y más bajan
    const A = acc; if (!A?.lista?.length) { $('cinta').hidden = true; return; }
    const idx = [['sp500', 'S&P 500'], ['dow', 'Dow'], ['nasdaq', 'Nasdaq'], ['nasdaq100', 'Nasdaq 100'], ['russell', 'Russell 2000'], ['vix', 'VIX'], ['bono10', 'Bono 10a'], ['wti', 'WTI'], ['dolar', 'DXY']]
      .filter(([k]) => A.indices?.[k]).map(([k, n]) => [n, A.indices[k].precio, A.indices[k].cambio1d]);
    const orden = [...A.lista].filter(a => a.cambio1d != null).sort((a, b) => b.cambio1d - a.cambio1d);
    const emp = [...orden.slice(0, 4), ...orden.slice(-4)].map(a => [a.ticker, a.precio, a.cambio1d]);
    const items = [...idx, ...emp].map(([n, v, c]) => el('span', { class: 'cinta-item' }, el('b', {}, n), num(v), el('span', { class: clase(c) }, pct(c))));
    $('cinta').hidden = false;
    $('cintaPista').replaceChildren(...items, ...items.map(n => n.cloneNode(true))); // dos copias: el bucle no tiene salto
  }
  function prepararRanking() {
    cinta();
    const L = acc?.lista || [];
    [...L].sort((a, b) => b.estabilidad - a.estabilidad).forEach((a, i) => { a.puestoEst = i + 1; });
    [...L].sort((a, b) => (b.agresivo ?? 0) - (a.agresivo ?? 0)).forEach((a, i) => { a.puestoAgr = i + 1; });
    [...L].sort((a, b) => (b.riesgo ?? 0) - (a.riesgo ?? 0)).forEach((a, i) => { a.puestoRie = i + 1; });
    for (const a of L) a.ret3a = a.ret?.a3 ?? null; // plano para poder ordenar la columna
    aplicarModo(); armarFiltros(); ranking(); favoritas();
    if (acc?.lista?.length) elegir(acc.lista.some(a => a.ticker === elegida) ? elegida : acc.lista[0].ticker, false, false);
  }

  // Resumen ejecutivo y tendencias en frases, solo con hechos medidos (los usan la presentación y el informe PDF)
  function resumenEjecutivo(r) {
    const out = [], sp = barraEn('sp500', r), vix = valorEn(serie('vix'), r.fecha), esUltimo = r === datos[0];
    if (sp) out.push(`El S&P 500 ${sp.cambio >= 0 ? 'subió' : 'bajó'} ${num(Math.abs(sp.cambio))}% en la rueda del ${fechaCorta(sp.s.fechas[sp.i])} y quedó en ${num(sp.v)} puntos, ${pct((sp.v / sp.s.max52 - 1) * 100, 1)} contra su máximo de 52 semanas.`);
    if (vix != null) out.push(`La volatilidad esperada (VIX) está en ${num(vix, 1)}: zona de ${vix < 15 ? 'calma' : vix < 20 ? 'normalidad' : vix < 30 ? 'nerviosismo' : 'miedo'}.`);
    if (esUltimo && acc?.amplitud) out.push(`Subieron ${acc.amplitud.suben} de las ${acc.amplitud.total} empresas seguidas; ${acc.amplitud.sobre200} están arriba de su media de 200 ruedas.`);
    const sec = esUltimo && acc?.sectores ? Object.entries(acc.sectores).sort((a, b) => b[1].d1 - a[1].d1) : [];
    if (sec.length > 1) out.push(`Sector más fuerte: ${sec[0][0]} (${pct(sec[0][1].d1)}); más débil: ${sec.at(-1)[0]} (${pct(sec.at(-1)[1].d1)}).`);
    const top = [...(r.noticias || [])].sort((a, b) => (window.Pulso?.puntaje?.(b, r) ?? 0) - (window.Pulso?.puntaje?.(a, r) ?? 0))[0];
    if (top) out.push(`Noticia de mayor puntaje: ${top.titulo}.`);
    return out;
  }
  function tendenciasEnFrases(r) {
    const desde = sumarDias(r.fecha, -89), ventana = datos.filter(x => x.fecha >= desde && x.fecha <= r.fecha), out = [];
    const ns = ventana.flatMap(x => x.noticias || []), pos = ns.filter(n => tono(n.tono) === 'positivo').length;
    if (ns.length) out.push(`${Math.round(pos / ns.length * 100)}% de las ${ns.length} noticias de ${ventana.length} resúmenes fueron positivas.`);
    const sp = serie('sp500');
    if (sp) {
      const i1 = sp.fechas.findLastIndex(f => f <= r.fecha), i0 = sp.fechas.findIndex(f => f >= desde);
      if (i1 > 0 && i0 >= 0 && i0 < i1) {
        let alza = 0; for (let i = i0 + 1; i <= i1; i++) if (sp.cierres[i] > sp.cierres[i - 1]) alza++;
        out.push(`El S&P 500 ${pct((sp.cierres[i1] / sp.cierres[i0] - 1) * 100, 1)} en el período, con ${alza} de ${i1 - i0} ruedas en alza.`);
      }
    }
    return out;
  }

  /* ---------- modo presentación (con voz opcional) ---------- */
  function armar(r) {
    const t = tono(r.tonoGeneral), sp = (r.indices || [])[0], s = [], claves = r.enSegundos || [];
    s.push({ voz: `Resumen de la bolsa de Nueva York. ${fechaLarga(r.fecha)}, ${momento(r).toLowerCase()}. Tono ${t}.${sp?.cambio ? ` El S&P 500, ${sp.cambio}.` : ''}`,
      nodo: () => el('div', {}, el('p', { class: 's-kicker' }, momento(r)), el('h2', {}, fechaLarga(r.fecha)), el('span', { class: 'tono-chip t-' + t }, 'Tono ' + t),
        sp ? el('p', { class: 's-grande ' + clase(sp.cambioPct) }, `S&P 500 ${sp.cambio}`) : null) });
    const ejecutivo = resumenEjecutivo(r);
    if (ejecutivo.length) s.push({ voz: 'Resumen ejecutivo. ' + ejecutivo.join(' '),
      nodo: () => el('div', {}, el('p', { class: 's-kicker' }, 'Resumen ejecutivo'), el('ul', { class: 's-lista chica' }, ejecutivo.map(x => el('li', {}, x)))) });
    claves.forEach((x, k) => s.push({ voz: x, nodo: () => el('div', {}, el('p', { class: 's-num' }, `${k + 1} de ${claves.length}`), el('p', { class: 's-texto' }, x)) }));
    const idx = (r.indices || []).map(x => { // datos reales cuando existen; si no, lo que dice el resumen
      const k = CLAVE_INDICE[x.nombre], b = k && barraEn(k, r);
      return b ? { nombre: x.nombre, cambio: k === 'bono10' ? `${b.cambio >= 0 ? '+' : '−'}${num(Math.abs(b.cambio))} pp` : pct(b.cambio), c: b.cambio, valor: num(b.v) + (k === 'bono10' ? '%' : '') }
        : { nombre: x.nombre, cambio: x.cambio ?? 'sin dato', c: x.cambioPct, valor: x.valor ?? '' };
    });
    if (idx.length) s.push({ voz: 'Así quedaron los mercados. ' + idx.map(x => `${x.nombre}, ${x.cambio}`).join('. ') + '.',
      nodo: () => el('div', {}, el('p', { class: 's-kicker' }, 'Así quedaron los mercados'),
        el('div', { class: 's-indices' }, idx.map(x => el('div', {}, el('span', {}, x.nombre), el('b', { class: clase(x.c) }, x.cambio), el('small', {}, x.valor)))),
        el('p', { class: 's-fuente' }, 'Fuente: Yahoo Finance') ) });
    const am = acc?.amplitud, vixV = valorEn(serie('vix'), r.fecha), esUltimo = r === datos[0];
    if (esUltimo && am) s.push({ voz: `Indicadores del mercado. ${am.suben} de las ${am.total} empresas seguidas subieron y ${am.bajan} bajaron. ${am.sobre200} están arriba de su media de 200 ruedas.${vixV != null ? ` El VIX está en ${num(vixV, 1)}.` : ''}`,
      nodo: () => el('div', {}, el('p', { class: 's-kicker' }, 'Indicadores del mercado'),
        el('div', { class: 's-indices' },
          el('div', {}, el('span', {}, 'Empresas que subieron'), el('b', {}, `${am.suben} de ${am.total}`)),
          el('div', {}, el('span', {}, 'Arriba de su media de 200'), el('b', {}, `${am.sobre200} de ${am.total}`)),
          el('div', {}, el('span', {}, 'Máximos y mínimos del año hoy'), el('b', {}, `${am.nuevosMax} y ${am.nuevosMin}`)),
          vixV != null ? el('div', {}, el('span', {}, 'Volatilidad esperada (VIX)'), el('b', {}, num(vixV, 1))) : null)) });
    const sec = esUltimo && acc?.sectores ? Object.entries(acc.sectores).sort((a, b) => b[1].d1 - a[1].d1) : [];
    if (sec.length > 3) s.push({ voz: `Según los precios, los sectores más fuertes fueron ${sec.slice(0, 2).map(([n, x]) => `${n}, ${pct(x.d1)}`).join(', y ')}. Los más débiles, ${sec.slice(-2).reverse().map(([n, x]) => `${n}, ${pct(x.d1)}`).join(', y ')}.`,
      nodo: () => el('div', {}, el('p', { class: 's-kicker' }, 'Sectores según los precios de la rueda'), el('div', { class: 's-cols' },
        el('div', {}, el('h3', { class: 't-positivo' }, 'Más fuertes'), el('ul', { class: 's-lista chica' }, sec.slice(0, 3).map(([n, x]) => el('li', {}, `${n} ${pct(x.d1)}`)))),
        el('div', {}, el('h3', { class: 't-negativo' }, 'Más débiles'), el('ul', { class: 's-lista chica' }, sec.slice(-3).reverse().map(([n, x]) => el('li', {}, `${n} ${pct(x.d1)}`)))))) });
    const top = (r.noticias || []).slice(0, 3);
    if (top.length) s.push({ voz: 'Las noticias que más pesan. ' + top.map(n => n.titulo).join('. ') + '.',
      nodo: () => el('div', {}, el('p', { class: 's-kicker' }, 'Las noticias que más pesan'),
        el('ul', { class: 's-lista' }, top.map(n => el('li', { class: 'con-punto t-' + tono(n.tono) }, el('i', { class: 'punto', 'aria-hidden': 'true' }), el('span', {}, n.titulo))))) });
    const pos = (r.sectores || []).filter(x => tono(x.tono) === 'positivo').map(x => x.sector), neg = (r.sectores || []).filter(x => tono(x.tono) === 'negativo').map(x => x.sector);
    if (pos.length || neg.length) s.push({ voz: `Sectores con buenas noticias: ${pos.join(', ') || 'ninguno'}. Con malas noticias: ${neg.join(', ') || 'ninguno'}.`,
      nodo: () => el('div', {}, el('p', { class: 's-kicker' }, 'Sectores'), el('div', { class: 's-cols' },
        el('div', {}, el('h3', { class: 't-positivo' }, 'Buenas noticias'), el('ul', { class: 's-lista chica' }, (pos.length ? pos : ['Ninguno']).map(x => el('li', {}, x)))),
        el('div', {}, el('h3', { class: 't-negativo' }, 'Malas noticias'), el('ul', { class: 's-lista chica' }, (neg.length ? neg : ['Ninguno']).map(x => el('li', {}, x)))))) });
    const tend = tendenciasEnFrases(r);
    if (tend.length) s.push({ voz: 'Tendencias. ' + tend.join(' '),
      nodo: () => el('div', {}, el('p', { class: 's-kicker' }, 'Tendencias de los últimos 90 días'), el('ul', { class: 's-lista chica' }, tend.map(x => el('li', {}, x)))) });
    if (r.riesgoHoy) s.push({ voz: 'Riesgos. ' + r.riesgoHoy,
      nodo: () => el('div', {}, el('p', { class: 's-kicker' }, 'Riesgos según las noticias'), el('p', { class: 's-texto' }, r.riesgoHoy)) });
    if (r.proximos?.length) s.push({ voz: 'Para seguir en los próximos días. ' + r.proximos.join('. '),
      nodo: () => el('div', {}, el('p', { class: 's-kicker' }, 'Para seguir'), el('ul', { class: 's-lista chica' }, r.proximos.map(x => el('li', {}, x)))) });
    const spR = barraEn('sp500', r);
    if (spR) { // conclusiones: solo hechos medidos y reglas explícitas
      const desdeMax = (spR.v / spR.s.max52 - 1) * 100;
      const linea = [`El S&P 500 ${spR.cambio >= 0 ? 'subió' : 'bajó'} ${pct(Math.abs(spR.cambio)).replace('+', '')} en la rueda`, `y está ${pct(desdeMax, 1)} contra su máximo de 52 semanas.`].join(' ');
      s.push({ voz: 'Conclusión. ' + linea + ' Esto describe lo que pasó; no anticipa lo que va a pasar.',
        nodo: () => el('div', {}, el('p', { class: 's-kicker' }, 'Conclusión'), el('p', { class: 's-texto' }, linea), el('p', { class: 's-fuente' }, 'Describe lo que pasó; no anticipa lo que va a pasar ni es una recomendación.')) });
    }
    return s;
  }
  const show = (() => {
    const raiz = $('show'), cuerpo = $('showCuerpo'), barras = $('showBarras'), hayVoz = 'speechSynthesis' in window;
    let slides = [], i = 0, pausado = false, timer = null, restante = 0, inicio = 0, abierto = false, voz = hayVoz && leer('voz', false);
    $('showVoz').hidden = !hayVoz;
    function pintarVoz() { $('showVoz').setAttribute('aria-pressed', String(voz)); $('showVoz').replaceChildren(ico(voz ? 'voz' : 'mudo'), voz ? 'Voz activada' : 'Voz apagada'); }
    function pintarPausa() { $('showPausa').replaceChildren(ico(pausado ? 'play' : 'pausa')); $('showPausa').setAttribute('aria-label', pausado ? 'Seguir' : 'Pausar'); raiz.classList.toggle('pausado', pausado); }
    function hablar(texto, alTerminar) {
      if (!hayVoz) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto), vs = speechSynthesis.getVoices();
      const v = ['es-AR', 'es-419', 'es-US', 'es-MX', 'es-ES'].map(l => vs.find(x => x.lang.replace('_', '-') === l)).find(Boolean) || vs.find(x => x.lang.startsWith('es'));
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'es-AR'; u.rate = 1.03; u.onend = alTerminar;
      speechSynthesis.speak(u);
    }
    function iniciar() {
      clearTimeout(timer);
      const s = slides[i], nodo = s.nodo();
      nodo.classList.add('s-entrada');
      cuerpo.replaceChildren(nodo);
      [...barras.children].forEach((b, k) => { b.className = k < i ? 'hecha' : k === i ? 'actual' : ''; });
      const dur = voz ? Math.max(4000, s.voz.length * 70) : Math.min(14000, Math.max(4500, 2500 + s.voz.length * 50));
      const b = barras.children[i]; b.style.setProperty('--d', dur + 'ms');
      const bi = b.firstChild; bi.style.animation = 'none'; void bi.offsetWidth; bi.style.animation = '';
      restante = voz ? dur * 1.8 + 2500 : dur; inicio = performance.now(); // con voz, el tiempo es solo red de seguridad
      if (voz && !pausado) hablar(s.voz, () => { if (abierto && slides[i] === s && !pausado) setTimeout(() => { if (abierto && slides[i] === s) siguiente(); }, 500); });
      else if (hayVoz) speechSynthesis.cancel();
      if (!pausado) timer = setTimeout(siguiente, restante);
      $('showPos').textContent = `${i + 1} de ${slides.length}`;
    }
    function siguiente() { if (i < slides.length - 1) { i++; iniciar(); } else cerrar(); }
    function anterior() { if (i > 0) i--; iniciar(); }
    function pausar() {
      pausado = !pausado; pintarPausa();
      if (pausado) { clearTimeout(timer); restante -= performance.now() - inicio; if (hayVoz) speechSynthesis.pause(); }
      else { inicio = performance.now(); timer = setTimeout(siguiente, Math.max(400, restante)); if (hayVoz) speechSynthesis.resume(); }
    }
    function abrir(r, auto) {
      if (!r || abierto) return;
      slides = armar(r); i = 0; pausado = false; abierto = true;
      raiz.hidden = false; $('pagina').inert = true; document.body.style.overflow = 'hidden';
      barras.replaceChildren(...slides.map((_, k) => el('span', { title: `Ir a la parte ${k + 1}`, onclick: () => { i = k; iniciar(); } }, el('i'))));
      pintarPausa(); pintarVoz();
      orbe.montar($('showOrbe'));
      if (!auto && raiz.requestFullscreen) raiz.requestFullscreen().catch(() => {});
      $('showPausa').focus();
      iniciar();
    }
    function cerrar() {
      if (!abierto) return;
      abierto = false; clearTimeout(timer); if (hayVoz) speechSynthesis.cancel();
      raiz.hidden = true; $('pagina').inert = false; document.body.style.overflow = '';
      orbe.devolver();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      $('presentar').focus();
    }
    function tecla(e) {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); siguiente(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); anterior(); }
      else if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); pausar(); }
    }
    $('showSig').onclick = siguiente; $('showAnt').onclick = anterior; $('showPausa').onclick = pausar; $('showCerrar').onclick = cerrar;
    $('showVoz').onclick = () => { voz = !voz; guardar('voz', voz); pintarVoz(); iniciar(); };
    cuerpo.onclick = e => { const r = cuerpo.getBoundingClientRect(); e.clientX - r.left < r.width * .3 ? anterior() : siguiente(); };
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && abierto) cerrar(); });
    return { abrir, cerrar, tecla, abierto: () => abierto };
  })();

  /* ---------- pestañas y atajos ---------- */
  // 5 secciones simples arriba; cada una agrupa una o más partes (las pestañas de siempre, que siguen existiendo)
  const SECCIONES = { hoy: ['resumen'], mercado: ['terminal', 'inteligencia'], empresas: ['ranking', 'comparar'], historia: ['historial', 'tendencias', 'historia5'], listas: ['listas'], sistema: ['estado'] };
  const seccionDe = t => Object.keys(SECCIONES).find(s => SECCIONES[s].includes(t)) || 'hoy';
  const ultimaParte = leer('partes', {});
  function pestania(nombre, foco) {
    if (!TABS.includes(nombre)) nombre = 'resumen';
    const sec = seccionDe(nombre), partes = SECCIONES[sec];
    for (const t of TABS) {
      const b = $('t-' + t), sel = t === nombre;
      b.setAttribute('aria-selected', String(sel)); b.tabIndex = sel ? 0 : -1;
      b.hidden = !partes.includes(t); // solo se ven las partes de la sección elegida
      $('p-' + t).hidden = !sel;
    }
    $('tabs').hidden = partes.length < 2;
    document.querySelectorAll('[data-seccion]').forEach(b => b.setAttribute('aria-current', b.dataset.seccion === sec ? 'page' : 'false'));
    $('ajustes').setAttribute('aria-pressed', String(sec === 'sistema'));
    ultimaParte[sec] = nombre; guardar('partes', ultimaParte);
    guardar('pestania', nombre);
    if (foco) $('t-' + nombre).focus();
    indicador();
  }
  function irASeccion(sec) { pestania(ultimaParte[sec] && SECCIONES[sec].includes(ultimaParte[sec]) ? ultimaParte[sec] : SECCIONES[sec][0]); }
  function indicador() { const b = document.querySelector('[role=tab][aria-selected=true]'), n = $('tabs'); if (!b || n.hidden) return; n.style.setProperty('--tx', b.offsetLeft + 'px'); n.style.setProperty('--tw', b.offsetWidth + 'px'); }
  document.querySelectorAll('[data-seccion]').forEach(b => b.onclick = () => irASeccion(b.dataset.seccion));
  $('ajustes').onclick = () => { pestania('estado'); $('tabs').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); };
  const verBienvenida = v => { $('bienvenida').hidden = !v; if (!v) guardar('bienvenida', true); };
  $('ayuda').onclick = () => { verBienvenida(true); $('bienvenida').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); $('bienvenidaOk').focus(); };
  $('bienvenidaOk').onclick = () => verBienvenida(false);
  if (!leer('bienvenida', false)) verBienvenida(true);
  // Los textos de explicación se muestran en 2 líneas; se abren al tocarlos
  document.addEventListener('click', e => { const x = e.target.closest?.('.explica'); if (x && !e.target.closest('a, button, dfn')) x.classList.toggle('abierta'); });
  addEventListener('resize', indicador);
  document.fonts?.ready.then(indicador);
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) document.addEventListener('pointermove', e => {
    const c = e.target.closest?.('.stat, .fav, .dia, .tarjeta, .indice'); if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
  document.querySelectorAll('[role=tab]').forEach(b => b.onclick = () => pestania(b.id.slice(2)));
  $('tabs').addEventListener('keydown', e => {
    const vis = TABS.filter(t => !$('t-' + t).hidden), i = vis.indexOf(e.target.id?.slice(2)); if (i < 0) return;
    const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: vis.length - 1 }[e.key];
    if (k == null) return;
    e.preventDefault();
    pestania(vis[(k + vis.length) % vis.length], true);
  });
  document.addEventListener('keydown', e => {
    if (show.abierto()) return show.tecla(e);
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t.matches?.('input, textarea, select')) { if (e.key === 'Escape') t.blur(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { if (!t.closest?.('.lienzo, #p-ranking, .tabs, .rangos, .segmento')) navegar(e.key === 'ArrowLeft' ? 1 : -1); }
    else if (/^[1-5]$/.test(e.key)) irASeccion(['hoy', 'mercado', 'empresas', 'historia', 'listas'][+e.key - 1]);
    else if (e.key === '/') {
      e.preventDefault();
      const enRanking = !$('p-ranking').hidden;
      if (!enRanking) pestania('historial');
      $(enRanking ? 'buscarEmpresa' : 'buscar').focus();
    } else if (e.key === 'p' || e.key === 'P') show.abrir(actual);
  });

  /* ---------- carga y recarga automática ---------- */
  function cargar(inicial) {
    const nuevos = [...(window.RESUMENES || [])].filter(r => r && r.id && r.fecha).sort((a, b) => a.id < b.id ? 1 : -1);
    const firma = nuevos.map(r => r.id).join();
    if (!inicial && firma === firmaDatos) return;
    const hayNuevo = !inicial && nuevos.length > 0 && nuevos[0].id !== datos[0]?.id;
    const veiaUltimo = !actual || actual === datos[0], idActual = actual?.id;
    datos = nuevos; firmaDatos = firma;
    if (datos.length) {
      const r = inicial ? datos.find(x => x.id === location.hash.slice(1)) || datos[0] : hayNuevo && veiaUltimo ? datos[0] : datos.find(x => x.id === idActual) || datos[0];
      mostrar(r, { transicion: !inicial });
    }
    historial(); tendencias(); graficoTendencias(); avisarCambios();
    if (hayNuevo) { aviso('Llegó un resumen nuevo'); if ($('autoShow').checked) show.abrir(datos[0], true); }
  }
  // Las secciones de los otros archivos (inteligencia.js, comparador.js, listas.js, estado.js) se enganchan acá.
  const oyentes = [];
  function avisarCambios() { for (const f of oyentes) { try { f(); } catch (e) { console.error('Pulso:', e); } } }
  window.Pulso = { el, svg, ico, num, pct, clase, fechaCorta, fechaLarga, tono, stat, mini, grafico, abrirResumen, pestania, aviso, leer, guardar,
    urlSegura, conGlosario, serie, valorEn, COLOR, menciones, barraEn, horaNY, cambioDia, elegirEmpresa: (tk, desplazar = true) => { pestania('ranking'); elegir(tk, desplazar); },
    datos: () => datos, acc: () => acc, actual: () => actual, accionesEmpresa: [], seccionesEmpresa: [], recargar: () => recargar(), resumenEjecutivo, tendenciasEnFrases, momento,
    alMostrar: f => { alMostrar.push(f); if (actual) pintarResumen(actual); },
    refrescarDetalle: () => { const a = acc?.lista?.find(x => x.ticker === elegida); if (a) detalle(a); }, alActualizar: f => { oyentes.push(f); if (datos.length || acc) { try { f(); } catch (e) { console.error('Pulso:', e); } } } };
  function cargarAcciones() {
    const A = window.ACCIONES;
    if ((A?.actualizado || '') === firmaAcc) return;
    acc = A; firmaAcc = A?.actualizado || '';
    prepararRanking();
    if (actual) pintarResumen(actual);
    historial(); tendencias(); graficoTendencias(); avisarCambios();
  }
  function traer(archivo, listo, fallo) {
    const s = document.createElement('script');
    s.src = archivo + '?t=' + Date.now();
    s.onload = () => { s.remove(); listo(); };
    s.onerror = () => { s.remove(); fallo?.(); };
    document.body.append(s);
  }
  // Cada 2 minutos baja solo version.js (unos bytes) y vuelve a bajar datos.js o acciones.js (más de 1 MB) solo si cambiaron.
  const versionVista = { ...(window.VERSION || {}) };
  function recargar() {
    const ambos = () => { traer('datos.js', () => cargar(false)); traer('acciones.js', cargarAcciones); };
    traer('version.js', () => {
      const v = window.VERSION || {};
      // Edge a veces abre una copia guardada de la página: si el código del disco es más nuevo, recarga una sola vez por versión.
      if (v.app && versionVista.app !== v.app) {
        let ya = null; try { ya = sessionStorage.getItem('pulso-app'); } catch {}
        if (ya !== v.app) { try { sessionStorage.setItem('pulso-app', v.app); } catch {} return location.reload(); }
        versionVista.app = v.app;
      }
      if (!v.datos && !v.acciones) return ambos();
      if (v.datos !== versionVista.datos) traer('datos.js', () => { versionVista.datos = v.datos; cargar(false); });
      if (v.acciones !== versionVista.acciones) traer('acciones.js', () => { versionVista.acciones = v.acciones; cargarAcciones(); });
      if (v.extendido && v.extendido !== versionVista.extendido) traer('extendido.js', () => { versionVista.extendido = v.extendido; ranking(); window.Pulso.refrescarDetalle(); });
      if (v.empresas && v.empresas !== versionVista.empresas) traer('empresas.js', () => { versionVista.empresas = v.empresas; window.Pulso.refrescarDetalle(); });
    }, ambos); // sin version.js (instalación vieja) se comporta como antes
    traer('logs/ejecuciones.js', avisarCambios);
  }

  $('anterior').onclick = () => navegar(1);
  $('siguiente').onclick = () => navegar(-1);
  $('alUltimo').onclick = () => mostrar(datos[0], { transicion: true });
  $('presentar').onclick = () => show.abrir(actual);
  $('copiar').onclick = () => copiar(actual);
  $('buscar').oninput = historial;
  $('buscarEmpresa').oninput = ranking;
  $('soloFav').onclick = () => { soloFav = !soloFav; ranking(); };
  document.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => {
    modo = b.dataset.modo; guardar('modoRanking', modo); aplicarModo(); ranking();
    const top = [...(acc?.lista || [])].sort((x, y) => x[MODOS[modo].puesto] - y[MODOS[modo].puesto])[0];
    if (top) elegir(top.ticker, false, false);
  });
  document.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => { vista = b.dataset.vista; guardar('vista', vista); ranking(); });
  $('rankingCab').onclick = e => {
    const th = e.target.closest('th[data-k]'); if (!th) return;
    const k = th.dataset.k;
    orden = orden.k === k ? { k, dir: -orden.dir } : { k, dir: ASC.has(k) ? 1 : -1 };
    ranking();
  };
  document.querySelectorAll('.horizontes button').forEach(b => b.onclick = () => { diasT = +b.dataset.dias; guardar('horizonte', diasT); tendencias(); });
  $('compacto').checked = leer('compacto', false);
  document.body.classList.toggle('compacto', $('compacto').checked);
  $('compacto').onchange = e => { guardar('compacto', e.target.checked); document.body.classList.toggle('compacto', e.target.checked); dispatchEvent(new Event('resize')); };
  $('autoShow').checked = leer('autoShow', false);
  $('autoShow').onchange = e => guardar('autoShow', e.target.checked);

  acc = window.ACCIONES || null; firmaAcc = acc?.actualizado || '';
  cargar(true);
  prepararRanking();
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash === 'celular') pestania('estado');
  else if (hash.startsWith('empresa-') && acc?.lista?.some(a => a.ticker === hash.slice(8))) { pestania('ranking'); elegir(hash.slice(8), false, false); }
  else pestania(datos.some(r => r.id === hash) ? 'resumen' : leer('pestania', 'resumen'));
  reloj();
  setInterval(reloj, 15e3);
  setInterval(recargar, 2 * 60e3);
  setTimeout(recargar, 1500); // al abrir: detecta enseguida si el navegador mostró una copia vieja
})();
