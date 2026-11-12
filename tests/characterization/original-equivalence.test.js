// Equivalencia con el codigo ORIGINAL (commit f8352c7, tests/fixtures/golden-original).
//
// Cambios intencionales, y los unicos aceptados:
//  1. Banco de Chile cambio de fuente (API "Todos los beneficios" en vez de scraping de 9 paginas),
//     pedido para que "PROWASHGO" funcione. Sus resultados se excluyen de la comparacion.
//  2. API legada: JSON invalido -> 400 (antes 500) y ruteo exacto (/searchXYZ, /healthcheck -> 404).
//  3. BCI: el titulo pasa a ser el comercio ("Ansaldo"), el titulo de la oferta pasa a la bajada,
//     la condicion de tarjeta (subtitulo) va al inicio de la descripcion y el link apunta a la ficha
//     del beneficio en bci.cl. Sus registros se comparan sin title, subtitle, description ni url:
//     la cantidad, el orden y el resto de los campos deben seguir identicos.
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
const BCI = 'BCI';
const BCI_CHANGED_FIELDS = ['title', 'subtitle', 'description', 'url'];

const withoutBciChanges = (entry) =>
  entry.bank === BCI ? Object.fromEntries(Object.entries(entry).filter(([k]) => !BCI_CHANGED_FIELDS.includes(k))) : entry;
const comparable = (matches) => matches.filter((m) => m.bank !== CHANGED_BANK).map(withoutBciChanges);

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
    assertSameJson(current.providers[name].map(withoutBciChanges), original.providers[name].map(withoutBciChanges));
  });
}

test('original: BCI cambia exactamente title, subtitle, description y url', () => {
  const changed = new Set();
  current.providers.bci.forEach((entry, i) => {
    for (const key of Object.keys(entry)) if (entry[key] !== original.providers.bci[i][key]) changed.add(key);
  });
  assert.deepEqual([...changed].sort(), [...BCI_CHANGED_FIELDS].sort());
});

for (const [name, expected] of Object.entries(original.search)) {
  test(`original: busqueda "${name}" identica fuera de Banco de Chile y de los campos cambiados de BCI`, () => {
    const actual = current.search[name];
    assertSameJson(comparable(actual.matches), comparable(expected.matches));
    assertSameJson(actual.errors, expected.errors);
  });
}

const stripChangedBlocks = (stdout) => stripBankBlock(stripBankBlock(stdout, CHANGED_BANK), BCI);

for (const [name, expected] of Object.entries(original.cli)) {
  test(`original: CLI "${name}" identico fuera de Banco de Chile y BCI`, () => {
    const actual = current.cli[name];
    assert.equal(stripChangedBlocks(actual.stdout), stripChangedBlocks(expected.stdout));
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
      assertSameJson(comparable(actual.body.matches), comparable(target.body.matches));
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
