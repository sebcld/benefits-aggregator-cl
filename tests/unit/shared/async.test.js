// mapWithLimit: concurrencia acotada (las 92 fichas de Entel se piden de a 4).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mapWithLimit } = require('../../../src/shared/async');

test('nunca tiene mas de "limit" tareas en curso y mantiene el orden del resultado', async () => {
  let running = 0;
  let peak = 0;
  const result = await mapWithLimit([5, 1, 4, 2, 3, 0], 2, async (n) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, n * 3));
    running -= 1;
    return n * 10;
  });
  assert.equal(peak, 2);
  assert.deepEqual(result, [50, 10, 40, 20, 30, 0]);
});

test('lista vacia y limite mayor que la lista', async () => {
  assert.deepEqual(await mapWithLimit([], 4, async () => 1), []);
  assert.deepEqual(await mapWithLimit([1, 2], 10, async (n) => n + 1), [2, 3]);
});

test('si una tarea falla, rechaza con ese error', async () => {
  await assert.rejects(
    mapWithLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('fallo 2');
      return n;
    }),
    /fallo 2/,
  );
});
