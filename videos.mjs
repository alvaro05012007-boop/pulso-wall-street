// Video del día: con cada resumen nuevo arma 7 imágenes verticales (1080x1920, TikTok/Reels/Shorts) y el guion para leer.
// Sale todo del resumen (datos/*.json): noticia principal, índices, los puntos "en segundos" y la agenda. Sin IA ni inventos.
// Escribe en ../negocio-pulso/videos/<id del resumen>/ (fuera de la página: no se publica) y avisa con una notificación.
// Uso: node videos.mjs [<id o fecha>]   (sin nada: los resúmenes de los últimos 2 días que todavía no tienen video)
// Lo llama actualizar.mjs en la PC cada 15 minutos. Necesita Microsoft Edge (viene con Windows) para sacar las imágenes.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert';
import { notificar } from './notificar.mjs';
import { huboRueda } from './feriados.mjs';

const raiz = fileURLToPath(new URL('./', import.meta.url));
const DESTINO = join(raiz, '..', 'negocio-pulso', 'videos');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const LINK = 'pulso-wallstreet.pages.dev';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// pinta los porcentajes de verde o rojo según el signo (después de escapar: el texto viene de la web)
const colorear = s => esc(s).replace(/([+\-−]?)(\d{1,3}(?:\.\d{3})*(?:,\d+)?%)/g, (m, signo) => `<span class="${signo === '+' ? 'sube' : signo ? 'baja' : ''}">${m}</span>`);
// corta un texto largo en el final de una oración o en una palabra, para que entre en la imagen
function recortar(s, max) {
  s = String(s ?? '').trim(); if (s.length <= max) return s;
  const corte = s.slice(0, max), fin = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('; '), corte.lastIndexOf(': '));
  return fin >= max * 0.5 ? corte.slice(0, fin + 1).replace(/[;:]$/, '.') : corte.slice(0, corte.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
}
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = f => { const d = new Date(f + 'T12:00:00'); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const verbo = v => v == null ? 'quedó sin dato' : v > 0 ? `subió ${String(v).replace('.', ',')}%` : v < 0 ? `bajó ${String(-v).replace('.', ',')}%` : 'quedó sin cambios';
const segundos = t => Math.max(4, Math.round(String(t).split(/\s+/).length / 2.8)); // unas 2,8 palabras por segundo (ritmo de video corto)

export function armar(r) {
  const cierre = r.momento === 'cierre';
  const principal = (r.noticias || []).find(n => n.importancia === 'alta') || r.noticias?.[0];
  const idx = (r.indices || []).filter(i => /S&P 500|Dow|Nasdaq/.test(i.nombre)).slice(0, 3);
  const puntos = (r.enSegundos || []).filter(p => p && p !== principal?.titulo).slice(0, 4);
  const claves = (puntos.length > 3 ? puntos.slice(1) : puntos).slice(0, 2).map(p => recortar(p, 170)); // 2 claves: el video queda en menos de un minuto
  const may = t => t.charAt(0).toUpperCase() + t.slice(1);
  const agenda = (r.proximos || []).slice(0, 3).map(p => { const i = String(p).indexOf(':'); return i > 0 && i < 26 ? [p.slice(0, i), may(recortar(p.slice(i + 1).split(';')[0].trim(), 75))] : ['', may(recortar(p, 90))]; });
  const titulo = recortar(principal?.titulo || (cierre ? 'Así cerró Wall Street' : 'Así arranca Wall Street'), 90);
  const placas = [], voz = [];
  // Los índices son del día solo si hubo rueda y el resumen es del cierre; si no, son del último cierre (feriado, fin de semana o antes de abrir)
  const delDia = cierre && huboRueda(r.fecha);
  const rotulo = delDia ? 'Cómo cerraron' : cierre ? 'Hoy no hubo rueda · último cierre' : 'Cierre anterior';

  placas.push(`<span class="eyebrow">${cierre ? (delDia ? 'Cierre' : 'Bolsa cerrada') : 'Antes de la apertura'} · ${esc(fechaLarga(r.fecha))}</span>
    <h1 class="${titulo.length > 60 ? 'chico' : ''}">${colorear(titulo)}</h1>
    ${delDia && idx[0]?.cambioPct != null ? `<p>El S&amp;P 500 cerró ${idx[0].cambioPct >= 0 ? 'con una suba' : 'con una baja'} de <span class="${idx[0].cambioPct >= 0 ? 'sube' : 'baja'}">${esc(String(Math.abs(idx[0].cambioPct)).replace('.', ','))}%</span>.</p>` : ''}`);
  voz.push(`${may(fechaLarga(r.fecha))}, ${cierre ? 'cierre' : 'antes de la apertura'}. ${titulo}.`);

  if (idx.length) {
    placas.push(`<span class="eyebrow">${rotulo}</span><h2>Los tres grandes índices</h2>
      <div class="tabla">${idx.map(i => `<div class="fila"><span>${esc(i.nombre)}</span><strong class="${i.cambioPct > 0 ? 'sube' : i.cambioPct < 0 ? 'baja' : ''}">${esc(i.cambio)}</strong></div>`).join('')}</div>`);
    const partes = idx.map(i => `el ${i.nombre} ${verbo(i.cambioPct)}`);
    const frase = partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes.at(-1) : partes[0]; // los decimales llevan coma: no se separa con regex
    voz.push(delDia ? frase.replace(/^el/, 'El') + '.' : (cierre ? 'Hoy no hubo rueda. En el último cierre, ' : 'En el cierre anterior, ') + frase + '.');
  }
  claves.forEach((c, k) => {
    placas.push(`<span class="eyebrow">Clave ${k + 1} de ${claves.length}</span><p class="grande">${colorear(c)}</p>`);
    voz.push(c);
  });
  if (agenda.length) {
    placas.push(`<span class="eyebrow">Qué viene</span><h2>Para tener en el radar</h2>
      <div class="lista">${agenda.map(([cuando, que]) => `<div class="item"><span class="cuando">${esc(cuando)}</span><span class="que">${colorear(que)}</span></div>`).join('')}</div>`);
    voz.push('Qué viene: ' + agenda.map(([c, q]) => (c ? c + ', ' + q.charAt(0).toLowerCase() + q.slice(1) : q).replace(/\.$/, '')).join('. ') + '.');
  }
  placas.push(`<h1>La bolsa de Nueva York, <span class="sube">explicada simple</span>, todos los días</h1>
    <p>Resumen gratis antes de la apertura y después del cierre, con precios en vivo.</p>
    <span class="link">${LINK}</span><p class="aviso">Información, no consejo de inversión. No dice qué comprar ni vender.</p>`);
  voz.push('Si querés entender la bolsa de Nueva York, simple y todos los días, el resumen gratis está en el link de mi perfil.');
  return { placas, voz, titulo };
}

const CSS = `:root { --noche:#070B24; --panel:#10173D; --linea:#26306B; --hielo:#E4EAFF; --suave:#A9B3DE; --sube:#4FE3C1; --baja:#FF6B8B;
  --display:"Unbounded","Segoe UI",sans-serif; --texto:"Instrument Sans","Segoe UI",sans-serif; }
* { box-sizing: border-box; } html, body { margin:0; width:1080px; height:1920px; overflow:hidden; background:var(--noche); color:var(--hielo); font-family:var(--texto); }
/* zona segura de TikTok/Reels: nada importante en los 330 px de abajo ni en los 150 px de la derecha */
.placa { position:relative; width:1080px; height:1920px; padding:170px 150px 330px 90px; display:none; flex-direction:column; justify-content:center; gap:44px;
  background: radial-gradient(900px 700px at 85% 8%, #1B2a7a55, transparent 70%), radial-gradient(700px 600px at 0% 100%, #4FE3C11c, transparent 70%), var(--noche); }
.placa.ver { display:flex; }
.marca { position:absolute; top:90px; left:90px; display:flex; align-items:center; gap:18px; font:700 34px var(--display); }
.marca i { width:26px; height:26px; border-radius:50%; background:var(--sube); box-shadow:0 0 30px var(--sube); }
.paso { position:absolute; top:96px; right:150px; font:600 28px var(--texto); color:var(--suave); }
.eyebrow { font:700 34px var(--texto); letter-spacing:.12em; text-transform:uppercase; color:var(--sube); }
h1 { margin:0; font:800 92px/1.06 var(--display); letter-spacing:-.02em; text-wrap:balance; } h1.chico { font-size:72px; }
h2 { margin:0; font:700 74px/1.1 var(--display); letter-spacing:-.015em; text-wrap:balance; }
p { margin:0; font:500 46px/1.35 var(--texto); color:var(--suave); max-width:18em; }
p.grande { font:600 58px/1.32 var(--texto); color:var(--hielo); text-wrap:pretty; }
.sube { color:var(--sube); } .baja { color:var(--baja); }
.tabla { display:grid; gap:22px; } .fila { display:flex; justify-content:space-between; align-items:baseline; gap:24px; padding:30px 38px; border-radius:28px; background:var(--panel); box-shadow:0 0 0 2px var(--linea); }
.fila span { font:600 48px var(--texto); } .fila strong { white-space:nowrap; font:800 64px var(--display); font-variant-numeric:tabular-nums; }
.lista { display:grid; gap:30px; } .item { display:grid; grid-template-columns:230px 1fr; gap:26px; align-items:baseline; }
.item .cuando { font:700 38px var(--display); color:var(--sube); } .item .que { font:500 42px/1.3 var(--texto); }
.link { align-self:flex-start; white-space:nowrap; padding:26px 40px; border-radius:999px; background:var(--hielo); color:var(--noche); font:700 44px var(--display); }
.aviso { font:500 32px/1.4 var(--texto); opacity:.8; }`;

function html(placas) {
  const total = placas.length;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Placas</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Instrument+Sans:wght@500;600;700&display=swap">
<style>${CSS}</style></head><body>
${placas.map((p, i) => `<section class="placa" data-n="${i + 1}"><div class="marca"><i></i>Pulso de Wall Street</div>${i > 0 && i < total - 1 ? `<span class="paso">${i}/${total - 2}</span>` : ''}${p}</section>`).join('\n')}
<script>document.querySelector('.placa[data-n="' + (new URLSearchParams(location.search).get('s') || '1') + '"]')?.classList.add('ver');</script>
</body></html>`;
}

function guion(r, { voz, titulo }) {
  let t = 0;
  const filas = voz.map((v, i) => { const d = segundos(v), f = `| placa-${i + 1}.png | ${t} a ${t + d} | ${v.replace(/\|/g, '/')} |`; t += d; return f; });
  return `# Video · ${titulo}

Resumen de Pulso del ${fechaLarga(r.fecha)}, ${r.hora} (${r.momento === 'cierre' ? 'cierre' : 'antes de la apertura'}). Duración: unos ${t} segundos.
Armado automático a partir del resumen: revisá que todo se lea bien antes de publicar.

| Imagen | Segundos | Lo que decís (voz) |
|---|---|---|
${filas.join('\n')}

## Armarlo en CapCut
Importá las imágenes en orden, ajustá los segundos, grabá la voz (o "Texto a voz"), "Subtítulos automáticos" y exportá en 1080p.

## Texto para la publicación
> ${titulo}. Lo más importante de Wall Street ${r.momento === 'cierre' ? 'de hoy' : 'antes de que abra'}, en un minuto.
> Resumen gratis de la bolsa de Nueva York, todos los días y en español: link en el perfil.
> Información, no consejo de inversión.

#WallStreet #bolsa #finanzas #acciones #inversiones #SP500 #Nasdaq #DowJones #economia #finanzaspersonales
`;
}

function fotos(dir, n) {
  const perfil = join(tmpdir(), 'pulso-edge-videos'), pagina = pathToFileURL(join(dir, 'placas.html')).href;
  for (let i = 1; i <= n; i++) {
    const r = spawnSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1920',
      '--virtual-time-budget=6000', `--user-data-dir=${perfil}`, `--screenshot=${join(dir, `placa-${i}.png`)}`, `${pagina}?s=${i}`], { timeout: 60000 });
    if (!existsSync(join(dir, `placa-${i}.png`))) throw new Error(`Edge no pudo sacar la imagen ${i} (${r.status})`);
  }
}

// ---- MP4 con voz: voz de Windows en español (sin internet) + ffmpeg (instalado con winget) ----
const FFMPEG = (() => {
  const enPath = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (enPath.status === 0) return 'ffmpeg';
  const base = join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  try { // la tarea programada puede no tener el PATH nuevo: se busca donde lo deja winget
    for (const d of readdirSync(base).filter(d => d.startsWith('Gyan.FFmpeg')))
      for (const v of readdirSync(join(base, d))) { const f = join(base, d, v, 'bin', 'ffmpeg.exe'); if (existsSync(f)) return f; }
  } catch { /* sin winget */ }
  return null;
})();
// cómo se lee en voz alta (la voz de Windows lee mal siglas y fechas con barra)
export function paraVoz(t) {
  return String(t)
    .replace(/S&P 500/g, 'ese ande pe quinientos').replace(/S&P/g, 'ese ande pe')
    .replace(/EE\.\s?UU\./g, 'Estados Unidos').replace(/\bDXY\b/g, 'índice dólar').replace(/\bIA\b/g, 'inteligencia artificial')
    .replace(/(\d+(?:,\d+)?)%-(\d+(?:,\d+)?)%/g, 'entre $1 y $2%')
    .replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (m, d, mes) => MESES[+mes - 1] ? `${+d} de ${MESES[+mes - 1]}` : m)
    .replace(/[()]/g, ', ');
}
function mp4(dir, voz) {
  if (!FFMPEG) throw new Error('falta ffmpeg (winget install Gyan.FFmpeg)');
  const ps = `Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'es-*' } | Select-Object -First 1
if (-not $v) { exit 4 }
$s.SelectVoice($v.VoiceInfo.Name); $s.Rate = 3
$t = $env:PULSO_VOCES | ConvertFrom-Json
for ($i = 0; $i -lt $t.Count; $i++) { $s.SetOutputToWaveFile((Join-Path $env:PULSO_DIR ('voz-' + ($i + 1) + '.wav'))); $s.Speak([string]$t[$i]) }
$s.Dispose()`;
  // los textos viajan por variables de entorno: nunca se arma código de PowerShell con datos
  const v = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 180000,
    env: { ...process.env, PULSO_VOCES: JSON.stringify(voz.map(paraVoz)), PULSO_DIR: dir } });
  if (v.status !== 0) throw new Error(v.status === 4 ? 'Windows no tiene una voz en español' : 'no se pudo generar la voz: ' + (v.stderr || '').slice(-200));
  const lista = [];
  for (let i = 1; i <= voz.length; i++) { // un tramo por imagen: dura lo que la voz más un respiro corto
    const seg = join(dir, `tramo-${i}.mp4`);
    const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', join(dir, `placa-${i}.png`), '-i', join(dir, `voz-${i}.wav`),
      '-af', 'apad=pad_dur=0.3', '-shortest', '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', seg], { encoding: 'utf8', timeout: 180000 });
    if (r.status !== 0) throw new Error('ffmpeg falló en el tramo ' + i + ': ' + (r.stderr || '').slice(-200));
    lista.push(`file '${seg.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
  }
  writeFileSync(join(dir, 'tramos.txt'), lista.join('\n'));
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'tramos.txt'), '-c', 'copy', '-movflags', '+faststart', join(dir, 'video.mp4')], { encoding: 'utf8', timeout: 180000 });
  if (r.status !== 0) throw new Error('ffmpeg no pudo unir los tramos: ' + (r.stderr || '').slice(-200));
  for (let i = 1; i <= voz.length; i++) { rmSync(join(dir, `tramo-${i}.mp4`), { force: true }); rmSync(join(dir, `voz-${i}.wav`), { force: true }); }
  rmSync(join(dir, 'tramos.txt'), { force: true });
}

// Pruebas del armado (sin Edge ni archivos)
{
  const r = { id: 'x', fecha: '2026-11-25', hora: '19:52', momento: 'cierre', indices: [{ nombre: 'S&P 500', cambio: '-0,25%', cambioPct: -0.25 }, { nombre: 'Dow Jones', cambio: '+0,33%', cambioPct: 0.33 }, { nombre: 'Nasdaq', cambio: '-0,62%', cambioPct: -0.62 }],
    noticias: [{ titulo: 'Wall <b>borra</b> una caída', importancia: 'alta' }], enSegundos: ['uno', 'dos +3,2%', 'tres', 'cuatro'], proximos: ['Viernes 27/11: rueda corta.'] };
  const a = armar(r);
  assert.equal(a.placas.length, 6);
  assert.ok(!a.placas.join('').includes('<b>borra'), 'el texto de la web se escapa');
  assert.ok(a.placas[2].includes('class="sube">+3,2%'));
  assert.equal(a.voz[1], 'El S&P 500 bajó 0,25%, el Dow Jones subió 0,33% y el Nasdaq bajó 0,62%.');
  assert.equal(recortar('Hola mundo. Esto es largo y sigue', 20), 'Hola mundo.');
  const feriado = armar({ ...r, fecha: '2026-11-26' }); // Acción de Gracias: los índices son del último cierre
  assert.ok(feriado.placas[0].includes('Bolsa cerrada') && !feriado.placas[0].includes('cerró con'));
  assert.ok(feriado.voz[1].startsWith('Hoy no hubo rueda. En el último cierre, el S&P 500 bajó 0,25%'));
  assert.equal(paraVoz('Viernes 27/11: el S&P 500 y EE.UU. (DXY) 4,86%-4,89%'), 'Viernes 27 de noviembre: el ese ande pe quinientos y Estados Unidos , índice dólar,  entre 4,86 y 4,89%');
}

const arg = process.argv.slice(2).find(a => !a.startsWith('--'));
const archivos = readdirSync(join(raiz, 'datos')).filter(f => /^\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(f)).sort();
const limite = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
const elegidos = arg ? archivos.filter(f => f.startsWith(arg)) : archivos.filter(f => f.slice(0, 10) >= limite);
const hechos = [];
for (const f of elegidos) {
  const id = f.replace('.json', ''), dir = join(DESTINO, id);
  if (!arg && existsSync(join(dir, 'guion.md'))) continue; // ya tiene video
  if (!EDGE) { console.error('No encontré Microsoft Edge: no puedo sacar las imágenes.'); process.exit(1); }
  let r; try { r = JSON.parse(readFileSync(join(raiz, 'datos', f), 'utf8')); } catch { continue; }
  const a = armar(r);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir).filter(f => /^placa-\d+\.png$/.test(f))) rmSync(join(dir, f)); // sin restos de una versión anterior
  writeFileSync(join(dir, 'placas.html'), html(a.placas));
  try { fotos(dir, a.placas.length); } catch (e) { rmSync(join(dir, 'guion.md'), { force: true }); console.error(`${id}: ${e.message}`); process.exitCode = 1; continue; }
  try { mp4(dir, a.voz); } catch (e) { console.error(`${id}: sin MP4 (${e.message}); quedan las imágenes y el guion.`); }
  const g = guion(r, a), pub = g.split('## Texto para la publicación\n')[1] || '';
  writeFileSync(join(dir, 'texto-publicacion.txt'), pub.replace(/^> /gm, '').trim() + '\n'); // para copiar y pegar en TikTok
  writeFileSync(join(dir, 'guion.md'), g); // se escribe al final: sin guion = se reintenta en la próxima pasada
  hechos.push(id); console.log(`Video listo: negocio-pulso/videos/${id}`);
}
if (hechos.length && !process.argv.includes('--sin-aviso')) notificar('Pulso de Wall Street', `Video del día listo (${hechos.at(-1)}): video.mp4 y texto para TikTok en negocio-pulso/videos.`);
if (!hechos.length && !process.exitCode) console.log('No hay resúmenes nuevos para video.');
