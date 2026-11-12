const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEntry, toLegacyEntry, buildEntryId } = require('../../../src/domain/entry');
const { defineProvider, assertProvider } = require('../../../src/providers/provider.interface');
const { createProviderRegistry } = require('../../../src/providers');

test('createEntry conserva el orden de claves y agrega id y logo al final', () => {
  const entry = createEntry({ bank: 'X', title: 'T', url: 'u' }, { sourceId: 7, logo: 'l.png' });
  assert.deepEqual(Object.keys(entry), ['bank', 'title', 'url', 'id', 'logo']);
  assert.equal(entry.id, buildEntryId('X', 7));
});

test('createEntry sin sourceId deriva el id de url, slug y titulo', () => {
  const a = createEntry({ bank: 'Banco de Chile', title: 'T', url: 'u' });
  const b = createEntry({ bank: 'Banco de Chile', title: 'T', url: 'u' });
  assert.equal(a.id, b.id);
  assert.match(a.id, /^banco-de-chile-[0-9a-f]{12}$/);
  assert.equal('logo' in a, false);
});

test('createEntry valida bank y los campos de texto', () => {
  assert.throws(() => createEntry({ title: 'x' }), /bank/);
  assert.throws(() => createEntry({ bank: 'X', title: 'x', slug: 12 }), /slug/);
});

test('toLegacyEntry quita id y logo', () => {
  const entry = createEntry({ bank: 'X', title: 'T' }, { sourceId: 1, logo: 'l' });
  assert.deepEqual(toLegacyEntry(entry), { bank: 'X', title: 'T' });
});

test('defineProvider valida el contrato', () => {
  assert.throws(() => defineProvider({ key: 'Mal Key', name: 'X', fetch() {} }), /kebab-case/);
  assert.throws(() => defineProvider({ key: 'x', name: 'X' }), /fetch/);
  const p = defineProvider({ key: 'x', name: 'X', fetch: async () => [] });
  assert.equal(p.queryDependent, false);
  assert.ok(Object.isFrozen(p));
  assert.equal(assertProvider(p), p);
});

test('el registro trae los 7 emisores en el orden historico', () => {
  const names = createProviderRegistry().list().map((p) => p.name);
  assert.deepEqual(names, [
    'Santander',
    'BCI',
    'Tenpo',
    'Tapp',
    'Copec Pay',
    'Banco de Chile',
    'Mercado Pago',
  ]);
});

test('select filtra por nombre sin distinguir mayusculas y conserva el orden', () => {
  const registry = createProviderRegistry();
  const keys = (list) => list.map((p) => p.key);
  assert.deepEqual(keys(registry.select(['copec pay', 'BCI'])), ['bci', 'copec']);
  assert.deepEqual(keys(registry.select(['copec'])), []);
  assert.deepEqual(keys(registry.select(['copec'], { allowKeys: true })), ['copec']);
  assert.equal(registry.select([]).length, 7);
});

test('el registro rechaza duplicados', () => {
  const p = defineProvider({ key: 'x', name: 'X', fetch: async () => [] });
  assert.throws(() => createProviderRegistry([p, p]), /duplicado/);
});
