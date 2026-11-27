// Pruebas de las fórmulas: node --test bolsa-ny/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as q from './cuant.mjs';

const cerca = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

test('caída máxima y volatilidad', () => {
  assert.equal(q.caidaMaxima([100, 120, 60, 130]), 50);
  assert.equal(q.volatilidad([100, 100, 100, 100]), 0);
  // rendimientos log alternando +x/-x: desvío conocido
  const c = [100, 110, 100, 110, 100];
  const r = Math.log(1.1), m = 0, d = Math.sqrt((4 * r * r) / 3);
  cerca(q.volatilidad(c), d * Math.sqrt(252) * 100, 1e-9);
});

test('medias móviles', () => {
  assert.deepEqual(q.sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
  const e = q.ema([1, 2, 3, 4], 2); // k = 2/3, arranca en 1.5
  cerca(e[1], 1.5); cerca(e[2], 3 * 2 / 3 + 1.5 / 3); cerca(e[3], 4 * 2 / 3 + e[2] / 3);
});

test('RSI', () => {
  assert.equal(q.rsi(Array.from({ length: 20 }, (_, i) => i + 1)), 100);
  assert.equal(q.rsi(Array(20).fill(5)), 50);
  cerca(q.rsi([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1], 14), 50, 1e-9); // 7 subas y 7 bajas iguales
});

test('MACD de serie constante es cero', () => {
  const m = q.macd(Array(60).fill(10));
  cerca(m.linea, 0); cerca(m.senal, 0); cerca(m.hist, 0);
});

test('ATR con rango fijo', () => {
  const n = 30, c = Array(n).fill(10), h = Array(n).fill(11), l = Array(n).fill(9);
  cerca(q.atr(h, l, c), 2);
});

test('Bollinger', () => {
  const b = q.bollinger(Array(20).fill(7));
  assert.equal(b.sup, 7); assert.equal(b.inf, 7); assert.equal(b.pctB, .5);
  const v = Array.from({ length: 20 }, (_, i) => i);
  const bb = q.bollinger(v); cerca(bb.media, 9.5); assert.ok(bb.pctB > .5);
});

test('beta y correlación', () => {
  const m = [.01, -.02, .015, .005, -.01];
  cerca(q.beta(m, m), 1); cerca(q.correlacion(m, m), 1);
  cerca(q.beta(m.map(x => 2 * x), m), 2);
  cerca(q.correlacion(m.map(x => -x), m), -1);
});

test('alinear por fecha', () => {
  assert.deepEqual(q.alinear(['a', 'b', 'c'], [1, 2, 3], ['b', 'c', 'd'], [20, 30, 40]), [[2, 3], [20, 30]]);
});

test('historia: meses, años, caídas y días extremos', () => {
  const f = ['2024-11-29', '2024-12-31', '2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30'];
  const c = [100, 110, 99, 88, 105, 115];
  const h = q.historia(f, c, true);
  assert.deepEqual(h.mensual.map(m => m.mes), ['2024-12', '2025-01', '2025-02', '2025-03', '2025-04']);
  assert.equal(h.mensual[0].ret, 10);             // 100 -> 110
  assert.deepEqual(h.anual[0], { anio: '2024', ret: 10, parcial: true });
  assert.equal(h.anual[1].ret, 4.5);              // 110 -> 115 en 2025 (parcial: último año)
  assert.equal(h.caidas.length, 1);               // de 110 a 88 = -20%, recuperada al superar 110
  assert.deepEqual(h.caidas[0], { desde: '2024-12-31', piso: '2025-02-28', caida: -20, recuperado: '2025-04-30' });
  assert.equal(h.mejores[0].fecha, '2025-03-31'); // +19,32%
  assert.equal(h.peores[0].fecha, '2025-02-28');  // 99 -> 88 = -11,11% (peor que enero, -10%)
});

test('nombre corto', () => {
  assert.equal(q.nombreCorto('JPMorgan Chase & Co.'), 'JPMorgan Chase');
  assert.equal(q.nombreCorto('Merck & Co., Inc.'), 'Merck');
  assert.equal(q.nombreCorto('Amazon.com, Inc.'), 'Amazon');
  assert.equal(q.nombreCorto('The Walt Disney Company'), 'Walt Disney');
});

test('escenarios históricos', () => {
  // precio que sube 1% por rueda: toda ventana de 10 ruedas rinde 1,01^10 - 1 = 10,46%
  const c = Array.from({ length: 200 }, (_, i) => 100 * 1.01 ** i);
  const e = q.escenarios(c, 10);
  cerca(e.p10, 10.46, 0.01); cerca(e.p90, 10.46, 0.01);
  assert.equal(e.ventanas, 190); assert.equal(e.independientes, 19);
  // ventanas de 1 rueda que alternan +10% y -10%: la mitad de cada una
  const z = Array.from({ length: 101 }, (_, i) => i % 2 ? 110 : 100);
  const e1 = q.escenarios(z, 1);
  cerca(e1.p90, 10, 1e-9); cerca(e1.p10, -100 / 11, 0.01);
  assert.equal(q.escenarios([1, 2, 3], 1), null); // muy poca historia
});
