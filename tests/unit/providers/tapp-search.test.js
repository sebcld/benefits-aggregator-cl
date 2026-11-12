// Busqueda de Tapp con datos REALES finalizados (tests/fixtures/http/tapp-finalizados.json).
// Hoy Tapp casi no tiene beneficios vigentes, asi que los finalizados sirven para probar que el
// mapeo de Tapp + el buscador encuentran un beneficio por marca. Es SOLO para tests: la API nunca
// descarga finalizados (ver tapp.test.js, "nunca pide al CMS las categorias finalizadas").
// Regrabar: npm run fixtures:record -- tapp-finalizados
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../../../src/bootstrap');
const { defineProvider } = require('../../../src/providers/provider.interface');
const { toTappEntry, parseTappEntry } = require('../../../src/providers/tapp.provider');
const finished = require('../../fixtures/http/tapp-finalizados.json');

const items = finished.records.flatMap((r) => r.json.entries);
const entries = items.map(toTappEntry);

// Provider de prueba con el mismo nombre y key que Tapp, pero con los finalizados grabados.
const tappFinished = defineProvider({ key: 'tapp', name: 'Tapp', fetch: async () => entries });
const app = createApp({ env: {}, envFilePath: null, providers: [tappFinished], defaultLogLevel: 'silent', cache: null });
const search = (query) => app.searchService.search(query, { banks: ['Tapp'] });

const MOTHERS_DAY = 'Regalonea a tu mamá con chocolates';
const BOZZO = '20% de dcto. en Chocolates Bozzo pagando con Tapp';

test('el fixture tiene solo finalizados (beneficios y convenios)', () => {
  assert.equal(items.length, 223);
  assert.deepEqual([...new Set(items.map((e) => e.meta.category))].sort(), ['beneficios-finalizados', 'convenios-finalizados']);
  // La API los descartaria: parseTappEntry nunca devuelve un finalizado.
  assert.ok(items.every((item) => parseTappEntry(item) === null));
});

for (const query of ['varsovienne', 'Varsovienne', 'la fete', 'La Fête', 'fete']) {
  test(`buscar "${query}" encuentra "${MOTHERS_DAY}"`, async () => {
    const { matches, errors } = await search(query);
    assert.deepEqual(errors, []);
    assert.deepEqual(matches.map((m) => m.title), [MOTHERS_DAY]);
    assert.equal(matches[0].url, 'https://www.tapp.cl/beneficios/beneficios-finalizados/chocolates-mes-de-la-madre');
  });
}

test('buscar "bozzo" encuentra el beneficio del Dia de la Madre y el convenio de Chocolates Bozzo', async () => {
  const { matches } = await search('bozzo');
  assert.deepEqual(matches.map((m) => m.title).sort(), [BOZZO, MOTHERS_DAY].sort());
  const convenio = matches.find((m) => m.title === BOZZO);
  assert.equal(convenio.url, 'https://www.tapp.cl/beneficios/convenios-finalizados/20percent-de-dcto-en-chocolates-bozzo-pagando-con-tapp');
});

test('una marca que no esta en Tapp no devuelve nada', async () => {
  const { matches } = await search('varsovienne bozzo inexistente');
  assert.deepEqual(matches, []);
});
