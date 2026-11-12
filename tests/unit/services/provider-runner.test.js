const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createProviderRunner } = require('../../../src/services/provider-runner');
const { createSourceStatusTracker } = require('../../../src/services/source-status');
const { fakeProvider, recordingLogger } = require('../../helpers/fakes');

// CacheStore minimo en memoria para probar el runner sin TTL real.
function mapCache() {
  const store = new Map();
  const ttls = new Map();
  return {
    store,
    ttls,
    get: async (key) => store.get(key),
    set: async (key, value, ttlMs) => {
      store.set(key, value);
      ttls.set(key, ttlMs);
    },
    delete: async (key) => store.delete(key),
    clear: async () => store.clear(),
  };
}

const runnerWith = (options = {}) =>
  createProviderRunner({ createContext: (p, extra) => extra, logger: recordingLogger(), ...options });

test('con cache, la segunda consulta no llama a la fuente', async () => {
  const fake = fakeProvider({});
  const runner = runnerWith({ cache: mapCache(), cacheTtlMs: 60000 });

  const first = await runner.run(fake.provider, { query: 'a' });
  const second = await runner.run(fake.provider, { query: 'b' });
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(fake.calls(), 1);
});

test('los errores no se guardan en cache', async () => {
  const fake = fakeProvider({ fail: new Error('caido') });
  const cache = mapCache();
  const runner = runnerWith({ cache, cacheTtlMs: 60000 });

  await runner.run(fake.provider);
  await runner.run(fake.provider);
  assert.equal(fake.calls(), 2);
  assert.equal(cache.store.size, 0);
});

test('un catalogo con registros se guarda el TTL completo', async () => {
  const cache = mapCache();
  await runnerWith({ cache, cacheTtlMs: 7_200_000 }).run(fakeProvider({}).provider);
  assert.equal(cache.ttls.get('provider:fake'), 7_200_000);
});

test('un catalogo vacio se guarda solo 1 minuto: el emisor se recupera apenas vuelve la fuente', async () => {
  const cache = mapCache();
  const runner = runnerWith({ cache, cacheTtlMs: 7_200_000 });
  const report = await runner.run(fakeProvider({ titles: [] }).provider);
  assert.equal(report.status, 'empty');
  assert.equal(cache.ttls.get('provider:fake'), 60_000);
});

test('el TTL corto de un catalogo vacio nunca supera el TTL configurado', async () => {
  const cache = mapCache();
  await runnerWith({ cache, cacheTtlMs: 30_000 }).run(fakeProvider({ titles: [] }).provider);
  assert.equal(cache.ttls.get('provider:fake'), 30_000);
});

test('en un provider por consulta, 0 resultados se guarda el TTL completo (es una respuesta normal)', async () => {
  const cache = mapCache();
  await runnerWith({ cache, cacheTtlMs: 7_200_000 }).run(fakeProvider({ queryDependent: true, titles: [] }).provider, { query: 'x' });
  assert.equal(cache.ttls.get('provider:fake:q:x'), 7_200_000);
});

test('los providers por consulta se cachean por consulta normalizada', async () => {
  const fake = fakeProvider({ queryDependent: true });
  const cache = mapCache();
  const runner = runnerWith({ cache, cacheTtlMs: 60000 });

  await runner.run(fake.provider, { query: 'El Café' });
  await runner.run(fake.provider, { query: 'el cafe' });
  await runner.run(fake.provider, { query: 'otro' });
  assert.equal(fake.calls(), 2);
  assert.deepEqual([...cache.store.keys()], ['provider:fake:q:el cafe', 'provider:fake:q:otro']);
});

test('peticiones simultaneas al mismo emisor comparten una sola descarga', async () => {
  const fake = fakeProvider({ delayMs: 20 });
  const runner = runnerWith();
  await Promise.all([runner.run(fake.provider), runner.run(fake.provider), runner.run(fake.provider)]);
  assert.equal(fake.calls(), 1);
});

test('las opciones propias (includeInactive) saltan cache y deduplicacion', async () => {
  const fake = fakeProvider({});
  const runner = runnerWith({ cache: mapCache(), cacheTtlMs: 60000 });
  await runner.fetchEntries(fake.provider, { options: { includeInactive: true } });
  await runner.fetchEntries(fake.provider, { options: { includeInactive: true } });
  assert.equal(fake.calls(), 2);
});

test('el tracker guarda el ultimo estado sin las entradas', async () => {
  const tracker = createSourceStatusTracker({ clock: () => new Date('2026-11-12T15:00:00Z') });
  const fake = fakeProvider({});
  await runnerWith({ statusTracker: tracker }).run(fake.provider);

  const [status] = tracker.snapshot([fake.provider]);
  assert.equal(status.status, 'ok');
  assert.equal(status.count, 1);
  assert.equal(status.checkedAt, '2026-11-12T15:00:00.000Z');
  assert.equal('entries' in status, false);

  const [unknown] = tracker.snapshot([fakeProvider({ key: 'otro', name: 'Otro' }).provider]);
  assert.equal(unknown.status, 'unknown');
});
