// Alertas con la página cerrada: lee alertas.json (lo exporta la pestaña "Mis listas"), las evalúa con los datos
// recién actualizados y avisa con una notificación de Windows. Lo llama actualizar.mjs; una alerta avisa una sola vez
// por versión de los datos (estado en logs/alertas-estado.json). Uso: node alertas.mjs [--probar]
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert';

const aqui = p => new URL(p, import.meta.url);
const leerJs = (archivo, global) => { // acciones.js / datos.js son "window.X = {...};"
  const t = readFileSync(aqui(archivo), 'utf8');
  return JSON.parse(t.slice(t.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
};
const pct = v => (v > 0 ? '+' : '') + v.toFixed(2).replace('.', ',') + '%';
const INDICES = { sp500: 'S&P 500', dow: 'Dow Jones', nasdaq: 'Nasdaq Composite', nasdaq100: 'Nasdaq 100', russell: 'Russell 2000', vix: 'VIX', bono10: 'Bono 10 años', wti: 'Petróleo WTI', dolar: 'Dólar (DXY)' };

const EVENTOS = { 'Fed y tasas': /(^|\W)(Fed|Reserva Federal|FOMC|Powell|tasas? de inter[eé]s)(\W|$)/i, 'Inflación': /(^|\W)(PCE|IPC|CPI|inflaci[oó]n)(\W|$)/i,
  'Empleo': /(^|\W)(empleo|desempleo|n[oó]minas|payrolls)(\W|$)/i, 'PIB': /(^|\W)(PIB|PBI|GDP)(\W|$)/i }; // iguales que en listas.js
export function evaluar(alertas, A, ultimo) { // devuelve [{id, version, texto}] de las alertas que se cumplen
  const out = [];
  for (const al of alertas) {
    if (al.tipo === 'evento') {
      const rx = EVENTOS[al.objetivo]; if (!ultimo || !rx) continue;
      const n = (ultimo.noticias || []).find(n => rx.test([n.titulo, n.resumen].join(' '))), prox = (ultimo.proximos || []).find(x => rx.test(x));
      if (n || prox) out.push({ id: al.id, version: ultimo.id, texto: n ? `${al.objetivo}: ${n.titulo}` : `${al.objetivo}, en la agenda: ${prox}` });
      continue;
    }
    if (al.tipo === 'noticia') {
      if (!ultimo) continue;
      const k = String(al.objetivo).toLowerCase();
      const n = (ultimo.noticias || []).find(n => [n.titulo, n.resumen, ...(n.afecta || [])].join(' ').toLowerCase().includes(k));
      if (n) out.push({ id: al.id, version: ultimo.id, texto: `Noticia: ${n.titulo}` });
      continue;
    }
    const x = A.lista.find(a => a.ticker === al.objetivo) || A.indices?.[al.objetivo]; if (!x) continue;
    const nombre = x.ticker || INDICES[al.objetivo] || al.objetivo;
    if (al.tipo === 'variacion' && Math.abs(x.cambio1d ?? 0) >= al.umbral) out.push({ id: al.id, version: A.actualizado, texto: `${nombre} se movió ${pct(x.cambio1d)} en la rueda` });
    if (al.tipo === 'volumen' && (x.volRel ?? 0) >= al.umbral) out.push({ id: al.id, version: A.actualizado, texto: `${nombre} negoció ${x.volRel.toFixed(1).replace('.', ',')} veces su volumen promedio` });
    if (al.tipo === 'volatilidad' && (x.volHist20 ?? 0) >= al.umbral) out.push({ id: al.id, version: A.actualizado, texto: `${nombre}: volatilidad de 20 ruedas de ${String(x.volHist20).replace('.', ',')}%` });
  }
  return out;
}
{ // pruebas
  const A = { actualizado: 'v1', lista: [{ ticker: 'NVDA', cambio1d: -5.9, volRel: 1.2, volHist20: 70 }], indices: { sp500: { cambio1d: -0.5 } } };
  const r = evaluar([{ id: 'a', tipo: 'variacion', objetivo: 'NVDA', umbral: 3 }, { id: 'b', tipo: 'variacion', objetivo: 'sp500', umbral: 1 },
    { id: 'c', tipo: 'noticia', objetivo: 'fed' }, { id: 'd', tipo: 'volumen', objetivo: 'NVDA', umbral: 2 },
    { id: 'e', tipo: 'evento', objetivo: 'Inflación' }, { id: 'f', tipo: 'evento', objetivo: 'Empleo' }],
    A, { id: 'r1', noticias: [{ titulo: 'La Fed sube tasas' }], proximos: ['Miércoles: dato de inflación PCE'] });
  assert.deepEqual(r.map(x => x.id), ['a', 'c', 'e']);
}

export function notificar(titulo, texto) { // notificación nativa de Windows (sin instalar nada)
  const esc = s => String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const xml = `<toast><visual><binding template="ToastGeneric"><text>${esc(titulo)}</text><text>${esc(texto)}</text></binding></visual></toast>`;
  const ps = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null
$x = New-Object Windows.Data.Xml.Dom.XmlDocument; $x.LoadXml($env:PULSO_TOAST)
$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($x))`;
  // el texto viaja por una variable de entorno: nunca se arma código de PowerShell con datos
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: { ...process.env, PULSO_TOAST: xml }, encoding: 'utf8', timeout: 20000 });
  return r.status === 0;
}

if (process.argv.includes('--probar')) { console.log(notificar('Pulso de Wall Street', 'Prueba de avisos: si ves esto, las alertas de Windows funcionan.') ? 'Notificación enviada.' : 'No se pudo mostrar la notificación.'); process.exit(0); }
// La página exporta "pulso-alertas.json" a Descargas: si hay una versión más nueva ahí, se usa esa.
const descargada = join(homedir(), 'Downloads', 'pulso-alertas.json'), local = aqui('./alertas.json');
if (existsSync(descargada) && (!existsSync(local) || statSync(descargada).mtimeMs > statSync(local).mtimeMs)) copyFileSync(descargada, local);
if (!existsSync(local)) { console.log('Sin alertas.json: no hay alertas para avisar.'); process.exit(0); }

let alertas;
try { alertas = JSON.parse(readFileSync(aqui('./alertas.json'), 'utf8')); } catch { console.error('alertas.json no es JSON válido.'); process.exit(1); }
alertas = (Array.isArray(alertas) ? alertas : []).filter(a => a && typeof a.id === 'string' && ['variacion', 'volumen', 'volatilidad', 'noticia', 'evento'].includes(a.tipo)
  && typeof a.objetivo === 'string' && (a.tipo === 'noticia' || a.tipo === 'evento' || Number.isFinite(a.umbral)));
const A = leerJs('./acciones.js'), D = leerJs('./datos.js'), ultimo = [...D].sort((a, b) => a.id < b.id ? 1 : -1)[0];
mkdirSync(aqui('./logs/'), { recursive: true });
const estadoF = aqui('./logs/alertas-estado.json');
const estado = existsSync(estadoF) ? JSON.parse(readFileSync(estadoF, 'utf8')) : {};
const nuevas = evaluar(alertas, A, ultimo).filter(x => estado[x.id] !== x.version);
for (const x of nuevas.slice(0, 5)) notificar('Pulso de Wall Street', x.texto);
for (const x of nuevas) estado[x.id] = x.version;
writeFileSync(estadoF, JSON.stringify(estado));
console.log(`${alertas.length} alertas revisadas, ${nuevas.length} avisadas.`);
