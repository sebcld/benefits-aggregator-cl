const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryCacheStore } = require('../../../src/shared/cache/memory-cache-store');
const { assertCacheStore } = require('../../../src/shared/cache/cache-store');
const { createLogger } = require('../../../src/shared/logger');
const { sleep } = require('../../../src/shared/async');

test('MemoryCacheStore respeta el TTL', async () => {
  let now = 0;
  const cache = createMemoryCacheStore({ now: () => now });
  await cache.set('a', [1], 1000);
  assert.deepEqual(await cache.get('a'), [1]);
  now = 999;
  assert.deepEqual(await cache.get('a'), [1]);
  now = 1000;
  assert.equal(await cache.get('a'), undefined);
});

test('MemoryCacheStore descarta la entrada mas antigua al superar maxEntries', async () => {
  const cache = createMemoryCacheStore({ maxEntries: 2 });
  await cache.set('a', 1, 1000);
  await cache.set('b', 2, 1000);
  await cache.set('c', 3, 1000);
  assert.equal(await cache.get('a'), undefined);
  assert.equal(cache.size(), 2);
});

test('MemoryCacheStore ignora TTL 0 y permite borrar', async () => {
  const cache = createMemoryCacheStore();
  await cache.set('a', 1, 0);
  assert.equal(await cache.get('a'), undefined);
  await cache.set('b', 2, 1000);
  await cache.delete('b');
  assert.equal(await cache.get('b'), undefined);
});

test('assertCacheStore exige el contrato completo', () => {
  assert.throws(() => assertCacheStore({ get() {}, set() {} }), /delete, clear/);
});

test('logger: JSON por linea, filtra por nivel y agrega campos del child', () => {
  const lines = [];
  const stream = { write: (line) => lines.push(JSON.parse(line)) };
  const clock = () => new Date('2026-11-12T15:00:00Z');
  const logger = createLogger({ level: 'warn', stream, clock }).child({ provider: 'bci' });

  logger.info('no se ve');
  logger.warn('provider_empty', { count: 0, error: new Error('x') });
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], {
    time: '2026-11-12T15:00:00.000Z',
    level: 'warn',
    msg: 'provider_empty',
    provider: 'bci',
    count: 0,
    error: { name: 'Error', message: 'x' },
  });
});

test('logger: nivel invalido lanza error', () => {
  assert.throws(() => createLogger({ level: 'todo' }), /Nivel de log invalido/);
});

test('sleep se cancela con AbortSignal', async () => {
  const controller = new AbortController();
  const pending = sleep(10000, controller.signal);
  controller.abort(new Error('cancelado'));
  await assert.rejects(pending, /cancelado/);
});
