// Validación de un resumen de noticias (lo escribe una IA a partir de la web: se revisa antes de publicarlo).
import assert from 'node:assert';

const TONOS = ['positivo', 'negativo', 'mixto', 'neutral'];
export function problemas(r, archivo) { // devuelve la lista de problemas; vacía = válido
  const p = [], esTexto = v => typeof v === 'string' && v.trim().length > 0;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return ['no es un objeto JSON'];
  if (!/^\d{4}-\d{2}-\d{2}-\d{4}$/.test(r.id || '')) p.push('id con formato inválido (AAAA-MM-DD-HHMM)');
  else if (archivo && archivo !== r.id + '.json') p.push(`el id (${r.id}) no coincide con el nombre del archivo`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha || '') || Number.isNaN(Date.parse(r.fecha))) p.push('fecha inválida');
  else if (r.id && !r.id.startsWith(r.fecha)) p.push('la fecha no coincide con el id');
  if (!['apertura', 'cierre'].includes(r.momento)) p.push('momento debe ser "apertura" o "cierre"');
  if (!TONOS.includes(r.tonoGeneral)) p.push('tonoGeneral inválido');
  if (!Array.isArray(r.enSegundos) || !r.enSegundos.every(esTexto)) p.push('enSegundos debe ser una lista de textos');
  if (!Array.isArray(r.indices)) p.push('indices debe ser una lista');
  else r.indices.forEach((x, i) => { if (!esTexto(x?.nombre)) p.push(`índice ${i + 1} sin nombre`); if (x?.cambioPct != null && !Number.isFinite(x.cambioPct)) p.push(`índice ${i + 1}: cambioPct no es un número`); });
  if (!Array.isArray(r.noticias)) p.push('noticias debe ser una lista');
  else r.noticias.forEach((n, i) => {
    if (!esTexto(n?.titulo)) p.push(`noticia ${i + 1} sin título`);
    if (n?.tono != null && !TONOS.includes(n.tono)) p.push(`noticia ${i + 1}: tono inválido`);
    for (const f of n?.fuentes || []) if (!/^https?:\/\//i.test(f?.url || '')) p.push(`noticia ${i + 1}: enlace no es http(s)`);
  });
  if (r.sectores != null && !Array.isArray(r.sectores)) p.push('sectores debe ser una lista');
  return p;
}
assert.deepEqual(problemas({ id: '2026-11-24-1807', fecha: '2026-11-24', momento: 'cierre', tonoGeneral: 'mixto', enSegundos: ['a'], indices: [], noticias: [] }, '2026-11-24-1807.json'), []);
assert.ok(problemas({ id: 'x', fecha: 'y', momento: 'z', tonoGeneral: 'w', enSegundos: [1], indices: {}, noticias: [{ titulo: 't', fuentes: [{ url: 'javascript:alert(1)' }] }] }).length >= 6);
