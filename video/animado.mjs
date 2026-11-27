// Video animado del día: escenas + voz + efectos + música -> video.mp4 (1080x1920, 30 fps). Lo usa videos.mjs.
// 1) arma las escenas desde el resumen (si el resumen trae el bloque "video" escrito por Claude, usa ese guion),
// 2) genera la voz de cada escena, 3) calcula tiempos y subtítulos, 4) saca los cuadros con render.mjs (Edge),
// 5) mezcla voz + efectos + base musical (todo sintetizado acá, sin derechos de autor) y 6) une todo con ffmpeg.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { huboRueda } from '../feriados.mjs';

const aqui = fileURLToPath(new URL('.', import.meta.url));
const CACHE = join(process.env.LOCALAPPDATA || aqui, 'PulsoVideo');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function recortar(s, max) {
  s = String(s ?? '').trim(); if (s.length <= max) return s;
  const corte = s.slice(0, max), fin = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('; '), corte.lastIndexOf(': '));
  return fin >= max * 0.5 ? corte.slice(0, fin + 1).replace(/[;:]$/, '.') : corte.slice(0, corte.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
}
// cómo se lee en voz alta (las voces leen mal siglas y fechas con barra)
export function paraVoz(t) {
  return String(t)
    // nombres en inglés escritos como suenan (la voz lee todo con fonética española); revisado transcribiendo el audio con Whisper
    .replace(/S&P 500/g, 'es and pi quinientos').replace(/S&P/g, 'es and pi')
    .replace(/Wall Street/g, 'Wol Strít').replace(/Dow Jones/g, 'Dau Yons').replace(/\bDow\b/g, 'Dau').replace(/Nasdaq/g, 'Násdac')
    .replace(/Black Friday/gi, 'Blak Fráidei').replace(/Cyber Monday/gi, 'Sáiber Mándei').replace(/Nvidia/gi, 'Envidia').replace(/\bGoogle\b/g, 'Gúgol')
    .replace(/\bApple\b/g, 'Ápol').replace(/Microsoft/g, 'Máicrosoft').replace(/OPEP\+/g, 'OPEP plus').replace(/\bFed\b/g, 'la Fed').replace(/la la Fed/g, 'la Fed')
    .replace(/\brueda\b/g, 'jornada').replace(/\bruedas\b/g, 'jornadas')
    .replace(/EE\.\s?UU\./g, 'Estados Unidos').replace(/\bDXY\b/g, 'índice dólar').replace(/\bIA\b/g, 'inteligencia artificial')
    .replace(/\bpts\b/g, 'puntos').replace(/−/g, 'menos ')
    .replace(/(\d+(?:,\d+)?)%-(\d+(?:,\d+)?)%/g, 'entre $1 y $2%')
    .replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (m, d, mes) => MESES[+mes - 1] ? `${+d} de ${MESES[+mes - 1]}` : m)
    .replace(/\s*\([^)]*\)?/g, '').replace(/…/g, '.');
}
const DIA3 = { lunes: 'Lun', martes: 'Mar', 'miércoles': 'Mié', jueves: 'Jue', viernes: 'Vie', 'sábado': 'Sáb', domingo: 'Dom' };
const corto = s => s.replace(/^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)(?![a-záéíóú])/i, d => DIA3[d.toLowerCase()] || d).replace(/^Inicio de /i, 'Inicio ');
const verbo = v => v == null ? 'quedó sin dato' : v > 0 ? `subió ${String(v).replace('.', ',')}%` : v < 0 ? `bajó ${String(-v).replace('.', ',')}%` : 'quedó sin cambios';
const txt = (x, max) => recortar(typeof x === 'string' ? x : '', max);
const numDe = s => (String(s).match(/[+\-−]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s?(?:%|pts|puntos)/) || [])[0]?.replace(/puntos/, 'pts').replace(/^-/, '−') || null;
const signoDe = s => /cay|baj|perd|desplom|retroce|hund|ca[ií]da/i.test(s) ? -1 : /sub|gan|rebot|r[eé]cord|salt|trep|dispar/i.test(s) ? 1 : 0;

// ---------- 1. escenas ----------
export function escenas(r) {
  const cierre = r.momento === 'cierre', delDia = cierre && huboRueda(r.fecha), v = r.video && typeof r.video === 'object' ? r.video : null;
  const principal = (r.noticias || []).find(n => n.importancia === 'alta') || r.noticias?.[0];
  const idx = (r.indices || []).filter(i => /S&P 500|Dow|Nasdaq/.test(i.nombre)).slice(0, 3);
  const out = [];
  // gancho
  if (v?.gancho?.voz) out.push({ tipo: 'gancho', voz: txt(v.gancho.voz, 140), pantalla: txt(v.gancho.pantalla || v.gancho.voz, 60), numero: txt(v.gancho.numero, 14) || null, signo: signoDe(v.gancho.voz) });
  else {
    const t = txt(principal?.titulo || 'Esto pasó en Wall Street', 70);
    out.push({ tipo: 'gancho', voz: (cierre ? 'Esto pasó hoy en Wall Street. ' : 'Así arranca Wall Street. ') + t, pantalla: txt(t, 48), numero: numDe(t) || numDe(principal?.resumen || ''), signo: signoDe(t) });
  }
  // índices (siempre de los datos, nunca escritos a mano)
  if (idx.length) {
    const partes = idx.map(i => `el ${i.nombre} ${verbo(i.cambioPct)}`), frase = partes.slice(0, -1).join(', ') + (partes.length > 1 ? ' y ' : '') + partes.at(-1);
    out.push({ tipo: 'indices', eyebrow: delDia ? 'Cómo cerraron' : cierre ? 'Hoy no hubo rueda · último cierre' : 'Cierre anterior', pantalla: 'Los tres grandes',
      filas: idx.map(i => ({ nombre: i.nombre, cambio: String(i.cambio || ''), pct: i.cambioPct })),
      voz: delDia ? frase.replace(/^el/, 'El') + '.' : (cierre ? 'Hoy no hubo rueda. En el último cierre, ' : 'En el cierre anterior, ') + frase + '.' });
  }
  // datos
  const datos = Array.isArray(v?.datos) && v.datos.length ? v.datos.slice(0, 3).map(d => ({ voz: txt(d.voz, 230), pantalla: txt(d.pantalla || d.voz, 60), numero: txt(d.numero, 14) || null, signo: [1, -1, 0].includes(d.signo) ? d.signo : signoDe(d.voz || '') }))
    : (r.enSegundos || []).filter(p => p && p !== principal?.titulo).slice(1, 3).map(p => ({ voz: recortar(p, 170), pantalla: recortar(p.split(/[:;]|,\s/)[0], 48), numero: numDe(p), signo: signoDe(p) }));
  datos.forEach((d, k) => out.push({ tipo: 'dato', k: k + 1, de: datos.length, ...d }));
  // agenda
  const items = (r.proximos || []).slice(0, 2).map(p => { const i = String(p).indexOf(':');
    // en pantalla el día va corto ("Vie 27/11"); en la voz, completo y sin lo que está entre paréntesis
    const que = p.slice(i + 1).split(';')[0].replace(/\s*\([^)]*\)/g, '').trim();
    return i > 0 && i < 26 ? { cuando: corto(p.slice(0, i).trim()), dicho: p.slice(0, i).trim(), que: recortar(que, 60) } : { cuando: '', dicho: '', que: recortar(p, 70) }; });
  if (items.length) out.push({ tipo: 'agenda', pantalla: 'Para tener en el radar', items, voz: 'Lo que viene: ' + items.map(it => (it.dicho ? it.dicho + ', ' : '') + it.que.charAt(0).toLowerCase() + it.que.slice(1).replace(/[.…]+$/, '')).join('. ') + '.' });
  out.push({ tipo: 'cierre', pantalla: 'Seguime', sub: cierre ? 'Mañana te cuento qué pasó' : 'A la tarde te cuento cómo cerró', link: 'pulso-wallstreet.pages.dev',
    voz: txt(v?.cierre?.voz, 140) || 'Seguime y no te perdés el resumen de mañana.' });
  return out.filter(e => e.voz);
}

// ---------- 2. voz ----------
const duracionWav = f => { const b = readFileSync(f); let p = 12, rate = 0, size = 0; while (p < b.length - 8) { const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4); if (id === 'fmt ') rate = b.readUInt32LE(p + 16); if (id === 'data') { size = n; break; } p += 8 + n + (n % 2); } return rate ? size / rate : 0; };
// Voz neural argentina (Piper + voz "Daniela", CC BY-SA 4.0) si está instalada y habilitada con el archivo usar-piper;
// si no, la voz de Windows en español. El texto entra por la entrada estándar: nunca se arma un comando con datos.
const PIPER = join(CACHE, 'piper', 'piper.exe'), VOZ_PIPER = join(CACHE, 'voces', 'es_AR-daniela-high.onnx');
export const hayPiper = () => existsSync(PIPER) && existsSync(VOZ_PIPER) && existsSync(join(CACHE, 'usar-piper'));
function hablar(textos, dir) {
  if (hayPiper()) {
    return textos.map((t, i) => {
      const f = join(dir, `voz-${i + 1}.wav`);
      const r = spawnSync(PIPER, ['--model', VOZ_PIPER, '--output_file', f, '--length_scale', '0.88', '--sentence_silence', '0.15'], { input: paraVoz(t), encoding: 'utf8', timeout: 120000 });
      if (r.status !== 0 || !existsSync(f)) throw new Error('Piper no pudo generar la voz');
      return { f, d: duracionWav(f) };
    });
  }
  const ps = `Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'es-*' } | Select-Object -First 1
if (-not $v) { exit 4 }
$s.SelectVoice($v.VoiceInfo.Name); $s.Rate = 2
$t = $env:PULSO_VOCES | ConvertFrom-Json
for ($i = 0; $i -lt $t.Count; $i++) { $s.SetOutputToWaveFile((Join-Path $env:PULSO_DIR ('voz-' + ($i + 1) + '.wav'))); $s.Speak([string]$t[$i]) }
$s.Dispose()`;
  // los textos viajan por variables de entorno: nunca se arma código de PowerShell con datos
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 240000, env: { ...process.env, PULSO_VOCES: JSON.stringify(textos.map(paraVoz)), PULSO_DIR: dir } });
  if (r.status !== 0) throw new Error(r.status === 4 ? 'Windows no tiene una voz en español' : 'no se pudo generar la voz');
  return textos.map((_, i) => { const f = join(dir, `voz-${i + 1}.wav`); return { f, d: duracionWav(f) }; });
}

// ---------- 3. tiempos y subtítulos ----------
export function tiempos(esc, voces) {
  let t = 0; const guion = { dur: 0, escenas: [] };
  esc.forEach((e, i) => {
    const lead = i === 0 ? 0.35 : 0.12, d = voces[i].d, a = t, ini = a + lead, b = ini + d + (e.tipo === 'cierre' ? 1.6 : e.tipo === 'agenda' ? 0.5 : 0.28);
    const ws = e.voz.split(/\s+/).filter(Boolean), peso = w => w.replace(/[^\p{L}\p{N}]/gu, '').length + 2, total = ws.reduce((s, w) => s + peso(w), 0) || 1;
    let p = ini; const palabras = ws.map(w => { const x = { w, a: p, b: p + d * peso(w) / total }; p = x.b; return x; });
    guion.escenas.push({ ...e, a, b, vozEn: ini, palabras }); t = b;
  });
  guion.dur = Math.round(t * 100) / 100;
  return guion;
}

// ---------- 5. efectos y base musical (sintetizados con ffmpeg) ----------
function sfx(ff) {
  const dir = join(CACHE, 'sfx'); mkdirSync(dir, { recursive: true });
  const def = {
    golpe: "aevalsrc='0.9*sin(2*PI*(42+90*exp(-14*t))*t)*exp(-5*t)+0.25*(2*random(0)-1)*exp(-30*t)':s=44100:d=1.1",
    whoosh: "anoisesrc=d=0.45:c=pink:a=0.6,highpass=f=500,lowpass=f=6000,afade=t=in:d=0.3,afade=t=out:st=0.3:d=0.15",
    tic: "aevalsrc='0.6*sin(2*PI*1600*t)*exp(-55*t)+0.3*sin(2*PI*2400*t)*exp(-80*t)':s=44100:d=0.12",
    subida: "aevalsrc='0.35*sin(2*PI*(200+900*t*t)*t)*t':s=44100:d=0.7,afade=t=out:st=0.6:d=0.1",
  };
  for (const [k, src] of Object.entries(def)) { const f = join(dir, k + '.wav'); if (!existsSync(f)) spawnSync(ff, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', src, f]); }
  return k => join(dir, k + '.wav');
}
function mezclar(ff, guion, voces, salida) {
  const S = sfx(ff), ins = [], filt = [], vozL = [], sfxL = [];
  voces.forEach((v, i) => { ins.push('-i', v.f); const ms = Math.round(guion.escenas[i].vozEn * 1000); filt.push(`[${ins.length / 2 - 1}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${i}]`); vozL.push(`[v${i}]`); });
  const pon = (k, t, vol) => { ins.push('-i', S(k)); const n = ins.length / 2 - 1, ms = Math.max(0, Math.round(t * 1000)); filt.push(`[${n}:a]aformat=channel_layouts=stereo,volume=${vol},adelay=${ms}|${ms}[s${n}]`); sfxL.push(`[s${n}]`); };
  guion.escenas.forEach((e, i) => {
    if (i === 0) pon('golpe', 0, 0.9); else pon('whoosh', e.a - 0.18, 0.55);
    if (e.numero) pon(e.tipo === 'gancho' ? 'golpe' : 'tic', e.a + (e.tipo === 'gancho' ? 0.35 : 0.1), e.tipo === 'gancho' ? 0.6 : 0.7);
    if (e.tipo === 'indices') (e.filas || []).forEach((_, k) => pon('tic', e.a + 0.15 + k * 0.32, 0.5));
    if (e.tipo === 'cierre') pon('subida', e.a - 0.6, 0.5);
  });
  // base: bombo y platillo a 100 por minuto más un acorde suave que respira (sintetizado: sin derechos de autor)
  const d = guion.dur + 0.5, beat = 0.6;
  const base = `aevalsrc='0.55*sin(2*PI*52*mod(t,${beat})*(1+1.6*exp(-28*mod(t,${beat}))))*exp(-9*mod(t,${beat}))+0.10*(2*random(0)-1)*exp(-70*mod(t+${beat / 2},${beat}))+0.035*(sin(2*PI*220*t)+sin(2*PI*261.63*t)+sin(2*PI*329.63*t))*(0.6+0.4*sin(2*PI*t/4.8))':s=44100:d=${d}`;
  ins.push('-f', 'lavfi', '-i', base);
  const idxBase = (ins.filter(x => x === '-i').length) - 1;
  filt.push(`[${idxBase}:a]aformat=channel_layouts=stereo,volume=0.32,afade=t=out:st=${Math.max(0, d - 1.2)}:d=1.2[base]`);
  filt.push(`${vozL.join('')}amix=inputs=${vozL.length}:normalize=0:duration=longest,volume=1.6[voz]`, `[voz]asplit=2[voz1][vozk]`);
  filt.push(`[base][vozk]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[baseb]`);
  filt.push(`[voz1]${sfxL.join('')}[baseb]amix=inputs=${sfxL.length + 2}:normalize=0:duration=first,atrim=0:${guion.dur},loudnorm=I=-14:TP=-1.5:LRA=11[out]`);
  const r = spawnSync(ff, ['-y', '-loglevel', 'error', ...ins, '-filter_complex', filt.join(';'), '-map', '[out]', '-ar', '44100', salida], { encoding: 'utf8', timeout: 300000 });
  if (r.status !== 0) throw new Error('no se pudo mezclar el audio: ' + (r.stderr || '').slice(-300));
}

// ---------- todo junto ----------
export function videoAnimado(r, dir, ff) {
  const trabajo = join(CACHE, 'trabajo', r.id || 'x'); rmSync(trabajo, { recursive: true, force: true }); mkdirSync(trabajo, { recursive: true });
  try {
    const esc = escenas(r), voces = hablar(esc.map(e => e.voz), trabajo), guion = tiempos(esc, voces);
    writeFileSync(join(trabajo, 'guion.json'), JSON.stringify(guion));
    const rr = spawnSync(process.execPath, [join(aqui, 'render.mjs'), join(trabajo, 'guion.json'), join(trabajo, 'cuadros')], { encoding: 'utf8', timeout: 30 * 60e3, cwd: aqui });
    if (rr.status !== 0) throw new Error('falló el dibujo de los cuadros: ' + ((rr.stderr || '') + (rr.stdout || '')).slice(-300));
    mezclar(ff, guion, voces, join(trabajo, 'audio.wav'));
    const enc = spawnSync(ff, ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(trabajo, 'cuadros', '%05d.jpg'), '-i', join(trabajo, 'audio.wav'),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', join(dir, 'video.mp4')], { encoding: 'utf8', timeout: 30 * 60e3 });
    if (enc.status !== 0) throw new Error('ffmpeg no pudo armar el video: ' + (enc.stderr || '').slice(-300));
    const portada = join(trabajo, 'cuadros', String(Math.round(1.6 * 30)).padStart(5, '0') + '.jpg'); // cuadro del gancho ya armado, para la portada
    if (existsSync(portada)) copyFileSync(portada, join(dir, 'portada.jpg'));
    return { guion, escenas: esc };
  } finally { rmSync(trabajo, { recursive: true, force: true }); }
}
