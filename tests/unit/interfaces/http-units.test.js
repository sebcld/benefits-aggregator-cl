const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRouter } = require('../../../src/interfaces/http/router');
const { parseJsonObject } = require('../../../src/interfaces/http/middlewares/body-parser');
const { toErrorResponse } = require('../../../src/interfaces/http/middlewares/error-handler');
const { toV1Benefit, paginate } = require('../../../src/interfaces/http/serializers');
const { parseBanks } = require('../../../src/interfaces/http/validation');
const { createEntry } = require('../../../src/domain/entry');
const { ValidationError } = require('../../../src/domain/errors');

const noop = async () => ({ status: 200, body: {} });
const router = createRouter([
  { method: 'GET', path: '/search', api: 'legacy', handler: noop },
  { method: 'GET', path: '/v1/search', api: 'v1', handler: noop },
  { method: 'POST', path: '/v1/search', api: 'v1', handler: noop },
]);

test('router: coincidencia exacta, sin prefijos ni barra final', () => {
  assert.ok(router.match('GET', '/search').route);
  assert.equal(router.match('GET', '/searchXYZ').error.status, 404);
  assert.equal(router.match('GET', '/search/').error.status, 404);
});

test('router: metodo no soportado es 404 en legado y 405 en v1', () => {
  assert.equal(router.match('POST', '/search').error.status, 404);
  const v1 = router.match('DELETE', '/v1/search');
  assert.equal(v1.error.status, 405);
  assert.equal(v1.error.headers.allow, 'GET, POST');
  assert.equal(router.match('GET', '/v1/otra').api, 'v1');
});

test('router: rechaza rutas duplicadas', () => {
  const r = { method: 'GET', path: '/x', api: 'v1', handler: noop };
  assert.throws(() => createRouter([r, r]), /duplicada/);
});

test('body parser: vacio, invalido y no-objeto', () => {
  assert.deepEqual(parseJsonObject(''), {});
  assert.deepEqual(parseJsonObject('{"a":1}'), { a: 1 });
  assert.throws(() => parseJsonObject('{'), (e) => e.code === 'INVALID_JSON');
  assert.throws(() => parseJsonObject('null'), (e) => e.code === 'INVALID_BODY');
  assert.throws(() => parseJsonObject('"texto"'), (e) => e.code === 'INVALID_BODY');
  assert.deepEqual(parseJsonObject('[1]', { lenient: true }), {});
  assert.throws(() => parseJsonObject('{', { lenient: true }), (e) => e.code === 'INVALID_JSON');
});

test('error handler: formato legado y v1', () => {
  const err = new ValidationError('Falta el parametro q', { code: 'MISSING_QUERY' });
  assert.deepEqual(toErrorResponse(err, 'legacy'), {
    status: 400,
    headers: undefined,
    body: { error: 'Falta el parametro q' },
  });
  assert.deepEqual(toErrorResponse(err, 'v1').body, {
    error: { code: 'MISSING_QUERY', message: 'Falta el parametro q' },
  });
});

test('error handler: los 500 de v1 no exponen el mensaje interno', () => {
  const res = toErrorResponse(new Error('detalle interno'), 'v1');
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
  assert.equal(toErrorResponse(new Error('detalle interno'), 'legacy').body.error, 'detalle interno');
});

test('serializer v1: vacios a null y descripcion acotada', () => {
  const entry = createEntry({ bank: 'Tenpo', title: 'T', subtitle: '', description: 'x'.repeat(400) });
  const benefit = toV1Benefit(entry, () => 'tenpo');
  assert.equal(benefit.subtitle, null);
  assert.equal(benefit.logo, null);
  assert.equal(benefit.url, null);
  assert.equal(benefit.description.length, 300);
  assert.equal(benefit.bankKey, 'tenpo');
});

test('paginate', () => {
  const { items, pagination } = paginate([1, 2, 3, 4, 5], 2, 2);
  assert.deepEqual(items, [3, 4]);
  assert.deepEqual(pagination, { page: 2, pageSize: 2, total: 5, totalPages: 3, hasMore: true });
  assert.deepEqual(paginate([], 1, 20).pagination.totalPages, 1);
});

test('parseBanks igual que el original', () => {
  assert.deepEqual(parseBanks(' BCI , ,Copec Pay'), ['BCI', 'Copec Pay']);
  assert.deepEqual(parseBanks(['a', '', null]), ['a']);
  assert.deepEqual(parseBanks(42), []);
});
