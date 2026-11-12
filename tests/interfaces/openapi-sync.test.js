// El contrato (docs/openapi.yaml) debe documentar cada ruta y cada campo que devuelve la API v1.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createRoutes } = require('../../src/interfaces/http/routes');
const { toV1Benefit } = require('../../src/interfaces/http/serializers');
const { createEntry } = require('../../src/domain/entry');
const { createFixtureApp } = require('../helpers/fakes');
const { ROOT } = require('../helpers/constants');

// Normaliza CRLF: con core.autocrlf=true (Windows) git entrega el archivo con \r\n.
const spec = fs.readFileSync(path.join(ROOT, 'docs', 'openapi.yaml'), 'utf8').replace(/\r\n/g, '\n');

// Bloque YAML de un schema: desde "    <Nombre>:" hasta el siguiente schema del mismo nivel.
const schemaBlock = (name) => {
  const start = spec.indexOf(`\n    ${name}:\n`);
  assert.ok(start >= 0, `schema ${name} no documentado`);
  const rest = spec.slice(start + 1);
  const end = rest.slice(1).search(/\n {4}[A-Za-z]+:\n/);
  return end >= 0 ? rest.slice(0, end + 1) : rest;
};

test('cada ruta esta documentada con su metodo', () => {
  const routes = createRoutes({ app: createFixtureApp(), version: 'test' });
  for (const route of routes) {
    const start = spec.indexOf(`\n  ${route.path}:\n`);
    assert.ok(start >= 0, `${route.path} no esta en openapi.yaml`);
    const block = spec.slice(start + 1).split(/\n {2}\/|\ncomponents:/)[0];
    assert.match(block, new RegExp(`\\n {4}${route.method.toLowerCase()}:`), `${route.method} ${route.path}`);
  }
});

test('cada campo de Benefit esta documentado', () => {
  const benefit = toV1Benefit(createEntry({ bank: 'X', title: 'T' }, { logo: 'l' }), () => 'x');
  const block = schemaBlock('Benefit');
  for (const field of Object.keys(benefit)) {
    assert.match(block, new RegExp(`\\n {8}${field}:`), `Benefit.${field}`);
  }
});

test('cada codigo de error HTTP esta en el enum de ErrorResponse', () => {
  const { STATUS_BY_CODE } = require('../../src/interfaces/http/middlewares/error-handler');
  const block = schemaBlock('ErrorResponse');
  for (const code of [...Object.keys(STATUS_BY_CODE).filter((c) => c !== 'VALIDATION_ERROR'), 'INTERNAL_ERROR']) {
    assert.ok(block.includes(`- ${code}`), code);
  }
});
