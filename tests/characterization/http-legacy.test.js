// Caracterizacion de la API sin version (/search, /health) contra el golden vigente.
// La comparacion con el codigo original (y los 3 cambios intencionales) esta en
// original-equivalence.test.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const golden = require('../fixtures/golden/http-legacy.json');
const { LEGACY_HTTP_CASES } = require('../helpers/cases');
const { startServer, request } = require('../helpers/processes');
const { assertSameJson } = require('../helpers/assertions');

let server;

before(async () => {
  server = await startServer();
});

after(async () => {
  await server?.stop();
});

for (const [name, req] of LEGACY_HTTP_CASES) {
  test(`API legada: ${name}`, async () => {
    const res = await request(server.port, req);
    const expected = golden[name];

    assert.equal(res.status, expected.status, 'status');
    assert.equal(res.headers['content-type'], expected.contentType, 'content-type');
    assertSameJson(res.body, expected.body, 'body');
  });
}
