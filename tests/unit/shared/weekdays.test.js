// formatWeekdays: dias de la semana de una fuente -> texto para la pildora.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatWeekdays } = require('../../../src/shared/weekdays');

test('un dia: "Todos los ..." en plural', () => {
  assert.equal(formatWeekdays(['LUNES']), 'Todos los lunes');
  assert.equal(formatWeekdays(['SABADO']), 'Todos los sábados');
  assert.equal(formatWeekdays(['domingo']), 'Todos los domingos');
});

test('varios dias: ordenados de lunes a domingo, con tildes y sin repetidos', () => {
  assert.equal(formatWeekdays(['JUEVES', 'MARTES', 'MIERCOLES']), 'Martes, miércoles y jueves');
  assert.equal(formatWeekdays(['viernes', 'sábado', 'viernes']), 'Viernes y sábado');
  assert.equal(formatWeekdays(['miercoles', 'lunes']), 'Lunes y miércoles');
});

test('los 7 dias, ninguno o valores que no son dias', () => {
  assert.equal(formatWeekdays(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']), 'Todos los días');
  assert.equal(formatWeekdays([]), '');
  assert.equal(formatWeekdays(undefined), '');
  assert.equal(formatWeekdays(['FERIADOS', '']), '');
});
