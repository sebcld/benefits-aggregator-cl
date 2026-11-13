// API key: lectura de API_KEYS y validacion de la llave en cada peticion (ADR 0014).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseApiKeys } = require('../../../src/config/api-keys');
const { loadConfig } = require('../../../src/config');
const { ConfigError } = require('../../../src/domain/errors');
const { createAuthenticator, presentedKey } = require('../../../src/interfaces/http/middlewares/auth');

const WEB_KEY = 'llave-web-de-prueba-0123456789abcdef';
const MOBILE_KEY = 'llave-movil-de-prueba-0123456789abcd';
const parse = (...items) => {
  const problems = [];
  return { keys: parseApiKeys(items, problems), problems };
};
const request = (headers) => ({ headers });

test('API_KEYS: con nombre ("web:<llave>") o sin nombre', () => {
  const { keys, problems } = parse(`web:${WEB_KEY}`, MOBILE_KEY);
  assert.deepEqual(problems, []);
  assert.deepEqual(keys, [
    { name: 'web', key: WEB_KEY },
    { name: 'cliente-2', key: MOBILE_KEY },
  ]);
});

test('API_KEYS: rechaza llaves cortas o repetidas sin mostrar la llave en el mensaje', () => {
  const { keys, problems } = parse('web:corta', `a:${WEB_KEY}`, `b:${WEB_KEY}`, `a:${MOBILE_KEY}`);
  assert.equal(keys.length, 1);
  assert.equal(problems.length, 3);
  assert.match(problems[0], /"web" debe tener al menos 32 caracteres/);
  assert.match(problems[1], /llave de "b" esta repetida/);
  assert.match(problems[2], /nombre "a" esta repetido/);
  for (const message of problems) assert.ok(!message.includes(WEB_KEY) && !message.includes('corta'));
});

test('loadConfig: sin API_KEYS no hay llaves; una llave debil detiene el inicio', () => {
  assert.deepEqual(loadConfig({ env: {}, envFilePath: null }).apiKeys, []);
  assert.equal(loadConfig({ env: { API_KEYS: `web:${WEB_KEY}` }, envFilePath: null }).apiKeys[0].name, 'web');
  assert.throws(() => loadConfig({ env: { API_KEYS: 'web:123' }, envFilePath: null }), ConfigError);
});

test('la llave se lee de Authorization: Bearer o de x-api-key', () => {
  assert.equal(presentedKey({ authorization: `Bearer ${WEB_KEY}` }), WEB_KEY);
  assert.equal(presentedKey({ authorization: `bearer   ${WEB_KEY} ` }), WEB_KEY);
  assert.equal(presentedKey({ 'x-api-key': WEB_KEY }), WEB_KEY);
  assert.equal(presentedKey({ authorization: `Basic abc` }), '');
  assert.equal(presentedKey({}), '');
});

test('autentica y devuelve el nombre del cliente', () => {
  const auth = createAuthenticator([
    { name: 'web', key: WEB_KEY },
    { name: 'movil', key: MOBILE_KEY },
  ]);
  assert.equal(auth.enabled, true);
  assert.equal(auth.authenticate(request({ authorization: `Bearer ${WEB_KEY}` })), 'web');
  assert.equal(auth.authenticate(request({ 'x-api-key': MOBILE_KEY })), 'movil');
});

test('sin llave, con una llave incorrecta o con un prefijo de la correcta: 401 UNAUTHORIZED', () => {
  const auth = createAuthenticator([{ name: 'web', key: WEB_KEY }]);
  for (const headers of [{}, { 'x-api-key': 'otra' }, { authorization: `Bearer ${WEB_KEY.slice(0, -1)}` }, { authorization: WEB_KEY }]) {
    assert.throws(
      () => auth.authenticate(request(headers)),
      (err) => err.status === 401 && err.code === 'UNAUTHORIZED' && /^Bearer/.test(err.headers['www-authenticate']),
      JSON.stringify(headers),
    );
  }
});

test('sin llaves configuradas la autenticacion esta desactivada', () => {
  const auth = createAuthenticator([]);
  assert.equal(auth.enabled, false);
  assert.equal(auth.authenticate(request({})), null);
});
