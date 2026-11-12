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
  test(`provider ${goldenName}: misma salida que el original`, async () => {
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

test('Mercado Pago sin consulta no hace peticiones', async () => {
  const ctx = createTestContext();
  assert.deepEqual(await registry.get('mercadopago').fetch(ctx), []);
  assert.equal(ctx.fetchImpl.calls.length, 0);
});

test('Mercado Pago 403 se informa con el mensaje historico', async () => {
  const ctx = createTestContext({ query: 'Rappi' });
  await assert.rejects(registry.get('mercadopago').fetch(ctx), (err) => {
    assert.match(err.message, /^Mercado Pago respondio 403: \{"message":"forbidden"/);
    assert.equal(err.status, 403);
    return true;
  });
});

test('Mercado Pago envia token si esta configurado', async () => {
  const ctx = createTestContext({ query: 'kfc', env: { MELI_ACCESS_TOKEN: 'tok' } });
  await registry.get('mercadopago').fetch(ctx).catch(() => {});
  assert.equal(ctx.fetchImpl.calls[0].headers.Authorization, 'Bearer tok');
});

test('Tenpo deja de paginar al encontrar una pagina vacia', async () => {
  const ctx = createTestContext();
  await registry.get('tenpo').fetch(ctx);
  assert.equal(ctx.fetchImpl.calls.length, 5);
});
