// Lista de espera de Pulso Premium: manda el email al intermediario de Cloudflare (ruta /lista), que lo guarda en tu cuenta.
(() => {
  'use strict';
  const URL_LISTA = 'https://precios-en-vivo.alvaro05012007.workers.dev/lista';
  const f = document.getElementById('formPremium'); if (!f) return;
  const email = document.getElementById('emailPremium'), acepto = document.getElementById('aceptoPremium'), msg = document.getElementById('msgPremium');
  const boton = f.querySelector('button');
  let anotado = null; try { anotado = localStorage.getItem('pulso-premium'); } catch {}
  if (anotado) msg.textContent = `Ya estás en la lista con ${anotado}. Te avisamos cuando salga.`;
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const v = email.value.trim();
    if (!email.checkValidity() || !v) { msg.textContent = 'Escribí un email válido, por ejemplo nombre@gmail.com.'; email.focus(); return; }
    if (!acepto.checked) { msg.textContent = 'Tildá la casilla para que podamos escribirte.'; acepto.focus(); return; }
    boton.disabled = true; msg.textContent = 'Anotando…';
    try {
      const r = await fetch(URL_LISTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ email: v, acepto: true, web: document.getElementById('webPremium').value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo anotar.');
      msg.textContent = j.ya ? 'Ese email ya estaba en la lista. Te avisamos cuando salga.' : '¡Listo! Te avisamos primero cuando salga Pulso Premium.';
      try { localStorage.setItem('pulso-premium', v); } catch {}
      f.reset();
    } catch (err) {
      msg.textContent = (err.name === 'TimeoutError' || err instanceof TypeError) ? 'No hay conexión. Probá de nuevo en un rato.' : err.message;
    } finally { boton.disabled = false; }
  });
})();
