// Caracterizacion de matchesQuery: reglas de coincidencia del buscador original.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matchesQuery, truncate } = require('../../src/benefits');

const entry = (fields) => ({ bank: 'X', title: '', ...fields });

const CASES = [
  // [descripcion, entry, query, esperado]
  ['ignora mayusculas', entry({ title: 'Rappi' }), 'RAPPI', true],
  ['ignora tildes', entry({ title: 'El Café Rosa' }), 'el cafe rosa', true],
  ['tildes en la consulta', entry({ title: 'El Cafe Rosa' }), 'El Café Rosa', true],
  ['busca en commerceName', entry({ title: 'Promo', commerceName: 'Burger King' }), 'burger king', true],
  ['busca en keywords', entry({ keywords: 'kfc dunkin' }), 'kfc', true],
  ['busca en tagsText', entry({ tagsText: 'Delivery' }), 'delivery', true],
  ['busca en slug', entry({ slug: 'pizza-hut-online' }), 'pizza hut', true],
  ['busca en subtitle', entry({ subtitle: 'Descuento en Rappi' }), 'rappi', true],
  ['busca en description', entry({ description: '<p>Usa tu tarjeta en Rappi</p>' }), 'rappi', true],
  ['no busca en category', entry({ category: 'Restaurante' }), 'restaurante', false],
  ['palabra corta exige palabra completa', entry({ title: 'Bcicomercio' }), 'bci', false],
  ['palabra corta completa', entry({ title: 'Combo KFC' }), 'kfc', true],
  ['palabra de 4 letras exige limite', entry({ title: 'Cinemark' }), 'cine', false],
  ['palabra larga como substring compacto', entry({ title: 'Superrappimarket' }), 'rappi', true],
  ['varias palabras sin espacios', entry({ title: 'BurgerKing' }), 'burger king', true],
  ['consulta compacta contra texto con espacios', entry({ title: 'Burger King' }), 'burgerking', true],
  ['apostrofes se ignoran', entry({ title: "Wendy's" }), 'wendys', true],
  ['entidades HTML', entry({ title: 'Caf&eacute; &amp; Co' }), 'co', true],
  ['sin coincidencia', entry({ title: 'Santander Life' }), 'rappi', false],
  ['consulta solo puntuacion', entry({ title: 'Algo' }), '!!!', false],
];

for (const [name, item, query, expected] of CASES) {
  test(`matchesQuery: ${name}`, () => {
    assert.equal(matchesQuery(item, query), expected);
  });
}

test('truncate corta a 180 con puntos suspensivos', () => {
  const long = 'a'.repeat(200);
  assert.equal(truncate(long), `${'a'.repeat(177)}...`);
  assert.equal(truncate('corto'), 'corto');
  assert.equal(truncate('abcdef', 5), 'ab...');
});
