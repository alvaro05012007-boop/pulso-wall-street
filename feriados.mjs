// Feriados de la bolsa de Nueva York (sin rueda). Los usan actualizar.mjs y videos.mjs; app.js tiene su propia copia para el navegador.
// shortcut: feriados de la bolsa de NY cargados hasta 2027 (igual que en app.js); sumar los de 2028 cuando se publiquen
export const FERIADOS = new Set(('2026-01-01 2026-01-19 2026-02-16 2026-04-03 2026-05-25 2026-06-19 2026-07-03 2026-09-07 2026-11-26 2026-12-25 ' +
  '2027-01-01 2027-01-18 2027-02-15 2027-03-26 2027-05-31 2027-06-18 2027-07-05 2027-09-06 2027-11-25 2027-12-24').split(' '));
export const huboRueda = fecha => { const d = new Date(fecha + 'T12:00:00Z').getUTCDay(); return d !== 0 && d !== 6 && !FERIADOS.has(fecha); };
