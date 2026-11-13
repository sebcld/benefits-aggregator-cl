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

test('parseEnvContent soporta comentarios, export y comillas', () => {
  const vars = parseEnvContent('# comentario\nexport A=1\nB="dos # no es comentario"\nC=3 # si\n\nD=');
  assert.deepEqual(vars, { A: '1', B: 'dos # no es comentario', C: '3', D: '' });
});
