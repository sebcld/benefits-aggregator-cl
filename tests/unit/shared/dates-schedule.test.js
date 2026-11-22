// nextDailyAt: proxima hora fija del dia en Chile (actualizacion programada, ADR 0024).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextDailyAt, parseClockTime } = require('../../../src/shared/dates');

const at = (now, time = '09:00') => new Date(nextDailyAt(Date.parse(now), time)).toISOString();

test('verano (UTC-3): antes, justo a la hora y despues de las 09:00 de Chile', () => {
  assert.equal(at('2026-11-13T09:00:00Z'), '2026-11-13T12:00:00.000Z'); // 06:00 Chile -> hoy
  assert.equal(at('2026-11-13T12:00:00Z'), '2026-11-14T12:00:00.000Z'); // 09:00 en punto -> manana
  assert.equal(at('2026-11-13T18:00:00Z'), '2026-11-14T12:00:00.000Z'); // 15:00 Chile -> manana
});

test('invierno (UTC-4): las 09:00 de Chile son las 13:00 UTC', () => {
  assert.equal(at('2026-07-10T12:00:00Z'), '2026-07-10T13:00:00.000Z');
});

test('cambios de horario de Chile (a las 00:00): la hora programada se mantiene', () => {
  // 6-9-2026 empieza el horario de verano; 5-4-2026 termina.
  assert.equal(at('2026-09-05T23:00:00Z'), '2026-09-06T12:00:00.000Z');
  assert.equal(at('2026-04-04T23:00:00Z'), '2026-04-05T13:00:00.000Z');
});

test('fin de mes y de ano, y otras horas', () => {
  assert.equal(at('2026-12-31T20:00:00Z'), '2027-01-01T12:00:00.000Z');
  assert.equal(at('2026-11-13T09:00:00Z', '23:30'), '2026-11-14T02:30:00.000Z');
  assert.equal(at('2026-11-13T09:00:00Z', '00:00'), '2026-11-14T03:00:00.000Z');
});

test('parseClockTime valida HH:MM; una hora invalida lanza', () => {
  assert.deepEqual(parseClockTime('09:05'), { hour: 9, minute: 5 });
  for (const bad of ['9:00', '24:00', '09:60', 'nueve', '']) assert.equal(parseClockTime(bad), null, bad);
  assert.throws(() => nextDailyAt(0, '25:00'), /Hora invalida/);
});
