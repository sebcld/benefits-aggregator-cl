// Casos de aceptacion por emisor (definidos por negocio): cada consulta debe encontrar el
// beneficio esperado en su emisor, por servicio, CLI y API v1. Usa fixtures (sin internet).
// La version en vivo contra los sitios reales es: npm run smoke
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ACCEPTANCE_CASES } = require('../helpers/constants');
const { createFixtureApp } = require('../helpers/fakes');
const { runCli } = require('../helpers/processes');
const { createHttpServer } = require('../../src/interfaces/http/server');
const { request } = require('../helpers/processes');

const app = createFixtureApp();

for (const [bank, query, expected] of ACCEPTANCE_CASES) {
  test(`${bank}: "${query}" encuentra ${expected}`, async () => {
    const { matches, errors } = await app.searchService.search(query, { banks: [bank] });
    assert.deepEqual(errors, []);
    assert.ok(
      matches.some((m) => m.bank === bank && expected.test(m.title)),
      `sin coincidencia; titulos: ${matches.map((m) => m.title).join(' | ')}`,
    );
  });

  test(`${bank}: "${query}" aparece en el CLI`, async () => {
    const { stdout, code } = await runCli([query]);
    assert.equal(code, 0);
    assert.match(stdout, new RegExp(`\\n${bank} \\(\\d+\\)\\n`));
  });
}

test('API v1: todos los casos de aceptacion', async () => {
  const server = createHttpServer({ app, version: 'test' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const [bank, query, expected] of ACCEPTANCE_CASES) {
      const path = `/v1/search?q=${encodeURIComponent(query)}&banks=${encodeURIComponent(bank)}`;
      const res = await request(server.address().port, { path });
      assert.equal(res.status, 200);
      assert.ok(res.body.results.some((r) => expected.test(r.title)), `${bank}: ${query}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
