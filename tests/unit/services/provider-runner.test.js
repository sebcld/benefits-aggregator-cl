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

test('la clave de cache es el emisor: todas las busquedas comparten su catalogo', async () => {
  const cache = mapCache();
  await runnerWith({ cache, cacheTtlMs: 60000 }).run(fakeProvider({}).provider);
  assert.deepEqual([...cache.store.keys()], ['provider:fake']);
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

// Reloj manual para probar la antiguedad de los catalogos.
function manualClock(start = Date.parse('2026-11-12T15:00:00Z')) {
  let ms = start;
  return { now: () => ms, advance: (deltaMs) => (ms += deltaMs) };
}

const MIN = 60_000;
const refreshRunner = (clock, extra = {}) =>
  runnerWith({ cache: mapCache(), cacheTtlMs: 120 * MIN, refreshMinAgeMs: 5 * MIN, now: clock.now, ...extra });

test('el reporte informa cuando se descargo el catalogo y desde cuando se puede actualizar', async () => {
  const clock = manualClock();
  const runner = refreshRunner(clock);
  const first = await runner.run(fakeProvider({}).provider);
  assert.equal(first.fetchedAt, '2026-11-12T15:00:00.000Z');
  assert.equal(first.refreshableAt, '2026-11-12T15:05:00.000Z');

  // Desde cache: la fecha sigue siendo la de la descarga, no la de la consulta.
  clock.advance(90 * MIN);
  const second = await runner.run(fakeProvider({}).provider);
  assert.equal(second.cached, true);
  assert.equal(second.fetchedAt, '2026-11-12T15:00:00.000Z');
});

test('sin cache no hay nada que actualizar: refreshableAt es null', async () => {
  const report = await runnerWith({ now: manualClock().now }).run(fakeProvider({}).provider);
  assert.equal(report.fetchedAt, '2026-11-12T15:00:00.000Z');
  assert.equal(report.refreshableAt, null);
});

test('refresh antes de la antiguedad minima usa la cache (no castiga a la fuente)', async () => {
  const clock = manualClock();
  const fake = fakeProvider({});
  const runner = refreshRunner(clock);
  await runner.run(fake.provider);
  clock.advance(4 * MIN);
  const report = await runner.run(fake.provider, { refresh: true });
  assert.equal(fake.calls(), 1);
  assert.equal(report.cached, true);
});

test('refresh con la antiguedad minima vuelve a descargar y reinicia el plazo', async () => {
  const clock = manualClock();
  const fake = fakeProvider({});
  const cache = mapCache();
  const runner = refreshRunner(clock, { cache });
  await runner.run(fake.provider);
  clock.advance(90 * MIN);

  const report = await runner.run(fake.provider, { refresh: true });
  assert.equal(fake.calls(), 2);
  assert.equal(report.cached, false);
  assert.equal(report.fetchedAt, '2026-11-12T16:30:00.000Z');
  assert.equal(cache.store.get('provider:fake').fetchedAt, clock.now());
  assert.equal(cache.ttls.get('provider:fake'), 120 * MIN);
});

test('si la actualizacion falla, se sigue usando el catalogo anterior', async () => {
  const clock = manualClock();
  const cache = mapCache();
  const logger = recordingLogger();
  const runner = refreshRunner(clock, { cache, logger });
  await runner.run(fakeProvider({ titles: ['Antes'] }).provider);
  clock.advance(90 * MIN);

  const report = await runner.run(fakeProvider({ fail: new Error('caido') }).provider, { refresh: true });
  assert.equal(report.status, 'ok');
  assert.equal(report.cached, true);
  assert.equal(report.fetchedAt, '2026-11-12T15:00:00.000Z');
  assert.deepEqual(
    report.entries.map((e) => e.title),
    ['Antes'],
  );
  assert.ok(logger.lines.some((l) => l.msg === 'provider_refresh_failed'));
});

test('sin catalogo anterior, una actualizacion que falla es un error normal', async () => {
  const report = await refreshRunner(manualClock()).run(fakeProvider({ fail: new Error('caido') }).provider, {
    refresh: true,
  });
  assert.equal(report.status, 'error');
  assert.equal(report.fetchedAt, null);
  assert.equal(report.refreshableAt, null);
});

test('varios refresh simultaneos comparten una sola descarga', async () => {
  const clock = manualClock();
  const fake = fakeProvider({ delayMs: 20 });
  const runner = refreshRunner(clock);
  await runner.run(fake.provider);
  clock.advance(10 * MIN);
  await Promise.all([1, 2, 3].map(() => runner.run(fake.provider, { refresh: true })));
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
