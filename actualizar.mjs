// Actualizador independiente de Claude: precios + indicadores (acciones.mjs) y reconstrucción del historial (datos.mjs),
// con reintentos, bloqueo contra ejecuciones simultáneas y registro en logs/. Lo puede llamar cualquier programador de tareas.
//   node actualizar.mjs            -> corre ahora
//   node actualizar.mjs --si-toca  -> corre solo en las ventanas de Nueva York (antes de la apertura y después del cierre)
//                                    y una sola vez por ventana; pensado para un programador que lo llama cada 15 minutos.
// Los horarios se calculan en America/New_York, así que los cambios de horario de verano se respetan solos.
import { spawnSync } from 'node:child_process';
import { FERIADOS } from './feriados.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync, statSync, cpSync } from 'node:fs';

const raiz = new URL('./', import.meta.url), logs = new URL('./logs/', import.meta.url);
mkdirSync(logs, { recursive: true });
const VENTANAS = [['apertura', 9 * 60, 9 * 60 + 45], ['cierre', 16 * 60 + 20, 17 * 60 + 30]]; // minutos, hora de NY

function horaNY(fecha) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
    .formatToParts(fecha).map(x => [x.type, x.value]));
  const dia = `${p.year}-${p.month}-${p.day}`, min = +p.hour * 60 + +p.minute;
  return ['Sat', 'Sun'].includes(p.weekday) || FERIADOS.has(dia) ? null : { dia, min };
}
export function ventanaNY(fecha = new Date()) {
  const { dia, min } = horaNY(fecha) || {};
  if (!dia) return null;
  const v = VENTANAS.find(([, a, b]) => min >= a && min <= b);
  return v ? `${dia}-${v[0]}` : null;
}

// Franjas de precios fuera de horario: antes de la apertura (4:00-9:30) y después del cierre (16:00-20:00), hora de NY
export function extendidaNY(fecha = new Date()) {
  const h = horaNY(fecha); if (!h) return false;
  return (h.min >= 4 * 60 && h.min < 9 * 60 + 30) || (h.min >= 16 * 60 && h.min <= 20 * 60 + 10);
}

// Pruebas de horario: invierno (UTC-5), verano (UTC-4), feriado y fin de semana
import assert from 'node:assert';
assert.equal(ventanaNY(new Date('2026-11-24T14:30:00Z')), '2026-11-24-apertura'); // 9:30 en NY, horario de invierno
assert.equal(ventanaNY(new Date('2026-07-01T13:30:00Z')), '2026-07-01-apertura'); // 9:30 en NY, horario de verano
assert.equal(ventanaNY(new Date('2026-11-24T21:45:00Z')), '2026-11-24-cierre');   // 16:45 en NY
assert.equal(ventanaNY(new Date('2026-11-26T14:30:00Z')), null);                  // Thanksgiving
assert.equal(ventanaNY(new Date('2026-11-28T14:30:00Z')), null);                  // sábado
assert.equal(ventanaNY(new Date('2026-11-24T18:00:00Z')), null);                  // mediodía: fuera de ventana
assert.equal(extendidaNY(new Date('2026-11-24T23:30:00Z')), true);                // 18:30 en NY: después del cierre
assert.equal(extendidaNY(new Date('2026-11-24T10:00:00Z')), true);                // 5:00 en NY: antes de la apertura
assert.equal(extendidaNY(new Date('2026-11-24T18:00:00Z')), false);               // mediodía: horario normal
assert.equal(extendidaNY(new Date('2026-11-25T03:00:00Z')), false);               // 22:00 en NY: todo cerrado

const espera = ms => new Promise(r => setTimeout(r, ms));
function correr(script, ...args) {
  const r = spawnSync(process.execPath, [decodeURIComponent(new URL(script, raiz).pathname).replace(/^\/([A-Za-z]:)/, '$1'), ...args], { encoding: 'utf8', timeout: 15 * 60e3, cwd: new URL('.', raiz) });
  return { ok: r.status === 0, codigo: r.status, salida: ((r.stdout || '') + (r.stderr || '')).trim().slice(-800) };
}
// Copia diaria del historial (datos/) en ../backups/auto/AAAA-MM-DD. No borra copias viejas: cada una pesa unos 150 KB.
function respaldo() {
  const hoy = new Date().toISOString().slice(0, 10), destino = new URL(`../backups/auto/${hoy}/`, raiz);
  if (existsSync(destino)) return { paso: 'respaldo', ok: true, omitido: true, salida: 'ya existe la copia de hoy' };
  try { cpSync(new URL('./datos/', raiz), destino, { recursive: true }); return { paso: 'respaldo', ok: true, salida: `copia en backups/auto/${hoy}` }; }
  catch (e) { return { paso: 'respaldo', ok: false, salida: e.message }; }
}
// Una vez por semana revisa si las dependencias (librería de Anthropic) tienen vulnerabilidades conocidas.
function auditoria() {
  const marca = new URL('auditoria.json', logs);
  if (existsSync(marca) && Date.now() - statSync(marca).mtimeMs < 7 * 864e5) return { paso: 'dependencias', ok: true, omitido: true, salida: 'revisadas esta semana' };
  const [cmd, ...args] = process.platform === 'win32' ? ['cmd.exe', '/d', '/c', 'npm', 'audit', '--omit=dev', '--json'] : ['npm', 'audit', '--omit=dev', '--json'];
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: new URL('.', raiz), timeout: 120000 });
  try {
    const v = JSON.parse(r.stdout).metadata.vulnerabilities, total = Object.values(v).reduce((a, b) => a + b, 0);
    writeFileSync(marca, JSON.stringify({ fecha: new Date().toISOString(), ...v }));
    return { paso: 'dependencias', ok: total === 0, salida: total ? `${total} vulnerabilidades: correr npm audit fix en bolsa-ny` : 'sin vulnerabilidades conocidas' };
  } catch { return { paso: 'dependencias', ok: true, omitido: true, salida: 'npm audit no respondió (sin internet?)' }; }
}
// Sube a GitHub los resúmenes nuevos de datos/ (la nube rearma y publica la página sola). Solo en la PC, y solo si hay algo nuevo.
function subirResumenes() {
  if (process.env.GITHUB_ACTIONS || !existsSync(new URL('./.git', raiz))) return null;
  const git = existsSync('C:/Program Files/Git/cmd/git.exe') ? 'C:/Program Files/Git/cmd/git.exe' : 'git';
  const g = (...a) => spawnSync(git, a, { cwd: new URL('.', raiz), encoding: 'utf8', timeout: 120000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } }); // nunca quedarse esperando una ventana
  g('add', '--', 'datos/*.json');
  if (g('diff', '--cached', '--quiet', '--', 'datos').status === 0) return null; // nada nuevo
  const c = g('commit', '-q', '-m', 'Resúmenes nuevos', '--', 'datos');
  let p = g('push', '-q');
  if (p.status !== 0) { g('pull', '--rebase', '-q'); p = g('push', '-q'); } // alguien subió código desde otro lado
  return { paso: 'nube', intentos: 1, ok: c.status === 0 && p.status === 0,
    salida: p.status === 0 ? 'resúmenes subidos a GitHub' : ((c.stderr || '') + (p.stderr || '')).trim().slice(-800) };
}
function registrar(e) {
  appendFileSync(new URL('ejecuciones.jsonl', logs), JSON.stringify(e) + '\n');
  const ultimas = readFileSync(new URL('ejecuciones.jsonl', logs), 'utf8').trim().split('\n').slice(-60).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  writeFileSync(new URL('ejecuciones.js', logs), 'window.EJECUCIONES = ' + JSON.stringify(ultimas) + ';\n');
}

const nube = subirResumenes(); // va antes del horario: la tarea de Claude puede escribir un resumen fuera de la ventana
if (nube) registrar({ inicio: new Date().toISOString(), segundos: 0, motivo: 'subida a la nube', ok: nube.ok, pasos: [nube] });
if (!process.env.GITHUB_ACTIONS) { // video del día: imágenes y guion de cada resumen nuevo (solo en la PC, usa Edge)
  const v = correr('videos.mjs');
  if (/Video listo/.test(v.salida) || !v.ok) registrar({ inicio: new Date().toISOString(), segundos: 0, motivo: 'video del día', ok: v.ok, pasos: [{ paso: 'video', intentos: 1, ...v }] });
}

const siToca = process.argv.includes('--si-toca');
let ventana = null;
if (siToca) {
  ventana = ventanaNY();
  const estadoF = new URL('ultima-ventana.txt', logs);
  if (!ventana || (existsSync(estadoF) && readFileSync(estadoF, 'utf8').trim() === ventana)) { // fuera de ventana o ya corrió
    if (extendidaNY()) { // solo el precio fuera de horario (un pedido); no se registra para no llenar el registro cada 15 minutos
      console.log(correr('fuera-horario.mjs').salida);
      if (process.env.GITHUB_ACTIONS) correr('datos.mjs'); // la nube necesita datos.js para volver a publicar
    }
    process.exit(0);
  }
}
const lock = new URL('.ejecutando', logs);
if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 20 * 60e3) { console.log('Ya hay una actualización en curso.'); process.exit(0); }
writeFileSync(lock, String(process.pid));

const inicio = new Date(), pasos = [];
try {
  let precios;
  for (let intento = 1; intento <= 3; intento++) { // reintentos espaciados: 0, 1 y 3 minutos
    precios = { paso: 'precios', intentos: intento, ...correr('acciones.mjs') };
    if (precios.ok) break;
    if (intento < 3) await espera(intento === 1 ? 60e3 : 180e3);
  }
  pasos.push(precios);
  if (precios.ok) { // analistas, balances y SEC: el script mismo se saltea si ya corrió en las últimas 20 horas
    const e = { paso: 'empresas', intentos: 1, ...correr('empresas.mjs') };
    if (/menos de 20 horas/.test(e.salida)) e.omitido = true;
    pasos.push(e);
  }
  if (precios.ok && (extendidaNY() || !siToca)) pasos.push({ paso: 'fuera de horario', intentos: 1, ...correr('fuera-horario.mjs') });
  if (ventana || process.argv.includes('--noticias')) { // noticias por API: solo si hay clave en .env (salida 3 = sin clave, se omite)
    const n = { paso: 'noticias', intentos: 1, ...correr('noticias.mjs', ventana ? ventana.split('-').at(-1) : '') };
    if (n.codigo === 3) { n.ok = true; n.omitido = true; }
    pasos.push(n);
  }
  pasos.push({ paso: 'historial', intentos: 1, ...correr('datos.mjs') });
  pasos.push({ paso: 'alertas', intentos: 1, ...correr('alertas.mjs') });
  pasos.push(respaldo(), auditoria());
} finally {
  const ok = pasos.length >= 2 && pasos.every(p => p.ok);
  registrar({ inicio: inicio.toISOString(), segundos: Math.round((Date.now() - inicio) / 1000), motivo: siToca ? 'programada ' + ventana : 'manual', ok, pasos });
  if (ok && ventana) writeFileSync(new URL('ultima-ventana.txt', logs), ventana);
  try { unlinkSync(lock); } catch { /* ya no estaba */ }
  console.log(ok ? 'Actualización completa.' : 'La actualización tuvo errores: ver logs/ejecuciones.jsonl');
  process.exitCode = ok ? 0 : 1;
}
