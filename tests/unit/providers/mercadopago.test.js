// Mercado Pago: beneficios de la Tarjeta Mercado Pago desde la landing de la tarjeta prepago.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { provider, buildMercadoPagoEntry, LIST_URL } = require('../../../src/providers/mercadopago.provider');
const parser = require('../../../src/providers/mercadopago.parser');
const { createTestContext } = require('../../helpers/provider-context');
const { createFixtureApp } = require('../../helpers/fakes');
const { toV1Benefit } = require('../../../src/interfaces/http/serializers');

const fetchAll = () => provider.fetch(createTestContext());
const byUrl = (entries, slug) => entries.find((e) => e.url.endsWith(`/landing/${slug}`));

test('extrae los 7 beneficios activos de la landing (fixtures reales)', async () => {
  const entries = await fetchAll();
  assert.deepEqual(
    entries.map((e) => e.title),
    ['RappiPro', 'Turbus', 'Lipigas', 'Lipigas', 'Gasconnect', 'Gasconnect', 'Cabify'],
  );
  // Ids distintos aunque el comercio se repita (Lipigas y Gasconnect tienen dos beneficios cada uno).
  assert.equal(new Set(entries.map((e) => e.id)).size, 7);
});

test('titulo, descripcion, descuento, tope, condiciones, tarjeta y vigencia (Turbus)', async () => {
  const turbus = byUrl(await fetchAll(), 'turbus-fisica');
  assert.equal(turbus.title, 'Turbus');
  assert.equal(turbus.subtitle, 'Disfruta 15% de cashback pagando por primera vez en tótems');
  assert.equal(turbus.description, 'Exclusivo para primera compra física en tótems de Turbus con la tarjeta Mercado Pago. Tope de descuento: $5.000.');
  assert.equal(turbus.cardType, 'Tarjeta prepago física');
  assert.equal(turbus.discountCap, '$5.000');
  assert.equal(turbus.validFrom, '2025-09-25');
  assert.equal(turbus.validUntil, '2027-03-31');
  assert.equal(turbus.category, 'Viajes');
  assert.equal(turbus.termsUrl, 'https://api.mercadopago.com/v2/discounts/campaign/13022039/terms/html');
  assert.match(turbus.logo, /^https:\/\/http2\.mlstatic\.com\//);
  assert.match(turbus.keywords, /15% OFF presencial/);
});

test('tipo de tarjeta: fisica o virtual segun la tarjeta de la lista y los terminos', async () => {
  const entries = await fetchAll();
  assert.equal(byUrl(entries, 'turbus-fisica').cardType, 'Tarjeta prepago física');
  for (const slug of ['rappi-pro', 'lipigas-nuevos', 'lipigas', 'gasco', 'gasconnect', 'mastercard-cabify']) {
    assert.equal(byUrl(entries, slug).cardType, 'Tarjeta prepago virtual', slug);
  }
});

test('tope de descuento o devolucion cuando los terminos lo dan en pesos', async () => {
  const entries = await fetchAll();
  assert.equal(byUrl(entries, 'gasco').discountCap, '$10.000');
  assert.match(byUrl(entries, 'gasco').description, /Tope de devolución: \$10\.000\.$/);
  // "El tope de descuento es el correspondiente a dos cargas": sin monto, no se inventa uno.
  assert.equal(byUrl(entries, 'lipigas').discountCap, '');
});

test('una vigencia ya vencida no se publica (la landing sigue mostrando el beneficio)', async () => {
  // Lipigas primera compra: los terminos dicen 09/03/2026 al 31/07/2026; hoy (fijo) es 2026-11-12.
  const lipigas = byUrl(await fetchAll(), 'lipigas-nuevos');
  assert.equal(lipigas.validUntil, '');
  assert.equal(lipigas.validFrom, '');
});

test('Cabify: sin terminos de campana (enlaza a mastercard.cl), igual se publica con los datos de la lista', async () => {
  const cabify = byUrl(await fetchAll(), 'mastercard-cabify');
  assert.equal(cabify.subtitle, 'Disfruta de 3 pasajes con 50% off');
  assert.match(cabify.termsUrl, /^https:\/\/www\.mastercard\.cl\//);
  assert.equal(cabify.category, ''); // la landing le pone el filtro "pill", que no es una categoria
});

test('si falla el detalle de un beneficio, se devuelve igual con los datos de la lista', async () => {
  const real = createTestContext().fetchImpl;
  const fetchImpl = async (url, init) => (url.endsWith('/landing/turbus-fisica') ? new Response('', { status: 500 }) : real(url, init));
  const entries = await provider.fetch(createTestContext({ fetchImpl }));
  const turbus = byUrl(entries, 'turbus-fisica');
  assert.equal(entries.length, 7);
  assert.equal(turbus.description, 'Disfruta 15% de cashback pagando por primera vez en tótems');
  assert.equal(turbus.cardType, 'Tarjeta prepago física');
  assert.equal(turbus.termsUrl, '');
});

test('si la lista no trae el estado incrustado, falla con INVALID_RESPONSE', async () => {
  const fetchImpl = async () => new Response('<html>sin estado</html>', { status: 200 });
  await assert.rejects(provider.fetch(createTestContext({ fetchImpl })), (err) => err.code === 'INVALID_RESPONSE');
});

test('pide la landing con un user-agent de navegador', async () => {
  const ctx = createTestContext();
  await provider.fetch(ctx);
  assert.equal(ctx.fetchImpl.calls[0].url, LIST_URL);
  assert.match(ctx.fetchImpl.calls[0].headers['user-agent'], /^Mozilla\/5\.0 .*Chrome/);
});

test('buscar "rappi", "turbus" y "cabify" encuentra los beneficios de Mercado Pago (fixtures reales)', async () => {
  const app = createFixtureApp();
  for (const [query, title] of [['rappi', 'RappiPro'], ['turbus', 'Turbus'], ['cabify', 'Cabify'], ['lipigas', 'Lipigas']]) {
    const { matches, errors } = await app.searchService.search(query, { banks: ['Mercado Pago'] });
    assert.deepEqual(errors, []);
    assert.ok(matches.some((m) => m.title === title), `${query} -> ${matches.map((m) => m.title)}`);
  }
});

test('la API v1 expone tarjeta, tope y terminos; la forma 1.x no', async () => {
  const turbus = byUrl(await fetchAll(), 'turbus-fisica');
  const v1 = toV1Benefit(turbus, () => 'mercadopago');
  assert.equal(v1.cardType, 'Tarjeta prepago física');
  assert.equal(v1.discountCap, '$5.000');
  const { toLegacyEntry } = require('../../../src/domain/entry');
  const legacy = toLegacyEntry(turbus);
  for (const field of ['cardType', 'discountCap', 'termsUrl', 'id', 'logo']) assert.equal(field in legacy, false, field);
});

test('parser: estado de Nordic con u, referencias @N y fechas D"..."', () => {
  assert.deepEqual(parser.nordicToJson('{"a":u,"b":@3,"c":D"2026-11-12T00:00:00Z","d":"u @1 D\\"x\\"","e":[u,1]}'), {
    a: null,
    b: null,
    c: '2026-11-12T00:00:00Z',
    d: 'u @1 D"x"',
    e: [null, 1],
  });
});

test('parser: vigencia y tope en los dos formatos de los terminos', () => {
  const a = parser.parseTerms('Beneficio válido (i) desde el 25/09/2025 hasta el 31/03/2027, ambas fechas. El tope de descuento es de hasta CLP $5.000.');
  assert.deepEqual([a.validFrom, a.validUntil, a.cap], ['2025-09-25', '2027-03-31', { kind: 'descuento', amount: '$5.000' }]);
  const b = parser.parseTerms('válido (i) del 21/01/2026 00:00 al 31/12/2026 23:59. El límite de devolución es de $ 10.000 por Usuario.');
  assert.deepEqual([b.validFrom, b.validUntil, b.cap], ['2026-01-21', '2026-12-31', { kind: 'devolución', amount: '$10.000' }]);
});

test('parser: etiqueta de tarjeta', () => {
  assert.equal(parser.cardTypeLabel('TARJETA física', null), 'Tarjeta prepago física');
  assert.equal(parser.cardTypeLabel('Tarjeta virtual', null), 'Tarjeta prepago virtual');
  assert.equal(parser.cardTypeLabel('TARJETA VIRTUAL', { physical: true }), 'Tarjeta prepago física y virtual');
  assert.equal(parser.cardTypeLabel('', null), 'Tarjeta prepago Mercado Pago');
});

test('buildMercadoPagoEntry funciona solo con los datos de la lista', () => {
  const card = { title: 'X', description: 'Disfruta 10% en X', highlight: 'Tarjeta virtual', category: 'Otros', image: '', url: 'https://www.mercadopago.cl/landing/x' };
  const entry = buildMercadoPagoEntry({ card, today: '2026-11-12' });
  assert.equal(entry.description, 'Disfruta 10% en X');
  assert.equal(entry.cardType, 'Tarjeta prepago virtual');
  assert.equal(entry.slug, 'x');
});
