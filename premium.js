// Lista de espera de Pulso Premium: manda el email al intermediario de Cloudflare (ruta /lista), que lo guarda en tu cuenta.
// Al entrar aparece una ventana que lo pide (una vez; si la cierran, vuelve recién a los 7 días; si ya se anotaron, nunca).
// El mismo formulario está fijo en la pestaña Hoy.
(() => {
  'use strict';
  const URL_LISTA = 'https://precios-en-vivo.alvaro05012007.workers.dev/lista';
  const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const anotado = () => leer('pulso-premium');
  const dlg = document.getElementById('dialogoPremium');

  function pintarAnotado() {
    const e = anotado(); if (!e) return;
    for (const m of document.querySelectorAll('.msg-premium')) if (!m.textContent) m.textContent = `Ya estás en la lista con ${e}. Te avisamos cuando salga.`;
  }

  for (const f of document.querySelectorAll('.form-premium')) {
    const email = f.elements.email, acepto = f.elements.acepto, msg = f.querySelector('.msg-premium'), boton = f.querySelector('button[type=submit]');
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const v = email.value.trim();
      if (!v || !email.checkValidity()) { msg.textContent = 'Escribí un email válido, por ejemplo nombre@gmail.com.'; email.focus(); return; }
      if (!acepto.checked) { msg.textContent = 'Tildá la casilla para que podamos escribirte.'; acepto.focus(); return; }
      boton.disabled = true; msg.textContent = 'Anotando…';
      try {
        const r = await fetch(URL_LISTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
          body: JSON.stringify({ email: v, acepto: true, web: f.elements.web.value }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'No se pudo anotar.');
        guardar('pulso-premium', v);
        f.reset();
        for (const m of document.querySelectorAll('.msg-premium')) m.textContent = j.ya ? 'Ese email ya estaba en la lista. Te avisamos cuando salga.' : '¡Listo! Te avisamos primero cuando salga Pulso Premium.';
        if (dlg?.open) setTimeout(() => dlg.close(), 2200);
      } catch (err) {
        msg.textContent = (err.name === 'TimeoutError' || err instanceof TypeError) ? 'No hay conexión. Probá de nuevo en un rato.' : err.message;
      } finally { boton.disabled = false; }
    });
  }
  pintarAnotado();

  // Ventana al entrar
  if (!dlg || typeof dlg.showModal !== 'function') return;
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-cerrar]')) dlg.close(); }); // clic afuera o en cerrar
  dlg.addEventListener('close', () => { if (!anotado()) guardar('pulso-premium-cerrado', String(Date.now())); });
  const cerrado = +leer('pulso-premium-cerrado') || 0;
  if (anotado() || Date.now() - cerrado < 7 * 864e5 || /[?&]sin-aviso/.test(location.search)) return;
  const guia = document.getElementById('bienvenida');
  const mostrar = () => setTimeout(() => { // primero la guía de bienvenida, después la ventana
    if (guia && !guia.hidden) return;
    if (!dlg.open && !document.querySelector('dialog[open], .show:not([hidden])')) dlg.showModal();
  }, 2500);
  if (guia && !guia.hidden) new MutationObserver((_, o) => { if (guia.hidden) { o.disconnect(); mostrar(); } }).observe(guia, { attributes: true, attributeFilter: ['hidden'] });
  else mostrar();
})();
