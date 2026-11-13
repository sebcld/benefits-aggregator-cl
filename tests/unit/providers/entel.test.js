// Entel (Club Entel): catalogo de https://www.entel.cl/beneficios y condiciones de cada ficha.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { provider, LIST_URL } = require('../../../src/providers/entel.provider');
const parser = require('../../../src/providers/entel.parser');
const { createTestContext } = require('../../helpers/provider-context');
const { createReplayFetch, loadHttpFixtures } = require('../../helpers/replay-fetch');

const fetchAll = (ctx = createTestContext()) => provider.fetch(ctx);
const bySlug = (entries, slug) => entries.find((e) => e.slug === slug);

test('extrae los 92 beneficios, uno por ficha aunque aparezcan en varias secciones (fixtures reales)', async () => {
  const entries = await fetchAll();
  assert.equal(entries.length, 92);
  assert.equal(new Set(entries.map((e) => e.id)).size, 92);
  for (const e of entries) {
    for (const field of ['title', 'subtitle', 'description', 'category', 'url', 'logo']) assert.ok(e[field], `${e.slug}.${field}`);
    assert.match(e.url, /^https:\/\/www\.entel\.cl\/beneficios\/(descuentos|eventos)\//);
  }
});

test('titulo, descuento, condiciones, dias, categoria, vigencia y logo (Dunkin)', async () => {
  const dunkin = bySlug(await fetchAll(), 'dunkin');
  assert.equal(dunkin.bank, 'Entel');
  assert.equal(dunkin.title, 'Dunkin');
  assert.equal(dunkin.subtitle, '30% descuento · Todos los jueves');
  assert.match(dunkin.description, /^Descuento Jueves: 30% de descuento todos los jueves en el total de la boleta\. Descuento válido/);
  assert.match(dunkin.description, /No acumulable con otras promociones\./);
  assert.equal(dunkin.category, 'Comida'); // el banner principal no cuenta como categoria
  assert.equal(dunkin.tagsText, 'jueves');
  assert.equal(dunkin.validUntil, '2026-12-31');
  assert.equal(dunkin.keywords, 'Descuento Jueves');
  assert.equal(dunkin.logo, 'https://entel.cdn.modyo.com/libraries/recursos/src/icon-lit/marcas/dunkin.png');
  assert.equal(dunkin.url, 'https://www.entel.cl/beneficios/descuentos/dunkin');
});

test('un beneficio en varias categorias las junta (Super Zoo) y lee "del ... al ..." y el tope', async () => {
  const superZoo = bySlug(await fetchAll(), 'super-zoo');
  assert.equal(superZoo.category, 'Mascotas, Tiendas');
  assert.equal(superZoo.validFrom, '2026-02-03');
  assert.equal(superZoo.validUntil, '2026-12-31');
  assert.equal(superZoo.discountCap, '$80.000');
});

test('topes de descuento, con y sin "$" (Burger King, Cabify)', async () => {
  const entries = await fetchAll();
  assert.equal(bySlug(entries, 'burger-king').discountCap, '$15.000');
  assert.equal(bySlug(entries, 'cabify').discountCap, '$2.000'); // "Tope 2.000"
  assert.equal(entries.filter((e) => e.discountCap).length, 10);
});

test('una vigencia ya vencida no se publica (la pagina sigue mostrando el beneficio)', async () => {
  const cabify = bySlug(await fetchAll(), 'cabify'); // "Válido hasta el 31-12-2025"
  assert.match(cabify.description, /Válido hasta el 31-12-2025/);
  assert.equal(cabify.validUntil, '');
});

test('eventos: lugar y fecha como bajada, imagen de la tarjeta como logo', async () => {
  const gorillaz = bySlug(await fetchAll(), 'gorillaz-santiago-2026');
  assert.equal(gorillaz.title, 'Gorillaz');
  assert.equal(gorillaz.subtitle, 'Estadio Bicentenario La Florida · 04 diciembre 2026');
  assert.equal(gorillaz.category, 'Eventos');
  assert.equal(gorillaz.description, 'Máximo 4 entradas por cliente. 20% Descuento hasta agotar stock.');
  assert.match(gorillaz.logo, /^https:\/\/entel\.cdn\.modyo\.com\/uploads\//);
});

test('una ficha con el modal de condiciones vacio usa el texto de la tarjeta (Lounge)', async () => {
  const lounge = bySlug(await fetchAll(), 'lounge');
  assert.equal(lounge.description, '20% dcto. los lunes con el Club Entel');
});

test('si una ficha falla, el beneficio se publica igual con los datos de la lista', async () => {
  const records = loadHttpFixtures().filter((r) => r.url !== 'https://www.entel.cl/beneficios/descuentos/dunkin');
  const entries = await fetchAll(createTestContext({ fetchImpl: createReplayFetch(records) }));
  const dunkin = bySlug(entries, 'dunkin');
  assert.equal(entries.length, 92);
  assert.equal(dunkin.description, '30% descuento · Todos los jueves');
  assert.equal(dunkin.validUntil, '');
});

test('una pagina sin tarjetas es INVALID_RESPONSE (cambio de formato o pagina de error)', async () => {
  const fetchImpl = createReplayFetch([{ url: LIST_URL, status: 200, headers: { 'content-type': 'text/html' }, text: '<html>Mantención</html>' }]);
  await assert.rejects(fetchAll(createTestContext({ fetchImpl })), { code: 'INVALID_RESPONSE' });
});

test('parseDetail: secciones con titulo y condiciones sin numeracion', () => {
  const html = `<andino-modal-passive eds-id='termsModal' eds-title='Información del beneficio'><div class="modal-text">
    <div class="mb-2 pb-1"><p><strong>Usuarios nuevos:</strong></p><p>1. Máximo 1 uso&nbsp;por usuario.</p><p>2.- Tope $2.000.</p></div>
    <div class="mb-2 pb-1"><ul><li><p>Máximo 4 entradas.</p></li></ul></div></div></andino-modal-passive>`;
  assert.deepEqual(parser.parseDetail(html), [
    { heading: 'Usuarios nuevos', items: ['Máximo 1 uso por usuario.', 'Tope $2.000.', 'Máximo 4 entradas.'] },
  ]);
  assert.deepEqual(parser.parseDetail('<html>sin modal</html>'), []);
});

test('readTerms: formatos de fecha y topes', () => {
  const terms = (...items) => parser.readTerms([{ heading: '', items }]);
  assert.equal(terms('Válido hasta el 31/12/2026').validUntil, '2026-12-31');
  assert.equal(terms('válido hasta 31-12-2026').validUntil, '2026-12-31');
  assert.equal(terms('funciones hasta el 30 Abril 2026').validUntil, '2026-04-30');
  assert.equal(terms('hasta el 31 de marzo de 2027').validUntil, '2027-03-31');
  assert.equal(terms('Válido hasta el 30/06/2026', 'Otro: hasta el 31-12-2026').validUntil, '2026-12-31'); // la mas tardia
  assert.equal(terms('hasta agotar stock').validUntil, '');
  assert.equal(terms('Tope de descuento por transacción: $15.000').discountCap, '$15.000');
  assert.equal(terms('tope $4.990 dcto').discountCap, '$4.990');
  assert.equal(terms('Tope de 4 entradas por cliente').discountCap, ''); // no es un monto
});

test('cardText: quita el formato de la tarjeta', () => {
  assert.equal(parser.cardText('**30% descuento** \\n Todos los jueves'), '30% descuento · Todos los jueves');
  assert.equal(parser.cardText(''), '');
});
