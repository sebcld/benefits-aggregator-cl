const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHttpClient } = require('../../../src/shared/http-client');
const { ProviderError, TimeoutError } = require('../../../src/domain/errors');

const respond = (status, body, headers = {}) => new Response(body, { status, headers });

test('envia user-agent y devuelve JSON', async () => {
  let seen;
  const http = createHttpClient({
    fetchImpl: async (url, init) => {
      seen = init.headers;
      return respond(200, '{"ok":true}');
    },
  });
  assert.deepEqual(await http.getJson('https://x', { label: 'X' }), { ok: true });
  assert.equal(seen['user-agent'], 'beneficios-finder/1.0');
});

test('respuesta no-OK lanza ProviderError con el mensaje historico', async () => {
  const http = createHttpClient({ fetchImpl: async () => respond(403, 'prohibido') });
  await assert.rejects(http.getJson('https://x', { label: 'Mercado Pago' }), (err) => {
    assert.ok(err instanceof ProviderError);
    assert.equal(err.message, 'Mercado Pago respondio 403: prohibido');
    assert.equal(err.status, 403);
    assert.equal(err.code, 'HTTP_ERROR');
    return true;
  });
});

test('reintenta 429 respetando retry-after', async () => {
  const pauses = [];
  let calls = 0;
  const http = createHttpClient({
    sleep: async (ms) => pauses.push(ms),
    fetchImpl: async () => {
      calls += 1;
      return calls < 3 ? respond(429, '', { 'retry-after': '2' }) : respond(200, 'ok');
    },
  });
  const text = await http.getText('https://x', {
    label: 'X',
    retry: { maxAttempts: 5, defaultDelaySeconds: 8 },
  });
  assert.equal(text, 'ok');
  assert.deepEqual(pauses, [2000, 2000]);
});

test('deja de reintentar al llegar al maximo de intentos', async () => {
  const http = createHttpClient({
    sleep: async () => {},
    fetchImpl: async () => respond(429, 'lento'),
  });
  await assert.rejects(
    http.getText('https://x', { label: 'X', retry: { maxAttempts: 2, defaultDelaySeconds: 1 } }),
    /X respondio 429: lento/,
  );
});

test('timeout por peticion lanza TimeoutError', async () => {
  const http = createHttpClient({
    timeoutMs: 20,
    fetchImpl: (url, { signal }) =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
  });
  await assert.rejects(http.getText('https://x', { label: 'Lento' }), (err) => {
    assert.ok(err instanceof TimeoutError);
    assert.equal(err.code, 'TIMEOUT');
    return true;
  });
});

test('los errores de red se propagan tal cual', async () => {
  const http = createHttpClient({
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
  });
  await assert.rejects(http.getText('https://x', { label: 'X' }), /fetch failed/);
});
