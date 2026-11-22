// API v1 contra fixtures reales, con el servidor levantado en este mismo proceso.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHttpServer } = require('../../src/interfaces/http/server');
const { createReplayFetch } = require('../helpers/replay-fetch');
const { createFixtureApp } = require('../helpers/fakes');
const { request } = require('../helpers/processes');

async function startInProcess(env = {}, options = {}) {
  const fetchImpl = createReplayFetch();
  const app = createFixtureApp({ env, fetchImpl, ...options });
  const server = createHttpServer({ app, version: '9.9.9' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const call = (req) => request(port, typeof req === 'string' ? { path: req } : req);
  const close = () => new Promise((resolve) => server.close(resolve));
  return { call, close, fetchImpl, app };
}

const post = (path, body, headers = {}) => ({
  method: 'POST',
  path,
  body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...headers },
});

describe('API v1', () => {
  let api;
  before(async () => {
    api = await startInProcess();
  });
  after(() => api.close());

  test('GET /v1/banks lista los emisores con su key', async () => {
    const res = await api.call('/v1/banks');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.banks[4], { key: 'copec', name: 'Copec Pay', searchMode: 'catalog' });
    // Mercado Pago es un catalogo (landing de la tarjeta prepago), ya no una busqueda por consulta.
    assert.deepEqual(res.body.banks[6], { key: 'mercadopago', name: 'Mercado Pago', searchMode: 'catalog' });
  });

  test('GET /v1/search devuelve beneficios livianos, paginacion y fuentes', async () => {
    const res = await api.call('/v1/search?q=Rappi');
    assert.equal(res.status, 200);
    assert.ok(res.headers['x-request-id']);

    const { results, pagination, sources, errors, meta } = res.body;
    assert.equal(pagination.total, 5);
    assert.deepEqual(Object.keys(results[0]), [
      'id',
      'bank',
      'bankKey',
      'title',
      'subtitle',
      'description',
      'commerceName',
      'category',
      'validFrom',
      'validUntil',
      'url',
      'logo',
      'cardType',
      'discountCap',
      'termsUrl',
      'discount',
      'schedule',
    ]);
    const rappi = results.find((r) => r.title === 'Rappi');
    assert.equal(rappi.bankKey, 'copec');
    assert.equal(rappi.validUntil, '2026-11-30');
    assert.match(rappi.logo, /^https:\/\//);
    assert.equal(rappi.cardType, null);
    const rappiPro = results.find((r) => r.title === 'RappiPro');
    assert.equal(rappiPro.bankKey, 'mercadopago');
    assert.equal(rappiPro.cardType, 'Tarjeta prepago virtual');
    assert.match(rappiPro.termsUrl, /^https:\/\/api\.mercadopago\.com\/v2\/discounts\/campaign\/\d+\/terms\/html$/);
    assert.equal(sources.length, 8);
    assert.deepEqual(errors, []);
    assert.equal(meta.partial, false);
    for (const r of results) {
      assert.ok(r.description === null || r.description.length <= 300);
      assert.notEqual(r.subtitle, '');
    }
  });

  test('paginacion con page y pageSize', async () => {
    const all = (await api.call('/v1/search?q=kfc&pageSize=100')).body.results;
    const page2 = (await api.call('/v1/search?q=kfc&page=2&pageSize=2')).body;
    assert.deepEqual(
      page2.results.map((r) => r.id),
      all.slice(2, 4).map((r) => r.id),
    );
    assert.equal(page2.pagination.hasMore, all.length > 4);
    assert.equal(page2.pagination.totalPages, Math.ceil(all.length / 2));
  });

  test('POST /v1/search acepta banks por key o nombre', async () => {
    const res = await api.call(post('/v1/search', { query: 'El Café Rosa', banks: ['copec'] }));
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.results.map((r) => r.title),
      ['El Café Rosa'],
    );
    assert.equal(res.body.sources.length, 1);
    assert.equal(res.body.meta.partial, false);
  });

  test('la segunda busqueda sale de cache sin volver a descargar', async () => {
    await api.call('/v1/search?q=burger%20king&banks=santander');
    const before = api.fetchImpl.calls.length;
    const res = await api.call('/v1/search?q=otra%20cosa&banks=santander');
    assert.equal(api.fetchImpl.calls.length, before);
    assert.equal(res.body.sources[0].cached, true);
  });

  test('GET /v1/benefits lista todos los beneficios sin consulta, paginados', async () => {
    const res = await api.call('/v1/benefits?pageSize=12');
    assert.equal(res.status, 200);
    assert.equal('query' in res.body, false);
    const { results, pagination, sources, meta } = res.body;
    // El total es la suma de los catalogos de todos los emisores.
    const catalogTotal = sources.reduce((sum, s) => sum + (s.count || 0), 0);
    assert.equal(pagination.total, catalogTotal);
    assert.ok(pagination.total > 1500, `total: ${pagination.total}`);
    assert.equal(results.length, 12);
    assert.equal(sources.length, 8);
    assert.equal(typeof meta.refreshableAt, 'string');
  });

  test('GET /v1/benefits intercala emisores: la primera pagina no es de uno solo', async () => {
    const { results } = (await api.call('/v1/benefits?pageSize=8')).body;
    assert.equal(new Set(results.map((r) => r.bankKey)).size, 8);
  });

  test('GET /v1/benefits con banks: solo ese emisor, en el orden de su fuente', async () => {
    const all = (await api.call('/v1/benefits?banks=copec&pageSize=100')).body;
    assert.ok(all.results.every((r) => r.bankKey === 'copec'));
    assert.equal(all.pagination.total, all.sources[0].count);
    const page2 = (await api.call('/v1/benefits?banks=copec&page=2&pageSize=5')).body;
    assert.deepEqual(
      page2.results.map((r) => r.id),
      all.results.slice(5, 10).map((r) => r.id),
    );
  });

  test('GET /v1/benefits valida emisores y paginacion como /v1/search', async () => {
    assert.equal((await api.call('/v1/benefits?banks=nope')).body.error.code, 'UNKNOWN_BANK');
    assert.equal((await api.call('/v1/benefits?pageSize=101')).body.error.code, 'INVALID_PAGINATION');
    assert.equal((await api.call({ method: 'POST', path: '/v1/benefits' })).status, 405);
  });

  const ERROR_CASES = [
    ['sin q', '/v1/search', 400, 'MISSING_QUERY'],
    ['q muy larga', `/v1/search?q=${'a'.repeat(101)}`, 400, 'QUERY_TOO_LONG'],
    ['banco desconocido', '/v1/search?q=x&banks=copec,nope', 400, 'UNKNOWN_BANK'],
    ['pageSize fuera de rango', '/v1/search?q=x&pageSize=101', 400, 'INVALID_PAGINATION'],
    ['page invalida', '/v1/search?q=x&page=0', 400, 'INVALID_PAGINATION'],
    ['JSON invalido', post('/v1/search', '{malo'), 400, 'INVALID_JSON'],
    ['body no objeto', post('/v1/search', '[1,2]'), 400, 'INVALID_BODY'],
    ['ruta inexistente', '/v1/nada', 404, 'NOT_FOUND'],
    ['metodo no permitido', { method: 'DELETE', path: '/v1/search' }, 405, 'METHOD_NOT_ALLOWED'],
  ];

  for (const [name, req, status, code] of ERROR_CASES) {
    test(`error uniforme: ${name}`, async () => {
      const res = await api.call(req);
      assert.equal(res.status, status);
      assert.equal(res.body.error.code, code);
      assert.equal(typeof res.body.error.message, 'string');
    });
  }

  test('UNKNOWN_BANK informa cuales son validos', async () => {
    const res = await api.call('/v1/search?q=x&banks=nope');
    assert.deepEqual(res.body.error.details.unknown, ['nope']);
    assert.ok(res.body.error.details.allowed.includes('copec'));
  });

  test('405 incluye el header Allow', async () => {
    const res = await api.call({ method: 'PUT', path: '/v1/search' });
    assert.equal(res.headers.allow, 'GET, POST');
  });

  test('sin CORS configurado no se envian headers CORS', async () => {
    const res = await api.call({ path: '/v1/banks', headers: { origin: 'https://app.cl' } });
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  test('/v1/health informa estado por emisor y version', async () => {
    const res = await api.call('/v1/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.version, '9.9.9');
    // Todos los emisores respondieron en las busquedas previas (Mercado Pago ya no falla con 403).
    assert.equal(res.body.status, 'ok');
    const mp = res.body.sources.find((s) => s.key === 'mercadopago');
    assert.equal(mp.status, 'ok');
    assert.equal(mp.count, 7);
    // En los tests REFRESH_TIME=off: sin actualizacion programada, un catalogo dura 24 h.
    assert.deepEqual(res.body.cache, {
      enabled: true,
      ttlSeconds: 86400,
      refreshMinAgeSeconds: 300,
      schedule: { enabled: false, time: null, timeZone: null, nextRunAt: null, lastRun: null },
    });
    assert.equal(mp.fetchedAt, '2026-11-12T15:00:00.000Z');
  });

  test('cada fuente informa cuando se descargo su catalogo, y meta desde cuando se puede actualizar', async () => {
    const res = await api.call('/v1/search?q=rappi&banks=copec,bci');
    for (const source of res.body.sources) assert.equal(source.fetchedAt, '2026-11-12T15:00:00.000Z');
    // FIXED_NOW + CACHE_REFRESH_MIN_AGE_SECONDS (300 por defecto).
    assert.equal(res.body.meta.refreshableAt, '2026-11-12T15:05:00.000Z');
  });

  test('refresh=true antes de la antiguedad minima no vuelve a descargar', async () => {
    await api.call('/v1/search?q=rappi&banks=santander');
    const before = api.fetchImpl.calls.length;
    const res = await api.call('/v1/search?q=rappi&banks=santander&refresh=true');
    assert.equal(api.fetchImpl.calls.length, before);
    assert.equal(res.body.sources[0].cached, true);
  });
});

describe('API con API_KEYS: solo responde a quien trae una llave valida', () => {
  const WEB_KEY = 'llave-web-de-prueba-0123456789abcdef';
  const MOBILE_KEY = 'llave-movil-de-prueba-0123456789abcd';
  const bearer = (key) => ({ authorization: `Bearer ${key}` });
  let api;
  before(async () => {
    api = await startInProcess({ API_KEYS: `web:${WEB_KEY},movil:${MOBILE_KEY}`, CORS_ORIGINS: 'https://app.cl' });
  });
  after(() => api.close());

  for (const path of ['/v1/search?q=rappi', '/v1/benefits', '/v1/banks', '/v1/health', '/v1/health?probe=true', '/v1/nada']) {
    test(`sin llave: ${path} responde 401 UNAUTHORIZED (formato v1)`, async () => {
      const res = await api.call(path);
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.match(res.headers['www-authenticate'], /^Bearer realm=/);
    });
  }

  test('sin llave: las rutas legadas tambien responden 401 (formato 1.x)', async () => {
    for (const req of ['/search?q=rappi', post('/search', { query: 'rappi' })]) {
      const res = await api.call(req);
      assert.equal(res.status, 401);
      assert.equal(typeof res.body.error, 'string');
    }
  });

  test('una llave incorrecta responde igual que no enviar llave, y no descarga nada', async () => {
    const before = api.fetchImpl.calls.length;
    const res = await api.call({ path: '/v1/search?q=rappi', headers: bearer('llave-incorrecta-0123456789abcdefghij') });
    assert.equal(res.status, 401);
    assert.equal(api.fetchImpl.calls.length, before);
  });

  test('con Bearer o con x-api-key responde normalmente', async () => {
    const viaBearer = await api.call({ path: '/v1/search?q=rappi&banks=copec', headers: bearer(WEB_KEY) });
    assert.equal(viaBearer.status, 200);
    assert.ok(viaBearer.body.results.length > 0);

    const viaHeader = await api.call({ path: '/v1/banks', headers: { 'x-api-key': MOBILE_KEY } });
    assert.equal(viaHeader.status, 200);

    const legacy = await api.call({ path: '/search?q=rappi&banks=Copec%20Pay', headers: bearer(WEB_KEY) });
    assert.equal(legacy.status, 200);
    assert.ok(Array.isArray(legacy.body.matches));
  });

  test('con llave, una ruta inexistente sigue siendo 404', async () => {
    const res = await api.call({ path: '/v1/nada', headers: bearer(WEB_KEY) });
    assert.equal(res.status, 404);
  });

  test('GET /health es publico (health check de la plataforma)', async () => {
    const res = await api.call('/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  });

  test('el preflight de CORS no exige llave (el navegador no la envia)', async () => {
    const res = await api.call({ method: 'OPTIONS', path: '/v1/search', headers: { origin: 'https://app.cl' } });
    assert.equal(res.status, 204);
    assert.match(res.headers['access-control-allow-headers'], /authorization/);
  });
});

describe('API v1 con actualizacion manual sin antiguedad minima', () => {
  let api;
  before(async () => {
    api = await startInProcess({ CACHE_REFRESH_MIN_AGE_SECONDS: '0' });
  });
  after(() => api.close());

  test('refresh=true (GET) y refresh: true (POST) vuelven a descargar el catalogo', async () => {
    await api.call('/v1/search?q=rappi&banks=copec');
    const afterFirst = api.fetchImpl.calls.length;

    const viaGet = await api.call('/v1/search?q=rappi&banks=copec&refresh=true');
    assert.ok(api.fetchImpl.calls.length > afterFirst);
    assert.equal(viaGet.body.sources[0].cached, false);

    const afterGet = api.fetchImpl.calls.length;
    const viaPost = await api.call(post('/v1/search', { query: 'rappi', banks: ['copec'], refresh: true }));
    assert.ok(api.fetchImpl.calls.length > afterGet);
    assert.equal(viaPost.body.sources[0].cached, false);
  });

  test('otro valor de refresh no fuerza la descarga', async () => {
    await api.call('/v1/search?q=rappi&banks=tenpo');
    const before = api.fetchImpl.calls.length;
    const res = await api.call('/v1/search?q=rappi&banks=tenpo&refresh=1');
    assert.equal(api.fetchImpl.calls.length, before);
    assert.equal(res.body.sources[0].cached, true);
  });
});

describe('API v1 con actualizacion diaria programada (REFRESH_TIME=09:00)', () => {
  let api;
  before(async () => {
    // Timers falsos: el scheduler queda programado, pero nada se dispara solo durante el test.
    const timers = { setTimer: () => ({}), clearTimer: () => {} };
    api = await startInProcess({ REFRESH_TIME: '09:00' }, { timers });
    api.app.refreshScheduler.start();
  });
  after(() => {
    api.app.refreshScheduler.stop();
    return api.close();
  });

  test('/v1/health informa la proxima ejecucion y cuanto dura hoy un catalogo', async () => {
    const res = await api.call('/v1/health');
    // FIXED_NOW = 12:00 en Chile: la proxima ejecucion es manana a las 09:00 (UTC-3), en 21 h + 1 h.
    assert.equal(res.body.cache.ttlSeconds, 22 * 3600);
    assert.deepEqual(res.body.cache.schedule, {
      enabled: true,
      time: '09:00',
      timeZone: 'America/Santiago',
      nextRunAt: '2026-11-13T12:00:00.000Z',
      lastRun: null,
    });
  });

  test('una ejecucion descarga todos los emisores y queda en lastRun', async () => {
    await api.call('/v1/search?q=rappi&banks=copec');
    const before = api.fetchImpl.calls.length;
    await api.app.refreshScheduler.runNow('scheduled');
    assert.ok(api.fetchImpl.calls.length > before); // aunque el catalogo de Copec sea reciente

    const { lastRun } = (await api.call('/v1/health')).body.cache.schedule;
    assert.equal(lastRun.trigger, 'scheduled');
    assert.equal(lastRun.finishedAt, '2026-11-12T15:00:00.000Z');
    assert.ok(['ok', 'partial'].includes(lastRun.status));
  });
});

describe('API v1 con CORS y limite de body', () => {
  let api;
  before(async () => {
    api = await startInProcess({ CORS_ORIGINS: 'https://app.cl', BODY_LIMIT_BYTES: '50' });
  });
  after(() => api.close());

  test('origen permitido recibe access-control-allow-origin', async () => {
    const res = await api.call({ path: '/v1/banks', headers: { origin: 'https://app.cl' } });
    assert.equal(res.headers['access-control-allow-origin'], 'https://app.cl');
    assert.equal(res.headers.vary, 'origin');
  });

  test('origen no permitido no recibe headers CORS', async () => {
    const res = await api.call({ path: '/v1/banks', headers: { origin: 'https://otro.cl' } });
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  test('preflight OPTIONS responde 204', async () => {
    const res = await api.call({ method: 'OPTIONS', path: '/v1/search', headers: { origin: 'https://app.cl' } });
    assert.equal(res.status, 204);
    assert.match(res.headers['access-control-allow-methods'], /POST/);
  });

  test('body sobre el limite responde 413', async () => {
    const res = await api.call(post('/v1/search', { query: 'x'.repeat(80) }));
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  test('/v1/health?probe=true consulta los catalogos', async () => {
    const res = await api.call('/v1/health?probe=true');
    const statuses = Object.fromEntries(res.body.sources.map((s) => [s.key, s.status]));
    assert.equal(statuses.copec, 'ok');
    assert.equal(statuses.mercadopago, 'ok'); // ahora es un catalogo: tambien se precarga
    assert.equal(res.body.status, 'ok');
  });
});
