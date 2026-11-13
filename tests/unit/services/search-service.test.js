const { test } = require('node:test');
const assert = require('node:assert/strict');
const golden = require('../../fixtures/golden/search.json');
const { SEARCH_CASES } = require('../../helpers/cases');
const { fakeProvider, recordingLogger, createFixtureApp } = require('../../helpers/fakes');
const { createApp } = require('../../../src/bootstrap');
const { toLegacyEntry } = require('../../../src/domain/entry');
const { ValidationError } = require('../../../src/domain/errors');
const { assertSameJson } = require('../../helpers/assertions');

const appWith = (providers, env = {}) =>
  createApp({ env: { LOG_LEVEL: 'silent', ...env }, envFilePath: null, providers, logger: recordingLogger() });

for (const [name, query, options] of SEARCH_CASES) {
  test(`searchService con fixtures equivale al original: ${name}`, async () => {
    const { searchService } = createFixtureApp();
    const { matches, errors } = await searchService.search(query, options);
    const legacy = {
      matches: matches.map(toLegacyEntry),
      errors: errors.map(({ bank, message }) => ({ bank, message })),
    };
    assertSameJson(legacy, golden[name]);
  });
}

test('consulta vacia lanza ValidationError MISSING_QUERY', async () => {
  const { searchService } = appWith([fakeProvider({}).provider]);
  await assert.rejects(searchService.search(''), (err) => {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.code, 'MISSING_QUERY');
    return true;
  });
});

test('un emisor que falla no detiene la busqueda y queda en errors y sources', async () => {
  const ok = fakeProvider({ key: 'a', name: 'A' });
  const broken = fakeProvider({ key: 'b', name: 'B', fail: new TypeError('fetch failed') });
  const { searchService } = appWith([ok.provider, broken.provider]);

  const result = await searchService.search('rappi');
  assert.equal(result.matches.length, 1);
  assert.deepEqual(result.errors, [
    { bank: 'B', key: 'b', code: 'NETWORK_ERROR', message: 'fetch failed' },
  ]);
  assert.deepEqual(
    result.sources.map((s) => [s.key, s.status, s.count]),
    [
      ['a', 'ok', 1],
      ['b', 'error', 0],
    ],
  );
});

test('timeout por emisor: el lento queda como TIMEOUT y el resto responde', async () => {
  const slow = fakeProvider({ key: 'slow', name: 'Slow', delayMs: 5000 });
  const fast = fakeProvider({ key: 'fast', name: 'Fast' });
  const { searchService } = appWith([slow.provider, fast.provider], { PROVIDER_TIMEOUT_MS: '30' });

  const started = Date.now();
  const result = await searchService.search('rappi');
  assert.ok(Date.now() - started < 2000);
  assert.equal(result.errors[0].code, 'TIMEOUT');
  assert.match(result.errors[0].message, /Slow excedio el tiempo limite \(30 ms\)/);
  assert.equal(result.matches.length, 1);
});

test('catalogo vacio se marca como empty y se alerta en el log', async () => {
  const empty = fakeProvider({ key: 'vacio', name: 'Vacio', titles: [] });
  const logger = recordingLogger();
  const app = createApp({ env: {}, envFilePath: null, providers: [empty.provider], logger });

  const result = await app.searchService.search('rappi');
  assert.equal(result.sources[0].status, 'empty');
  assert.ok(logger.lines.some((l) => l.level === 'warn' && l.msg === 'provider_empty'));
});

test('filtro por banks acepta keys solo con allowKeys', async () => {
  const a = fakeProvider({ key: 'copec', name: 'Copec Pay' });
  const { searchService } = appWith([a.provider]);
  assert.equal((await searchService.search('rappi', { banks: ['copec'] })).sources.length, 0);
  const withKeys = await searchService.search('rappi', { banks: ['copec'], allowKeys: true });
  assert.equal(withKeys.sources.length, 1);
});
