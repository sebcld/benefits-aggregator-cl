// Tests de cada provider con fixtures reales, en proceso (sin globales ni red).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const golden = require('../../fixtures/golden/providers.json');
const { createProviderRegistry } = require('../../../src/providers');
const { toLegacyEntry } = require('../../../src/domain/entry');
const { createTestContext } = require('../../helpers/provider-context');
const { assertSameJson } = require('../../helpers/assertions');

const registry = createProviderRegistry();
const legacy = (entries) => entries.map(toLegacyEntry);

const CASES = [
  ['santander', 'santander', {}],
  ['bci', 'bci', {}],
  ['tenpo', 'tenpo', {}],
  ['tapp', 'tapp', {}],
  ['copec', 'copec', {}],
  ['copec', 'copecIncludeInactive', { options: { includeInactive: true } }],
  ['bancochile', 'bancochile', {}],
];

for (const [key, goldenName, extra] of CASES) {
  test(`provider ${goldenName}: misma salida que el golden`, async () => {
    const entries = await registry.get(key).fetch(createTestContext(extra));
    assertSameJson(legacy(entries), golden[goldenName]);
  });

  test(`provider ${goldenName}: cada Entry tiene id`, async () => {
    const entries = await registry.get(key).fetch(createTestContext(extra));
    for (const entry of entries) assert.match(entry.id, /^[a-z0-9-]+-[0-9a-f]{12}$/);
  });
}

test('los ids son estables entre ejecuciones', async () => {
  const run = async () => (await registry.get('copec').fetch(createTestContext())).map((e) => e.id);
  assert.deepEqual(await run(), await run());
});

test('Copec Pay expone logo del comercio', async () => {
  const entries = await registry.get('copec').fetch(createTestContext());
  const rosa = entries.find((e) => e.title === 'El Café Rosa');
  assert.ok(rosa.logo.startsWith('https://copecpay.cl/wp-content/uploads/'));
});

test('BCI sin llave falla con codigo MISSING_CREDENTIALS', async () => {
  const ctx = createTestContext({ env: { BCI_SUBSCRIPTION_KEY: '' } });
  await assert.rejects(registry.get('bci').fetch(ctx), (err) => {
    assert.equal(err.code, 'MISSING_CREDENTIALS');
    assert.match(err.message, /BCI_SUBSCRIPTION_KEY/);
    return true;
  });
});

test('BCI envia la llave en el header y pausa entre paginas', async () => {
  const ctx = createTestContext();
  await registry.get('bci').fetch(ctx);
  assert.equal(ctx.fetchImpl.calls[0].headers['ocp-apim-subscription-key'], 'test-key');
  assert.deepEqual(ctx.pauses, [150, 150, 150, 150]);
});

test('Copec Pay rechaza respuestas HTML (redireccion a la home)', async () => {
  const fetchImpl = async () =>
    new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
  await assert.rejects(registry.get('copec').fetch(createTestContext({ fetchImpl })), (err) => {
    assert.equal(err.code, 'INVALID_RESPONSE');
    assert.match(err.message, /^Copec Pay no devolvio JSON \(text\/html\)/);
    return true;
  });
});

// Mercado Pago: ver tests/unit/providers/mercadopago.test.js.

test('Tenpo deja de paginar al encontrar una pagina vacia', async () => {
  const ctx = createTestContext();
  await registry.get('tenpo').fetch(ctx);
  assert.equal(ctx.fetchImpl.calls.length, 5);
});
