// Resúmenes de noticias sin Claude Code abierto: usa la API de Anthropic con búsqueda web del lado del servidor y escribe
// datos/AAAA-MM-DD-HHMM.json con el mismo formato que la tarea programada, validado antes de guardarlo.
// Necesita ANTHROPIC_API_KEY en bolsa-ny/.env (ver .env.example). Cada corrida tiene costo de API.
// Uso: node noticias.mjs [apertura|cierre]     Salida 3 = sin credenciales (se omite, no es error).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import assert from 'node:assert';
import Anthropic from '@anthropic-ai/sdk';
import { problemas } from './validar.mjs';

// .env simple, una CLAVE=valor por línea; no pisa variables que ya estén definidas
const archivoEnv = new URL('./.env', import.meta.url);
if (existsSync(archivoEnv)) for (const l of readFileSync(archivoEnv, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

export function extraerJSON(texto) { // el modelo entrega el JSON en un bloque de código; se prueba del último al primero
  const bloques = [...texto.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m => m[1]).reverse();
  for (const c of [...bloques, texto]) {
    const i = c.indexOf('{'), j = c.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(c.slice(i, j + 1)); } catch { /* sigue con el próximo */ } }
  }
  return null;
}
assert.deepEqual(extraerJSON('Listo:\n```json\n{"a":1}\n```\nfin'), { a: 1 });
assert.deepEqual(extraerJSON('{"b":[1,2]}'), { b: [1, 2] });
assert.equal(extraerJSON('sin json'), null);

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.log('Sin ANTHROPIC_API_KEY en bolsa-ny/.env: no genero el resumen de noticias.');
  process.exit(3);
}

const ahora = new Date(), d2 = n => String(n).padStart(2, '0');
const fecha = `${ahora.getFullYear()}-${d2(ahora.getMonth() + 1)}-${d2(ahora.getDate())}`, hora = `${d2(ahora.getHours())}:${d2(ahora.getMinutes())}`;
const id = `${fecha}-${hora.replace(':', '')}`;
const momento = ['apertura', 'cierre'].includes(process.argv[2]) ? process.argv[2] : ahora.getHours() < 12 ? 'apertura' : 'cierre';
const carpeta = new URL('./datos/', import.meta.url);
const yaHay = readdirSync(carpeta).filter(f => f.startsWith(fecha) && f.endsWith('.json'))
  .some(f => { try { return JSON.parse(readFileSync(new URL(f, carpeta), 'utf8')).momento === momento; } catch { return false; } });
if (yaHay) { console.log(`Ya hay un resumen de ${momento} de hoy (quizás de la tarea de Claude): no genero otro.`); process.exit(0); }

const PROMPT = `Armá un resumen de noticias del mercado de acciones de Estados Unidos para un usuario hispanohablante, en español rioplatense claro.
Es el resumen de ${momento === 'apertura' ? 'antes de la apertura' : 'después del cierre'} del ${fecha}.

Buscá en la web las noticias de las últimas ~12 horas: cómo cerraron o están por abrir S&P 500, Dow Jones y Nasdaq; la Fed y las tasas; inflación PCE e IPC, empleo y PIB; resultados de empresas grandes; movimientos fuertes de acciones; petróleo, dólar y bono del Tesoro a 10 años; geopolítica que mueva el mercado; restricciones que afecten a empresas o sectores (aranceles, controles de exportación de chips, impuestos, sanciones, regulación y antimonopolio). Priorizá Reuters, AP, CNBC, Bloomberg, WSJ, MarketWatch y Yahoo Finance.

Reglas:
- No inventes cifras. Si no encontrás un dato, poné "sin dato" en valor/cambio y null en cambioPct.
- Si dos fuentes cuentan la misma noticia, juntalas en una sola noticia con las dos fuentes. Si dicen cosas distintas sobre el mismo hecho, anotalo en "contradicciones".
- Diferenciá hechos, interpretaciones e hipótesis con el campo "tipo". "impacto" solo con lo que dicen las fuentes o lo que ya se vio en los precios.
- Nada de recomendaciones de compra o venta, porcentajes de seguridad, precios objetivo propios ni probabilidades.

Al final respondé SOLO con un bloque \`\`\`json con este objeto (sin comentarios):
{
  "tonoGeneral": "positivo | negativo | mixto | neutral",
  "enSegundos": ["3 a 5 frases con lo más importante"],
  "indices": [{ "nombre": "S&P 500", "valor": "7.237,17", "cambio": "+4,73%", "cambioPct": 4.73 }],
  "noticias": [{ "titulo": "", "resumen": "2-3 frases", "afecta": ["Sector o empresa"], "tono": "positivo",
    "hora": "HH:MM de Nueva York si la fuente la dice (si no, omitir)", "importancia": "alta | media | baja", "urgencia": "alta | normal",
    "tipo": "hecho | interpretacion | hipotesis", "categoria": "Fed y tasas | Inflación | Empleo | PIB | Resultados | Empresa | Sector | Geopolítica | Regulación y restricciones | Materias primas | Otro",
    "volatilidad": true, "impacto": "una frase", "fuentes": [{ "nombre": "Reuters", "url": "https://..." }] }],
  "contradicciones": [],
  "sectores": [{ "sector": "Energía", "tono": "negativo", "porque": "una frase" }],
  "riesgoHoy": "una o dos frases",
  "proximos": ["eventos programados próximos"]
}
- "indices": siempre estos 6 y en este orden: "S&P 500", "Dow Jones", "Nasdaq", "Bono 10 años", "Petróleo WTI", "Dólar (DXY)".
- "noticias": máximo 8, ordenadas por importancia, con las URL reales que leíste.
- "sectores": solo estos nombres exactos: Tecnología, Semiconductores, Software, Hardware, Financiero, Energía, Energía limpia, Salud, Consumo, Industria, Inmobiliario, Servicios públicos, Materiales, Comunicaciones, Defensa, Transporte.`;

const client = new Anthropic();
const messages = [{ role: 'user', content: PROMPT }];
let final = null;
try {
  for (let vuelta = 0; vuelta < 6; vuelta++) { // la búsqueda web puede pausar el turno: se reenvía para que siga
    const stream = client.beta.messages.stream({
      model: 'claude-opus-5-5', max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', // si el modelo declina, el servidor reintenta con otro
      output_config: { effort: 'medium' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 12 }],
      messages,
    });
    const m = await stream.finalMessage();
    if (m.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: m.content }); continue; }
    final = m; break;
  }
} catch (e) {
  if (e instanceof Anthropic.AuthenticationError) console.error('La clave de .env no es válida.');
  else if (e instanceof Anthropic.RateLimitError) console.error('Límite de uso de la API alcanzado: probá más tarde.');
  else if (e instanceof Anthropic.APIError) console.error(`Error de la API (${e.status}): ${e.message}`);
  else console.error('No se pudo conectar con la API: ' + e.message);
  process.exit(1);
}
if (!final) { console.error('La búsqueda no terminó después de 6 vueltas.'); process.exit(1); }
if (final.stop_reason === 'refusal') { console.error('El modelo declinó el pedido' + (final.stop_details?.category ? ` (${final.stop_details.category})` : '') + '.'); process.exit(1); }
if (final.stop_reason === 'max_tokens') { console.error('La respuesta se cortó por largo.'); process.exit(1); }

const r = extraerJSON(final.content.filter(b => b.type === 'text').map(b => b.text).join('\n'));
if (!r) { console.error('La respuesta no trae un JSON válido.'); process.exit(1); }
Object.assign(r, { id, fecha, hora, momento }); // identidad y hora las fija el script, no el modelo
const p = problemas(r, id + '.json');
if (p.length) { console.error('El resumen no pasó la validación: ' + p.join('; ')); process.exit(1); }
writeFileSync(new URL(`${id}.json`, carpeta), JSON.stringify(r, null, 2) + '\n');
console.log(`Resumen guardado: datos/${id}.json (${r.noticias.length} noticias, modelo ${final.model}).`);
