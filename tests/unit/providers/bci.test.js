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
