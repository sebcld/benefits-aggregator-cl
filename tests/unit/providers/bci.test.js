// BCI: el titulo es el comercio y el link va a la ficha del beneficio en bci.cl.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseBciOffer, bciDetailUrl } = require('../../../src/providers/bci.provider');
const { createFixtureApp } = require('../../helpers/fakes');

// Las dos ofertas reales de Ansaldo (tests/fixtures/http/bci.json), reducidas a lo que se usa.
const ANSALDO_PRESENCIAL = {
  id: 'ansaldo-presencial',
  titulo: 'Tienda presencial - Juguetes y artículos de regalo para el hogar.',
  subtitulo: '  ',
  descripcion: 'Obtén cashback comprando en tienda.',
  comercio: { id: 'c1', nombre: 'Ansaldo' },
  slug: 'tienda-presencial-juguetes-y-articulos-de-regalo-para-el-hogar.-ba5pkwj',
  link: 'https://www.ansaldo.cl/',
  tags: [{ nombre: 'Presencial' }],
};

test('el titulo es el comercio y la bajada es el titulo de la oferta', () => {
  const entry = parseBciOffer(ANSALDO_PRESENCIAL);
  assert.equal(entry.title, 'Ansaldo');
  assert.equal(entry.subtitle, 'Tienda presencial - Juguetes y artículos de regalo para el hogar.');
  assert.equal(entry.commerceName, 'Ansaldo');
});

test('el link es la ficha del beneficio en bci.cl, no el sitio del comercio', () => {
  const entry = parseBciOffer(ANSALDO_PRESENCIAL);
  assert.equal(
    entry.url,
    'https://www.bci.cl/beneficios/beneficios-bci/detalle/tienda-presencial-juguetes-y-articulos-de-regalo-para-el-hogar.-ba5pkwj',
  );
});

test('la condicion de tarjeta (subtitulo) pasa al inicio de la descripcion', () => {
  const entry = parseBciOffer({ ...ANSALDO_PRESENCIAL, subtitulo: 'Exclusivo con tus tarjetas de Crédito Bci.' });
  assert.equal(entry.description, 'Exclusivo con tus tarjetas de Crédito Bci. Obtén cashback comprando en tienda.');
  // Sin condicion, la descripcion queda igual.
  assert.equal(parseBciOffer(ANSALDO_PRESENCIAL).description, 'Obtén cashback comprando en tienda.');
});

test('sin comercio, se mantiene el formato anterior (titulo y subtitulo de la oferta)', () => {
  const entry = parseBciOffer({ ...ANSALDO_PRESENCIAL, comercio: null, subtitulo: 'Exclusivo con tus tarjetas de Crédito Bci.' });
  assert.equal(entry.title, 'Tienda presencial - Juguetes y artículos de regalo para el hogar.');
  assert.equal(entry.subtitle, 'Exclusivo con tus tarjetas de Crédito Bci.');
  assert.equal(entry.description, 'Obtén cashback comprando en tienda.');
});

test('sin slug, usa el link de la oferta y, si tampoco hay, el listado de beneficios', () => {
  assert.equal(parseBciOffer({ ...ANSALDO_PRESENCIAL, slug: '' }).url, 'https://www.ansaldo.cl/');
  assert.equal(parseBciOffer({ ...ANSALDO_PRESENCIAL, slug: '', link: '' }).url, 'https://www.bci.cl/beneficios/beneficios-bci');
});

// Oferta real de Starbucks (API de BCI, 2026-11-13), reducida a lo que se usa.
const STARBUCKS_LUNES = {
  id: '696e40f03a6fc962b4775638',
  titulo: 'Tu café favorito y el momento perfecto para recargar tu dia.',
  subtitulo: 'Tarjetas de crédito o débito',
  descripcion: '30% de dcto todos los días lunes de 2026 en bebidas preparadas en barra en tiendas Starbucks.',
  fechaInicio: '2026-01-01T03:00:00.000Z',
  fechaTermino: '2027-01-01T02:59:00.000Z',
  tieneFechaTermino: true,
  slug: 'tu-cafe-favorito-y-el-momento-perfecto-para-recargar-tu-dia.-8nywci7',
  comercio: { nombre: 'Starbucks' },
  tags: [{ nombre: 'Lunes' }, { nombre: 'Descuentos' }, { nombre: 'cafe' }],
  beneficio: { discount: { porcentajeDescuento: 30 } },
  deal: { discount: { percentage: 30 } },
  scheduling: { isRecurrent: true, dayRecurrence: ['LUNES'], recurrenceLabel: 'Todos los lunes' },
};
const TODAY = '2026-11-13';

test('Starbucks: descuento, vigencia en hora de Chile y dias, desde los datos estructurados', () => {
  const entry = parseBciOffer(STARBUCKS_LUNES, { today: TODAY });
  assert.equal(entry.discount, '30%');
  assert.equal(entry.discountCap, '');
  // 2026-01-01T03:00Z es el 1 de enero a las 00:00 en Chile; 2027-01-01T02:59Z, el 31-12 a las 23:59.
  assert.equal(entry.validFrom, '2026-01-01');
  assert.equal(entry.validUntil, '2026-12-31');
  assert.equal(entry.schedule, 'Todos los lunes');
});

test('cashback: el porcentaje viene como fraccion y trae su tope', () => {
  const copec = parseBciOffer(
    { ...STARBUCKS_LUNES, deal: { cashback: { percentage: 0.07, tope: 7000 } }, beneficio: {} },
    { today: TODAY },
  );
  assert.equal(copec.discount, '7% cashback');
  assert.equal(copec.discountCap, '$7.000');
});

test('sin un porcentaje util (0 o ausente) no hay discount: la web lo busca en el texto', () => {
  const zero = { ...STARBUCKS_LUNES, deal: { discount: { percentage: 0 } }, beneficio: { discount: { porcentajeDescuento: 0 } } };
  assert.equal(parseBciOffer(zero).discount, '');
  assert.equal(parseBciOffer({ ...STARBUCKS_LUNES, deal: undefined, beneficio: undefined }).discount, '');
});

test('vigencia: sin fecha de termino, vencida o con termino a medianoche exacta', () => {
  assert.equal(parseBciOffer({ ...STARBUCKS_LUNES, tieneFechaTermino: false }, { today: TODAY }).validUntil, '');
  const expired = parseBciOffer({ ...STARBUCKS_LUNES, fechaTermino: '2026-11-01T02:59:00.000Z' }, { today: TODAY });
  assert.deepEqual([expired.validFrom, expired.validUntil], ['', '']);
  // 04:00Z en invierno (UTC-4) es la medianoche del 1 de julio: el ultimo dia es el 30 de junio.
  assert.equal(parseBciOffer({ ...STARBUCKS_LUNES, fechaTermino: '2027-07-01T04:00:00.000Z' }).validUntil, '2027-06-30');
  assert.equal(parseBciOffer({ ...STARBUCKS_LUNES, fechaTermino: 'no-es-fecha' }).validUntil, '');
});

test('dias: varios, todos, o ninguno si la oferta no es recurrente', () => {
  const days = (dayRecurrence, isRecurrent = true) =>
    parseBciOffer({ ...STARBUCKS_LUNES, scheduling: { isRecurrent, dayRecurrence } }).schedule;
  assert.equal(days(['JUEVES', 'MARTES', 'MIERCOLES']), 'Martes, miércoles y jueves');
  assert.equal(days(['SABADO']), 'Todos los sábados');
  assert.equal(days(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']), 'Todos los días');
  assert.equal(days([], false), '');
  assert.equal(parseBciOffer({ ...STARBUCKS_LUNES, scheduling: undefined }).schedule, '');
});

test('la API v1 expone discount y schedule; la forma 1.x no', () => {
  const { toV1Benefit } = require('../../../src/interfaces/http/serializers');
  const { toLegacyEntry } = require('../../../src/domain/entry');
  const entry = parseBciOffer(STARBUCKS_LUNES, { today: TODAY });
  const v1 = toV1Benefit(entry, () => 'bci');
  assert.equal(v1.discount, '30%');
  assert.equal(v1.schedule, 'Todos los lunes');
  assert.equal(v1.validUntil, '2026-12-31');
  const legacy = toLegacyEntry(entry);
  assert.equal('discount' in legacy || 'schedule' in legacy, false);
});

test('fixtures reales: la mayoria de las ofertas trae descuento, vigencia y dias', async () => {
  const { provider } = require('../../../src/providers/bci.provider');
  const { createTestContext } = require('../../helpers/provider-context');
  const entries = await provider.fetch(createTestContext());
  const count = (field) => entries.filter((e) => e[field]).length;
  assert.equal(entries.length, 326);
  assert.ok(count('discount') >= 280, `discount: ${count('discount')}`);
  assert.ok(count('validUntil') >= 320, `validUntil: ${count('validUntil')}`);
  assert.ok(count('schedule') >= 200, `schedule: ${count('schedule')}`);
});

test('bciDetailUrl codifica el slug', () => {
  assert.equal(bciDetailUrl('a b'), 'https://www.bci.cl/beneficios/beneficios-bci/detalle/a%20b');
});

test('buscar "ansaldo" muestra Ansaldo y la ficha de cada oferta en bci.cl (fixtures reales)', async () => {
  const app = createFixtureApp();
  const { matches, errors } = await app.searchService.search('ansaldo', { banks: ['BCI'] });
  assert.deepEqual(errors, []);
  assert.deepEqual(
    matches.map((m) => [m.title, m.subtitle, m.url]),
    [
      [
        'Ansaldo',
        'Tienda presencial - Juguetes y artículos de regalo para el hogar.',
        'https://www.bci.cl/beneficios/beneficios-bci/detalle/tienda-presencial-juguetes-y-articulos-de-regalo-para-el-hogar.-ba5pkwj',
      ],
      [
        'Ansaldo',
        'Juguetes y artículos de regalo para el hogar.',
        'https://www.bci.cl/beneficios/beneficios-bci/detalle/juguetes-y-articulos-de-regalo-para-el-hogar.-caelmb',
      ],
    ],
  );
});
