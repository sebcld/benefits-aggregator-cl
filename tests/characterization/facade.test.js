// Caracterizacion de la API publica (src/benefits.js): cada extractor y searchBenefits
// deben devolver exactamente lo mismo que el codigo original para los mismos fixtures.
const { test, before } = require('node:test');
const golden = {
  providers: require('../fixtures/golden/providers.json'),
  search: require('../fixtures/golden/search.json'),
};
const { dumpFacade } = require('../helpers/processes');
const { assertSameJson } = require('../helpers/assertions');

let actual;

before(async () => {
  actual = await dumpFacade();
});

for (const name of Object.keys(golden.providers)) {
  test(`extractor ${name} devuelve lo mismo que el original`, () => {
    assertSameJson(actual.providers[name], golden.providers[name], name);
  });
}

for (const name of Object.keys(golden.search)) {
  test(`searchBenefits: ${name}`, () => {
    assertSameJson(actual.search[name], golden.search[name], name);
  });
}
