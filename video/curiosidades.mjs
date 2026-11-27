// Videos de curiosidades de Wall Street (para TikTok, aparte del resumen del día). Solo hechos históricos bien documentados;
// el único dato que cambia (precio de Berkshire) sale de acciones.js (Yahoo Finance). Uso: node video/curiosidades.mjs [número]
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { videoDeEscenas } from './animado.mjs';

const aqui = fileURLToPath(new URL('.', import.meta.url));
const SALIDA = join(aqui, '..', '..', 'negocio-pulso', 'videos', 'curiosidades');
const SERIE = 'CURIOSIDADES DE WALL STREET';
const HASHTAGS = '#WallStreet #bolsa #curiosidades #historia #finanzas #inversiones #sabiasque #economia #NuevaYork #aprendeentiktok';
const fmt = n => Math.round(n).toLocaleString('es-AR');

// precio real de Berkshire Hathaway B (la A vale 1.500 veces la B: proporción fija desde 2010)
function berkshire() {
  try {
    const t = readFileSync(join(aqui, '..', 'acciones.js'), 'utf8'), A = JSON.parse(t.slice(t.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
    const b = A.lista.find(a => a.ticker === 'BRK-B')?.precio;
    return Number.isFinite(b) ? { b, a: b * 1500 } : null;
  } catch { return null; }
}
const cierre = sub => ({ tipo: 'cierre', pantalla: 'Seguime', sub, link: 'pulso-wallstreet.pages.dev', voz: 'Seguime para más curiosidades de Wall Street.' });

export function guiones() {
  const brk = berkshire();
  return [
    { id: '01-muro', titulo: 'Wall Street era un muro de verdad 🧱', escenas: [
      { tipo: 'gancho', voz: '¿Sabías que Wall Street se llama así por un muro de verdad?', pantalla: 'Wall Street era un MURO', emoji: '🧱', signo: 0 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'En 1653, los holandeses de Nueva Ámsterdam, la ciudad que después fue Nueva York, levantaron un muro de madera para defenderse.', pantalla: 'Un muro de madera en Nueva Ámsterdam', numero: '1653', emoji: '🪵', signo: 0 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'La calle que corría al lado del muro empezó a llamarse la calle del muro: Wall Street.', pantalla: 'La calle del muro = Wall Street', emoji: '🛣️', signo: 1 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'Los ingleses lo derribaron en 1699… pero el nombre quedó para siempre.', pantalla: 'El muro cayó, el nombre quedó', numero: '1699', emoji: '🔨', signo: 0 },
      cierre('Una curiosidad nueva cada día'),
    ] },
    { id: '02-arbol', titulo: 'La bolsa más grande del mundo nació debajo de un árbol 🌳', escenas: [
      { tipo: 'gancho', voz: 'La bolsa más grande del mundo nació debajo de un árbol.', pantalla: 'Nació debajo de un ÁRBOL', emoji: '🌳', signo: 1 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'El 17 de mayo de 1792, veinticuatro corredores se juntaron bajo un árbol en Wall Street y firmaron un acuerdo.', pantalla: '24 corredores bajo un árbol', numero: '1792', emoji: '✍️', signo: 0 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'Lo llamaron el Acuerdo Buttonwood, por el nombre en inglés de ese árbol, un plátano americano.', pantalla: 'El Acuerdo Buttonwood', emoji: '📜', signo: 0 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'De esa reunión nació la Bolsa de Nueva York, hoy la más grande del planeta.', pantalla: 'De 24 corredores a la bolsa más grande', numero: '24', emoji: '🏛️', signo: 1 },
      cierre('Una curiosidad nueva cada día'),
    ] },
    { id: '03-toro', titulo: 'El toro de Wall Street llegó de contrabando 🐂', escenas: [
      { tipo: 'gancho', voz: 'El toro más famoso de Wall Street llegó de contrabando.', pantalla: 'El toro llegó de CONTRABANDO', emoji: '🐂', signo: 1 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'En diciembre de 1989, el artista Arturo Di Modica lo dejó de noche frente a la Bolsa, sin pedirle permiso a nadie.', pantalla: 'Lo dejaron de noche, sin permiso', numero: '1989', emoji: '🌙', signo: 0 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'Pesa unos 3.200 kilos de bronce, y el artista lo pagó de su propio bolsillo.', pantalla: 'Bronce pagado por el artista', numero: '3.200 kg', emoji: '💪', signo: 0 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'La policía se lo llevó al día siguiente… pero la gente lo quiso tanto que lo instalaron a pocas cuadras, donde sigue hoy.', pantalla: 'Se lo llevaron… y volvió', emoji: '🚓', signo: 1 },
      cierre('Una curiosidad nueva cada día'),
    ] },
    { id: '04-lunes-negro', titulo: 'El día que Wall Street perdió casi un cuarto de su valor 📉', escenas: [
      { tipo: 'gancho', voz: 'En un solo día, la bolsa de Nueva York perdió casi un cuarto de su valor.', pantalla: 'Casi un CUARTO en un solo día', emoji: '📉', numero: '−22,6%', signo: -1 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'Fue el lunes 19 de octubre de 1987. El Dow Jones cayó 22,6 por ciento: la peor caída de su historia en un día.', pantalla: 'El Lunes Negro', numero: '1987', emoji: '😱', signo: -1 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'Por eso hoy hay frenos automáticos: si el S&P 500 cae 7 por ciento, se frena todo durante 15 minutos.', pantalla: 'Cae 7%: pausa de 15 minutos', numero: '7%', emoji: '🛑', signo: 0 },
      { tipo: 'dato', eyebrow: SERIE, voz: 'Y si llega a caer 20 por ciento, la bolsa cierra por el resto del día.', pantalla: 'Cae 20%: se cierra el día', numero: '20%', emoji: '🔒', signo: 0 },
      cierre('Una curiosidad nueva cada día'),
    ] },
    { id: '05-accion-mas-cara', titulo: 'La acción que cuesta más que una casa 🏠', escenas: [
      { tipo: 'gancho', voz: 'Hay una acción que cuesta más que una casa.', pantalla: 'Una acción que cuesta MÁS que una casa', emoji: '🏠', signo: 1 },
      { tipo: 'dato', eyebrow: SERIE, voz: brk ? `Es Berkshire Hathaway, la empresa de Warren Buffett: una sola acción clase A cuesta unos ${fmt(Math.round(brk.a / 1000) * 1000)} dólares.` : 'Es Berkshire Hathaway, la empresa de Warren Buffett: una sola acción clase A cuesta cientos de miles de dólares.',
        pantalla: 'Berkshire Hathaway, clase A', numero: brk ? `${fmt(Math.round(brk.a / 1000) * 1000)} USD` : null, emoji: '💰', signo: 1 },
      { tipo: 'dato', eyebrow: SERIE, voz: '¿Por qué tan cara? Porque Buffett nunca quiso dividirla: dice que así atrae a inversores de largo plazo.', pantalla: 'Nunca la dividieron', emoji: '💎', signo: 0 },
      { tipo: 'dato', eyebrow: SERIE, voz: brk ? `Para el resto existe la clase B, que vale 1.500 veces menos: unos ${fmt(brk.b)} dólares.` : 'Para el resto existe la clase B, que vale 1.500 veces menos.',
        pantalla: 'La clase B: 1.500 veces menos', numero: brk ? `${fmt(brk.b)} USD` : '1.500', emoji: '🪙', signo: 0 },
      { ...cierre('Información, no recomendación de inversión'), voz: 'Esto es información, no una recomendación. Seguime para más curiosidades de Wall Street.' },
    ] },
  ];
}

// ---- armar ----
const solo = process.argv[2];
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const base = join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  let ff = 'ffmpeg';
  try { for (const d of readdirSync(base).filter(d => d.startsWith('Gyan.FFmpeg'))) for (const v of readdirSync(join(base, d))) { const f = join(base, d, v, 'bin', 'ffmpeg.exe'); if (existsSync(f)) ff = f; } } catch { /* usa el del PATH */ }
  for (const g of guiones().filter(g => !solo || g.id.startsWith(solo))) {
    const dir = join(SALIDA, g.id); mkdirSync(dir, { recursive: true });
    const t0 = Date.now(); const { guion } = videoDeEscenas(g.escenas, 'curiosidad-' + g.id, dir, ff);
    writeFileSync(join(dir, 'texto-publicacion.txt'), `${g.titulo}\nCuriosidades de la bolsa de Nueva York, explicadas simple.\nResumen gratis todos los días: pulso-wallstreet.pages.dev\nInformación, no consejo de inversión. Voz: Daniela (Piper).\n\n${HASHTAGS}\n`);
    console.log(`${g.id}: ${guion.dur.toFixed(1)} s, listo en ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}
