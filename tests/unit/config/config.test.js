const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require('../../../src/config');
const { parseEnvContent } = require('../../../src/config/env-file');
const { ConfigError } = require('../../../src/domain/errors');

test('valores por defecto sin .env ni variables', () => {
  const config = loadConfig({ env: {}, envFilePath: null });
  assert.equal(config.port, 3000);
  assert.equal(config.logLevel, null);
  assert.equal(config.bciSubscriptionKey, '');
  assert.equal(config.cacheTtlSeconds, 1800);
  assert.equal(config.cacheRefreshMinAgeSeconds, 300);
  assert.deepEqual(config.corsOrigins, []);
  assert.ok(Object.isFrozen(config));
});

test('las variables del entorno tienen prioridad sobre el archivo .env', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'PORT=4000\nBCI_SUBSCRIPTION_KEY=desde-archivo\nJINA_API_KEY=tok\n');

  const config = loadConfig({ env: { PORT: '5000', JINA_API_KEY: '' }, envFilePath: file });
  assert.equal(config.port, 5000);
  assert.equal(config.bciSubscriptionKey, 'desde-archivo');
  assert.equal(config.jinaApiKey, '');
});

test('variables que ya no se usan (por ejemplo MELI_ACCESS_TOKEN de un .env viejo) se ignoran', () => {
  const config = loadConfig({ env: { MELI_ACCESS_TOKEN: 'abc', MERCADOPAGO_TOKEN: 'def' }, envFilePath: null });
  assert.equal('mercadoPagoToken' in config, false);
});

test('CACHE_REFRESH_MIN_AGE_SECONDS acepta 0 (sin minimo) y rechaza valores no enteros', () => {
  const config = loadConfig({ env: { CACHE_REFRESH_MIN_AGE_SECONDS: '0' }, envFilePath: null });
  assert.equal(config.cacheRefreshMinAgeSeconds, 0);
  assert.throws(() => loadConfig({ env: { CACHE_REFRESH_MIN_AGE_SECONDS: '5m' }, envFilePath: null }), ConfigError);
});

test('REFRESH_TIME: 09:00 por defecto, "off" la desactiva y un formato invalido es un error', () => {
  const load = (env) => loadConfig({ env, envFilePath: null });
  assert.equal(load({}).refreshTime, '09:00');
  assert.equal(load({ REFRESH_TIME: '07:30' }).refreshTime, '07:30');
  assert.equal(load({ REFRESH_TIME: 'off' }).refreshTime, null);
  for (const bad of ['9:00', '25:00', 'manana']) {
    assert.throws(() => load({ REFRESH_TIME: bad }), ConfigError, bad);
  }
});

test('CACHE_WARMUP es true por defecto (la cache en memoria arranca vacia)', () => {
  assert.equal(loadConfig({ env: {}, envFilePath: null }).cacheWarmup, true);
  assert.equal(loadConfig({ env: { CACHE_WARMUP: 'false' }, envFilePath: null }).cacheWarmup, false);
});

test('CACHE_TTL_SECONDS explicita y mayor que 0 deja un aviso; 0 desactiva la cache sin aviso', () => {
  assert.deepEqual(loadConfig({ env: {}, envFilePath: null }).warnings, []);
  const legacy = loadConfig({ env: { CACHE_TTL_SECONDS: '7200' }, envFilePath: null });
  assert.equal(legacy.warnings.length, 1);
  assert.match(legacy.warnings[0], /REFRESH_TIME/);
  const off = loadConfig({ env: { CACHE_TTL_SECONDS: '0' }, envFilePath: null });
  assert.equal(off.cacheTtlSeconds, 0);
  assert.deepEqual(off.warnings, []);
});

test('CORS_ORIGINS se separa por comas', () => {
  const config = loadConfig({ env: { CORS_ORIGINS: ' https://a.cl, * ,' }, envFilePath: null });
  assert.deepEqual(config.corsOrigins, ['https://a.cl', '*']);
});

test('valores invalidos lanzan ConfigError con todos los problemas', () => {
  assert.throws(
    () => loadConfig({ env: { PORT: 'abc', LOG_LEVEL: 'verbose' }, envFilePath: null }),
    (err) => {
      assert.ok(err instanceof ConfigError);
      assert.equal(err.details.length, 2);
      return true;
    },
  );
});

test('los tests fijan cada variable de .env.example: el .env local no los afecta', () => {
  const { TEST_ENV, ROOT } = require('../../helpers/constants');
  const example = parseEnvContent(fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8'));
  for (const name of Object.keys(example)) assert.ok(name in TEST_ENV, name);
  // Un API_KEYS en el .env local no debe activar la autenticacion en el servidor de los tests.
  assert.equal(TEST_ENV.API_KEYS, '');
  const fromLocalEnv = { API_KEYS: 'web:una-llave-local-de-mas-de-32-caracteres' };
  assert.deepEqual(loadConfig({ env: { ...fromLocalEnv, ...TEST_ENV }, envFilePath: null }).apiKeys, []);
});

test('parseEnvContent soporta comentarios, export y comillas', () => {
  const vars = parseEnvContent('# comentario\nexport A=1\nB="dos # no es comentario"\nC=3 # si\n\nD=');
  assert.deepEqual(vars, { A: '1', B: 'dos # no es comentario', C: '3', D: '' });
});
