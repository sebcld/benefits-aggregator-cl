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
//  4. Tapp: la descripcion es la Bajada (antes, los "Terminos y condiciones" del Cuerpo), sin el
//     CSS que traia incrustado, y la bajada pasa a ser "Tipo de cliente · Regiones". Sus registros
//     se comparan sin subtitle ni description.
//  5. Mercado Pago cambio de fuente: antes buscaba productos en Mercado Libre (siempre respondia 403
//     y quedaba en "errors"); ahora lee los beneficios de la landing de la tarjeta prepago. Igual que
//     Banco de Chile, sus resultados y su error historico se excluyen de la comparacion.
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
// Emisores que cambiaron de fuente (puntos 1 y 5): no se comparan sus resultados ni sus errores.
const CHANGED_SOURCES = [CHANGED_BANK, 'Mercado Pago'];
const PROVIDER_KEYS_CHANGED_SOURCE = ['bancochile', 'mercadopago'];
const fromUnchangedSource = (item) => !CHANGED_SOURCES.includes(item.bank);
// stderr del CLI sin las lineas "<emisor> no disponible: ..." de esos emisores.
const stderrWithoutChangedSources = (stderr) =>
  stderr
    .split('\n')
    .filter((line) => !CHANGED_SOURCES.some((bank) => line.startsWith(`${bank} no disponible:`)))
    .join('\n');
// Campos que cambiaron a proposito, por emisor (puntos 3 y 4). El resto se compara igual.
const CHANGED_FIELDS = {
  BCI: ['title', 'subtitle', 'description', 'url'],
  Tapp: ['subtitle', 'description'],
};
const PROVIDER_BANK = { bci: 'BCI', tapp: 'Tapp' };

const withoutIntentionalChanges = (entry) => {
  const fields = CHANGED_FIELDS[entry.bank];
  return fields ? Object.fromEntries(Object.entries(entry).filter(([k]) => !fields.includes(k))) : entry;
};
const comparable = (matches) => matches.filter(fromUnchangedSource).map(withoutIntentionalChanges);

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
  if (PROVIDER_KEYS_CHANGED_SOURCE.includes(name)) continue;
  test(`original: extractor ${name} identico`, () => {
    assertSameJson(current.providers[name].map(withoutIntentionalChanges), original.providers[name].map(withoutIntentionalChanges));
  });
}

for (const [provider, bank] of Object.entries(PROVIDER_BANK)) {
  test(`original: ${bank} cambia exactamente ${CHANGED_FIELDS[bank].join(', ')}`, () => {
    const changed = new Set();
    current.providers[provider].forEach((entry, i) => {
      for (const key of Object.keys(entry)) if (entry[key] !== original.providers[provider][i][key]) changed.add(key);
    });
    assert.deepEqual([...changed].sort(), [...CHANGED_FIELDS[bank]].sort());
  });
}

for (const [name, expected] of Object.entries(original.search)) {
  test(`original: busqueda "${name}" identica fuera de los emisores y campos cambiados a proposito`, () => {
    const actual = current.search[name];
    assertSameJson(comparable(actual.matches), comparable(expected.matches));
    assertSameJson(actual.errors.filter(fromUnchangedSource), expected.errors.filter(fromUnchangedSource));
  });
}

// El CLI imprime titulo, bajada y descripcion: se quitan los bloques de los emisores que cambiaron.
const stripChangedBlocks = (stdout) =>
  [...CHANGED_SOURCES, ...Object.keys(CHANGED_FIELDS)].reduce((out, bank) => stripBankBlock(out, bank), stdout);

for (const [name, expected] of Object.entries(original.cli)) {
  test(`original: CLI "${name}" identico fuera de los emisores que cambiaron`, () => {
    const actual = current.cli[name];
    assert.equal(stripChangedBlocks(actual.stdout), stripChangedBlocks(expected.stdout));
    assert.equal(stderrWithoutChangedSources(actual.stderr), stderrWithoutChangedSources(expected.stderr));
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
      assertSameJson(actual.body.errors.filter(fromUnchangedSource), target.body.errors.filter(fromUnchangedSource));
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
