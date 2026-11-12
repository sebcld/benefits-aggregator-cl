// Palabras compuestas en el matcher: "FlixBus" se busca tambien como "Flix Bus".
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matchesQuery } = require('../../../src/services/matcher');

const entry = (fields) => ({ bank: 'X', title: '', ...fields });
const FLIXBUS_TENPO = entry({ title: '15% de descuento en tu próximo viaje con FlixBus.' });

test('"flix" y "bus" encuentran una marca escrita junta con mayuscula interna', () => {
  assert.equal(matchesQuery(FLIXBUS_TENPO, 'flix'), true);
  assert.equal(matchesQuery(FLIXBUS_TENPO, 'bus'), true);
  assert.equal(matchesQuery(FLIXBUS_TENPO, 'Bus'), true);
});

test('la marca completa sigue funcionando junta o separada', () => {
  assert.equal(matchesQuery(FLIXBUS_TENPO, 'flixbus'), true);
  assert.equal(matchesQuery(FLIXBUS_TENPO, 'flix bus'), true);
});

test('funciona en cualquier campo de busqueda', () => {
  assert.equal(matchesQuery(entry({ subtitle: 'Pide en PedidosYa' }), 'ya'), true);
  assert.equal(matchesQuery(entry({ commerceName: 'DirecTV' }), 'tv'), true);
});

test('una palabra corta sigue sin coincidir dentro de otra palabra normal', () => {
  // La regla de palabra completa se mantiene: evita "bus" en "business" o "cine" en "Cinemark".
  assert.equal(matchesQuery(entry({ title: 'Business class' }), 'bus'), false);
  assert.equal(matchesQuery(entry({ title: 'Cinemark' }), 'cine'), false);
  assert.equal(matchesQuery(entry({ title: 'Bcicomercio' }), 'bci'), false);
});

test('una marca en mayusculas sin separacion no se puede partir', () => {
  // "FLIXBUS" no tiene mayuscula interna; la encuentra la consulta completa.
  assert.equal(matchesQuery(entry({ title: 'FLIXBUS' }), 'bus'), false);
  assert.equal(matchesQuery(entry({ title: 'FLIXBUS' }), 'flixbus'), true);
});
