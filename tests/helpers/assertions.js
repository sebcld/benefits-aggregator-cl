const assert = require('node:assert/strict');

// Igualdad profunda y, ademas, mismo orden de claves (la salida JSON debe ser identica).
function assertSameJson(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), `${message || ''} (orden de claves)`);
}

module.exports = { assertSameJson };
