// Tapp: solo se piden las categorias vigentes del CMS, como hace www.tapp.cl/beneficios.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { provider, parseTappEntry, DEFAULT_ACTIVE_CATEGORIES } = require('../../../src/providers/tapp.provider');
const { createTestContext } = require('../../helpers/provider-context');
const { createFixtureApp } = require('../../helpers/fakes');

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const page = (entries) => ({ meta: { total_entries: entries.length, total_pages: 1 }, entries });
const item = (name, category) => ({ meta: { name, category, slug: name.toLowerCase(), uuid: name }, fields: { Bajada: 'Texto' } });

/** fetch falso: lista de categorias + entradas por categoria; registra las URLs pedidas. */
function fakeCms({ categories, byCategory }) {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    if (url.includes('/types/beneficios-categoria/')) return json(page(categories.map((c) => ({ meta: { category: c } }))));
    const category = new URL(url).searchParams.get('meta.category');
    return json(page(byCategory[category] || []));
  };
  return { fetchImpl, urls };
}

test('nunca pide al CMS las categorias finalizadas (fixtures reales)', async () => {
  const ctx = createTestContext();
  await provider.fetch(ctx);
  const urls = ctx.fetchImpl.calls.map((c) => decodeURIComponent(c.url));
  assert.ok(urls.length > 0);
  for (const url of urls) assert.doesNotMatch(url, /finalizad/);
  assert.deepEqual(
    urls.filter((u) => u.includes('meta.category=')).map((u) => new URL(u).searchParams.get('meta.category')),
    ['convenios', 'beneficios'],
  );
});

test('devuelve los convenios vigentes, incluido FlixBus (fixtures reales)', async () => {
  const entries = await provider.fetch(createTestContext());
  assert.equal(entries.length, 6);
  assert.ok(entries.some((e) => /FlixBus/.test(e.title)));
  for (const e of entries) assert.match(e.url, /^https:\/\/www\.tapp\.cl\/beneficios\/convenios\//);
});

test('cuando Tapp publique beneficios vigentes, aparecen sin cambiar el codigo', async () => {
  const cms = fakeCms({
    categories: ['convenios', 'beneficios-finalizados', 'convenios-finalizados', 'beneficios'],
    byCategory: { convenios: [item('Convenio A', 'convenios')], beneficios: [item('Beneficio B', 'beneficios')] },
  });
  const entries = await provider.fetch(createTestContext({ fetchImpl: cms.fetchImpl }));
  assert.deepEqual(entries.map((e) => [e.title, e.url]), [
    ['Convenio A', 'https://www.tapp.cl/beneficios/convenios/convenio a'],
    ['Beneficio B', 'https://www.tapp.cl/beneficios/beneficios/beneficio b'],
  ]);
});

test('una categoria vigente nueva del CMS se incluye sola', async () => {
  const cms = fakeCms({ categories: ['convenios', 'promociones', 'promociones-finalizadas'], byCategory: { promociones: [item('Promo', 'promociones')] } });
  const entries = await provider.fetch(createTestContext({ fetchImpl: cms.fetchImpl }));
  assert.deepEqual(entries.map((e) => e.title), ['Promo']);
  assert.ok(cms.urls.every((u) => !/finalizad/.test(decodeURIComponent(u))));
});

test('si el CMS no entrega categorias, usa las vigentes conocidas', async () => {
  const cms = fakeCms({ categories: [], byCategory: {} });
  await provider.fetch(createTestContext({ fetchImpl: cms.fetchImpl }));
  const asked = cms.urls.filter((u) => u.includes('meta.category=')).map((u) => new URL(u).searchParams.get('meta.category'));
  assert.deepEqual(asked, DEFAULT_ACTIVE_CATEGORIES);
});

test('la descripcion es la Bajada sin el CSS incrustado; los terminos y condiciones no se muestran (fixtures reales)', async () => {
  const entries = await provider.fetch(createTestContext());
  const flixbus = entries.find((e) => /FlixBus/.test(e.title));
  assert.equal(
    flixbus.description,
    'Obtén 15% de descuento en tu pasaje para compras a través de la app Flixbus. Ingresa al link tinyurl.com/tappflixbus y genera el cupón que debes ingresar al comprar. ¡Aprovecha este beneficio en tu próximo viaje!',
  );
  for (const e of entries) {
    assert.doesNotMatch(e.description, /fake-link|text-decoration|\{|\}/, e.title);
    assert.doesNotMatch(e.description, /^T[eé]rminos y condiciones/i, e.title);
  }
});

test('la bajada indica para quien y donde aplica (Tipo de cliente · Regiones)', async () => {
  const entries = await provider.fetch(createTestContext());
  assert.equal(entries.find((e) => /FlixBus/.test(e.title)).subtitle, 'Cliente Tapp · Todo el país');
  assert.equal(entries.find((e) => /Papa Johns/.test(e.title)).subtitle, 'Cliente Tapp');
});

test('sin Bajada, la descripcion usa el Cuerpo como respaldo', () => {
  const entry = parseTappEntry({ meta: { name: 'X', category: 'convenios', slug: 'x', uuid: 'x' }, fields: { Cuerpo: '<p>Solo cuerpo</p>' } });
  assert.equal(entry.description, 'Solo cuerpo');
});

test('resguardo: una entrada finalizada nunca se devuelve aunque llegue en la respuesta', () => {
  assert.equal(parseTappEntry(item('Vieja', 'beneficios-finalizados')), null);
  assert.equal(parseTappEntry(item('Vieja', 'convenios-finalizados')), null);
});

test('buscar "flixbus" en Tapp encuentra el convenio (fixtures reales)', async () => {
  const { matches, errors } = await createFixtureApp().searchService.search('flixbus', { banks: ['Tapp'] });
  assert.deepEqual(errors, []);
  assert.deepEqual(matches.map((m) => m.url), ['https://www.tapp.cl/beneficios/convenios/dcto-en-flixbus-pagando-con-tapp']);
});
