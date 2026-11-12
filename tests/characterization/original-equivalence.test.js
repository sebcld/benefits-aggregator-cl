// Equivalencia con el codigo ORIGINAL (commit f8352c7, tests/fixtures/golden-original).
//
// Cambios intencionales, y los unicos aceptados:
//  1. Banco de Chile cambio de fuente (API "Todos los beneficios" en vez de scraping de 9 paginas),
//     pedido para que "PROWASHGO" funcione. Sus resultados se excluyen de la comparacion.
//  2. API legada: JSON invalido -> 400 (antes 500) y ruteo exacto (/searchXYZ, /healthcheck -> 404).
// Todo lo demas debe ser identico al original.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ORIGINAL_GOLDEN_DIR, GOLDEN_DIR } = require('../helpers/constants');
const { assertSameJson } = require('../helpers/assertions');

const load = (dir, name) => require(path.join(dir, name));
const original = {
  providers: load(ORIGINAL_GOLDEN_DIR, 'providers.json'),
  search: load(ORIGINAL_GOLDEN_DIR, 'search.json'),
  cli: load(ORIGINAL_GOLDEN_DIR, 'cli.json'),
  http: load(ORIGINAL_GOLDEN_DIR, 'http-legacy.json'),
};
const current = {
  providers: load(GOLDEN_DIR, 'providers.json'),
  search: load(GOLDEN_DIR, 'search.json'),
  cli: load(GOLDEN_DIR, 'cli.json'),
  http: load(GOLDEN_DIR, 'http-legacy.json'),
};

const CHANGED_BANK = 'Banco de Chile';
const withoutChangedBank = (matches) => matches.filter((m) => m.bank !== CHANGED_BANK);

// Quita del stdout del CLI el bloque "Banco de Chile (n)" (hasta el siguiente emisor).
function stripBankBlock(stdout, bank) {
  const blocks = stdout.split(/\n(?=\n[^\n]+ \(\d+\)\n)/);
  return blocks.filter((block) => !block.startsWith(`\n${bank} (`)).join('\n');
}

const INTENTIONAL_HTTP = {
  'POST search JSON invalido': { status: 400, body: { error: 'JSON invalido' } },
  'prefijo de search': { status: 404, body: { error: 'No encontrado' } },
  'prefijo de health': { status: 404, body: { error: 'No encontrado' } },
};

for (const name of Object.keys(original.providers)) {
  if (name === 'bancochile') continue;
  test(`original: extractor ${name} identico`, () => {
    assertSameJson(current.providers[name], original.providers[name]);
  });
}

for (const [name, expected] of Object.entries(original.search)) {
  test(`original: busqueda "${name}" identica fuera de Banco de Chile`, () => {
    const actual = current.search[name];
    assertSameJson(withoutChangedBank(actual.matches), withoutChangedBank(expected.matches));
    assertSameJson(actual.errors, expected.errors);
  });
}

for (const [name, expected] of Object.entries(original.cli)) {
  test(`original: CLI "${name}" identico fuera de Banco de Chile`, () => {
    const actual = current.cli[name];
    assert.equal(stripBankBlock(actual.stdout, CHANGED_BANK), stripBankBlock(expected.stdout, CHANGED_BANK));
    assert.equal(actual.stderr, expected.stderr);
    assert.equal(actual.code, expected.code);
  });
}

for (const [name, expected] of Object.entries(original.http)) {
  test(`original: API legada "${name}"`, () => {
    const actual = current.http[name];
    const target = INTENTIONAL_HTTP[name] ? { ...expected, ...INTENTIONAL_HTTP[name] } : expected;
    assert.equal(actual.status, target.status);
    assert.equal(actual.contentType, target.contentType);

    if (target.body?.matches) {
      assertSameJson(withoutChangedBank(actual.body.matches), withoutChangedBank(target.body.matches));
      assertSameJson(actual.body.errors, target.body.errors);
    } else {
      assertSameJson(actual.body, target.body);
    }
  });
}

test('original: los cambios HTTP intencionales son exactamente 3 y si difieren del original', () => {
  assert.equal(Object.keys(INTENTIONAL_HTTP).length, 3);
  for (const [name, change] of Object.entries(INTENTIONAL_HTTP)) {
    assert.notEqual(original.http[name].status, change.status, name);
  }
});

test('stripBankBlock quita solo el bloque del emisor indicado', () => {
  const out = 'Coincidencias para "x":\n\nA (1)\n- a\n\nBanco de Chile (2)\n- b\n- c\n\nC (1)\n- d\n';
  assert.equal(stripBankBlock(out, CHANGED_BANK), 'Coincidencias para "x":\n\nA (1)\n- a\n\nC (1)\n- d\n');
});
