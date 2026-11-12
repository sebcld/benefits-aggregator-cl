// Tenpo: el logo de cada tarjeta sale de <img class="brand-partner"> del listado.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseTenpoPage } = require('../../../src/providers/tenpo.provider');
const { createFixtureApp } = require('../../helpers/fakes');
const fixture = require('../../fixtures/http/tenpo.json');

const card = ({ title, logo, href }) =>
  `<div role="listitem" class="beneficio-collection-item w-dyn-item"><div class="b-card-beneficios">` +
  `<div class="marca-partner div-block-17">` +
  (logo === null
    ? '<img alt="" loading="lazy" src="" class="brand-partner w-dyn-bind-empty"/>'
    : `<img alt="" loading="lazy" width="Auto" src="${logo}" class="brand-partner"/>`) +
  `</div><div class="titulo-beneficio b-titulo"><div class="titulo-beneficio-all">${title}</div></div>` +
  `<div class="texto-beneficio"><div class="p-text-beneficio-copy">Texto</div></div>` +
  `<a href="${href}" class="cta-beneficio w-button">Saber más</a></div></div>`;

test('usa la imagen brand-partner de la tarjeta como logo', () => {
  const [entry] = parseTenpoPage(card({ title: 'Extralife', logo: 'https://cdn.example.com/extralife.png', href: '/beneficios/extralife' }));
  assert.equal(entry.logo, 'https://cdn.example.com/extralife.png');
});

test('sin logo (src vacio, w-dyn-bind-empty) queda null y la web muestra las iniciales', () => {
  const [entry] = parseTenpoPage(card({ title: 'Sin logo', logo: null, href: '/beneficios/sin-logo' }));
  // Como en los demas emisores, el Entry no lleva logo y /v1 lo serializa como null.
  assert.equal(entry.logo ?? null, null);
});

test('cada tarjeta toma su propio logo, no el de la tarjeta anterior', () => {
  const html =
    card({ title: 'Con logo', logo: 'https://cdn.example.com/a.png', href: '/beneficios/a' }) +
    card({ title: 'Sin logo', logo: null, href: '/beneficios/b' });
  assert.deepEqual(
    parseTenpoPage(html).map((e) => [e.title, e.logo ?? null]),
    [
      ['Con logo', 'https://cdn.example.com/a.png'],
      ['Sin logo', null],
    ],
  );
});

test('decodifica entidades HTML en la URL del logo', () => {
  const [entry] = parseTenpoPage(card({ title: 'X', logo: 'https://cdn.example.com/a.png?w=1&amp;h=2', href: '/beneficios/x' }));
  assert.equal(entry.logo, 'https://cdn.example.com/a.png?w=1&h=2');
});

test('en las paginas reales grabadas, 30 de 48 beneficios traen logo', () => {
  const entries = fixture.records.flatMap((r) => parseTenpoPage(r.text || r.body || ''));
  assert.equal(entries.length, 48);
  assert.equal(entries.filter((e) => e.logo).length, 30);
  for (const e of entries.filter((x) => x.logo)) assert.match(e.logo, /^https:\/\/cdn\.prod\.website-files\.com\//);
});

test('buscar "extralife" devuelve el logo de Extralife (fixtures reales)', async () => {
  const app = createFixtureApp();
  const { matches } = await app.searchService.search('extralife', { banks: ['Tenpo'] });
  assert.ok(matches.length > 0, 'sin resultados para extralife');
  assert.match(matches[0].logo, /extralife\.png$/);
});
