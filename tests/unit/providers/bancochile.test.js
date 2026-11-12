const { test } = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../../../src/providers/bancochile.parser');
const { provider } = require('../../../src/providers/bancochile.provider');
const { createTestContext } = require('../../helpers/provider-context');

const ITEM = {
  meta: {
    name: 'ProwashGo',
    slug: 'prowashgo',
    uuid: 'e1943550-d162-414f-b7c5-33b648dd27fd',
    tags: ['servicios', 'viernes'],
    category_name: 'Beneficios y Descuentos',
    unpublish_at: '2027-02-28T23:45:00.000-03:00',
  },
  fields: {
    Titulo: 'ProwashGo',
    Extracto: 'lunes a sábado online',
    Descripcion: '<p>Lavado de autos</p>\n<ul><li>20% dto.</li></ul>',
    Keywords: 'Autos; Lavados; Detailing',
    'Tipo Beneficio': '20%; dto.',
    Logo: { url: 'https://assets.bancochile.cl/logo-web-ProwashGo.jpg' },
  },
};

const page = (entries, totalPages = 1) =>
  JSON.stringify({ meta: { total_pages: totalPages }, entries });

test('parseBancoChileEntry normaliza los campos del CMS', () => {
  const entry = parser.parseBancoChileEntry(ITEM);
  assert.equal(entry.title, 'ProwashGo');
  assert.equal(entry.subtitle, '20% dto. - lunes a sábado online');
  assert.equal(entry.description, 'Lavado de autos 20% dto.');
  assert.equal(entry.url, 'https://sitiospublicos.bancochile.cl/personas/beneficios/detalle/prowashgo');
  assert.equal(entry.category, 'Beneficios y Descuentos');
  assert.equal(entry.validUntil, '2027-02-28');
  assert.equal(entry.keywords, 'Autos Lavados Detailing');
  assert.equal(entry.tagsText, 'servicios viernes');
  assert.equal(entry.logo, 'https://assets.bancochile.cl/logo-web-ProwashGo.jpg');
});

test('parseBancoChileEntry tolera campos vacios', () => {
  const entry = parser.parseBancoChileEntry({ meta: { name: 'Solo nombre' }, fields: {} });
  assert.equal(entry.title, 'Solo nombre');
  assert.equal(entry.subtitle, '');
  assert.equal(entry.validUntil, '');
  assert.equal(entry.url, 'https://sitiospublicos.bancochile.cl/personas/beneficios/todos-los-beneficios');
  assert.equal('logo' in entry, false);
});

test('parseBancoChilePage rechaza respuestas que no son el JSON esperado', () => {
  assert.throws(() => parser.parseBancoChilePage('<html>Incapsula</html>'), (err) => {
    assert.equal(err.code, 'INVALID_RESPONSE');
    assert.match(err.message, /^Banco de Chile devolvio una respuesta no JSON/);
    return true;
  });
  assert.throws(() => parser.parseBancoChilePage('{"error":1}'), /falta "entries"/);
});

test('el provider pagina la API via r.jina.ai pidiendo texto', async () => {
  const urls = [];
  const fetchImpl = async (url, init) => {
    urls.push([url, init.headers['x-return-format']]);
    const n = Number(new URL(url.replace('https://r.jina.ai/http://', 'https://')).searchParams.get('page'));
    return new Response(page([{ ...ITEM, meta: { ...ITEM.meta, uuid: `u${n}`, slug: `s${n}` } }], 3));
  };
  const ctx = createTestContext({ fetchImpl });
  const entries = await provider.fetch(ctx);

  assert.equal(entries.length, 3);
  assert.deepEqual(
    urls.map(([u]) => u),
    [1, 2, 3].map(
      (n) =>
        `https://r.jina.ai/http://sitiospublicos.bancochile.cl/api/content/spaces/personas/types/beneficios/entries?per_page=100&page=${n}`,
    ),
  );
  assert.ok(urls.every(([, format]) => format === 'text'));
  assert.deepEqual(ctx.pauses, [500, 500]); // pausa entre paginas, no despues de la ultima
});

test('envia JINA_API_KEY si esta configurada', async () => {
  let auth;
  const fetchImpl = async (url, init) => {
    auth = init.headers.authorization;
    return new Response(page([]));
  };
  await provider.fetch(createTestContext({ fetchImpl, env: { JINA_API_KEY: 'k' } }));
  assert.equal(auth, 'Bearer k');
});

test('reintenta los 429 de r.jina.ai respetando retry-after', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return new Response('', { status: 429, headers: { 'retry-after': '3' } });
    return new Response(page([ITEM]));
  };
  const ctx = createTestContext({ fetchImpl });
  assert.equal((await provider.fetch(ctx)).length, 1);
  assert.equal(ctx.pauses[0], 3000);
});

test('un error HTTP se informa con el mensaje historico', async () => {
  const fetchImpl = async () => new Response('caido', { status: 503 });
  await assert.rejects(provider.fetch(createTestContext({ fetchImpl })), /^.*Banco de Chile respondio 503: caido/);
});
