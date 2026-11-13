// Categorias de busqueda: "gas", "bus" y "taxi" encuentran los comercios de esa categoria en todos
// los emisores (src/services/search-categories.js).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matchesQuery } = require('../../../src/services/matcher');
const { categoryFor, CATEGORIES } = require('../../../src/services/search-categories');
const { createApp } = require('../../../src/bootstrap');
const { defineProvider } = require('../../../src/providers/provider.interface');
const { createEntry } = require('../../../src/domain/entry');
const { toTappEntry } = require('../../../src/providers/tapp.provider');
const { createFixtureApp } = require('../../helpers/fakes');
const tappFinished = require('../../fixtures/http/tapp-finalizados.json');

const app = createFixtureApp();
const search = async (query) => (await app.searchService.search(query)).matches;
const has = (matches, bank, titlePattern) => matches.some((m) => m.bank === bank && titlePattern.test(m.title));
const entry = (fields) => ({ bank: 'X', title: '', ...fields });

test('"gas" encuentra Gasconnect y Lipigas (Mercado Pago), Lipigas (BCI) y Abastible (fixtures reales)', async () => {
  const matches = await search('gas');
  assert.equal(matches.filter((m) => m.bank === 'Mercado Pago' && m.title === 'Gasconnect').length, 2);
  assert.equal(matches.filter((m) => m.bank === 'Mercado Pago' && m.title === 'Lipigas').length, 2);
  assert.ok(has(matches, 'BCI', /^Lipigas$/));
  assert.ok(has(matches, 'Banco de Chile', /^Abastible$/));
  // "lo paGAS COn tus tarjetas" no es Gasco: la categoria no incluye "gasco" suelto.
  assert.ok(!has(matches, 'Tenpo', /Papa Johns/));
});

test('"bus" y "buses" encuentran Turbus y FlixBus en todos los emisores (fixtures reales)', async () => {
  for (const query of ['bus', 'buses', 'Bus']) {
    const matches = await search(query);
    assert.ok(has(matches, 'Mercado Pago', /^Turbus$/), query);
    assert.ok(has(matches, 'Tenpo', /FlixBus/), query);
    assert.ok(has(matches, 'Tapp', /FlixBus/), query);
    assert.ok(has(matches, 'Banco de Chile', /^FLIXBUS$/), query);
    // "Pullman" sin "bus" es una cadena de hoteles (BCI, ALL ACCOR): no cuenta como bus.
    assert.ok(!has(matches, 'BCI', /ACCOR/), query);
  }
});

test('"bus" encuentra Kupos (convenio real de Tapp, de los finalizados grabados solo para tests)', async () => {
  const entries = tappFinished.records.flatMap((r) => r.json.entries).map(toTappEntry);
  const kupos = entries.filter((e) => /kupos/i.test(e.title));
  assert.ok(kupos.length > 0, 'el fixture debe traer convenios de Kupos');
  const provider = defineProvider({ key: 'tapp', name: 'Tapp', fetch: async () => entries });
  const tapp = createApp({ env: {}, envFilePath: null, providers: [provider], defaultLogLevel: 'silent', cache: null });
  const { matches } = await tapp.searchService.search('bus');
  for (const k of kupos) assert.ok(matches.some((m) => m.id === k.id), k.title);
});

test('"taxi" encuentra Cabify (Mercado Pago) y Transvip (Tapp y Banco de Chile) (fixtures reales)', async () => {
  for (const query of ['taxi', 'taxis', 'Taxi']) {
    const matches = await search(query);
    assert.ok(has(matches, 'Mercado Pago', /^Cabify$/), query);
    assert.ok(has(matches, 'Tapp', /Transvip/), query);
    assert.ok(has(matches, 'Banco de Chile', /^Transvip$/), query);
  }
});

test('"taxi" encuentra Uber, pero no Uber Eats ni DiDi Food (son delivery)', () => {
  assert.equal(matchesQuery(entry({ title: 'Uber', description: '20% en tus viajes' }), 'taxi'), true);
  assert.equal(matchesQuery(entry({ title: 'DiDi', description: 'Viajes con descuento' }), 'taxi'), true);
  assert.equal(matchesQuery(entry({ title: 'Uber Eats', description: 'Delivery gratis' }), 'taxi'), false);
  assert.equal(matchesQuery(entry({ title: 'DiDi Food' }), 'taxi'), false);
  // Si la marca aparece tambien por si sola, si cuenta.
  assert.equal(matchesQuery(entry({ title: 'Uber Eats y Uber', description: 'Viajes y delivery' }), 'taxi'), true);
});

test('las categorias aplican a cualquier emisor (son globales, en el matcher)', async () => {
  const provider = defineProvider({
    key: 'nuevo',
    name: 'Emisor Nuevo',
    fetch: async () => [createEntry({ bank: 'Emisor Nuevo', title: 'Cabify 30%' }), createEntry({ bank: 'Emisor Nuevo', title: 'Kupos 10%' })],
  });
  const other = createApp({ env: {}, envFilePath: null, providers: [provider], defaultLogLevel: 'silent', cache: null });
  assert.deepEqual((await other.searchService.search('taxi')).matches.map((m) => m.title), ['Cabify 30%']);
  assert.deepEqual((await other.searchService.search('bus')).matches.map((m) => m.title), ['Kupos 10%']);
});

test('solo se activa con la consulta completa: "taxi aeropuerto" no busca todos los taxis', () => {
  assert.equal(categoryFor('taxi aeropuerto'), null);
  assert.equal(matchesQuery(entry({ title: 'Cabify' }), 'taxi aeropuerto'), false);
  assert.equal(matchesQuery(entry({ title: 'Cabify' }), 'cabify'), true);
});

test('los alias se normalizan igual que la consulta (mayusculas, tildes, espacios)', () => {
  assert.ok(categoryFor('gas licuado'));
  assert.ok(categoryFor('pasajes de bus'));
  assert.ok(CATEGORIES.every((c) => c.aliases.length && c.terms.length));
});

test('una busqueda normal no cambia: "rappi" no activa ninguna categoria', async () => {
  assert.equal(categoryFor('rappi'), null);
  const matches = await search('rappi');
  assert.ok(matches.every((m) => /rappi/i.test(`${m.title} ${m.subtitle} ${m.description} ${m.slug} ${m.commerceName}`)));
});
