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
  fs.writeFileSync(file, 'PORT=4000\nBCI_SUBSCRIPTION_KEY=desde-archivo\nMELI_ACCESS_TOKEN=tok\n');

  const config = loadConfig({ env: { PORT: '5000', MELI_ACCESS_TOKEN: '' }, envFilePath: file });
  assert.equal(config.port, 5000);
  assert.equal(config.bciSubscriptionKey, 'desde-archivo');
  assert.equal(config.mercadoPagoToken, '');
});

test('MERCADOPAGO_TOKEN es alternativa de MELI_ACCESS_TOKEN', () => {
  const config = loadConfig({ env: { MERCADOPAGO_TOKEN: 'abc' }, envFilePath: null });
  assert.equal(config.mercadoPagoToken, 'abc');
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
