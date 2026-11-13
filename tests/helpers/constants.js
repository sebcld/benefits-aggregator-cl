const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES_DIR = path.join(ROOT, 'tests', 'fixtures');
const HTTP_FIXTURES_DIR = path.join(FIXTURES_DIR, 'http');
const GOLDEN_DIR = path.join(FIXTURES_DIR, 'golden');

// Instante en que se grabaron los fixtures (12:00 en Chile). Copec Pay filtra por vigencia.
const FIXED_NOW = '2026-11-12T15:00:00.000Z';

// Casos de prueba de caracterizacion pedidos en el brief.
const QUERIES = ['Rappi', 'El Café Rosa', 'burger king', 'kfc'];

// Casos de aceptacion por emisor: [emisor, consulta, titulo esperado (regex)].
// Cada consulta debe encontrar ese beneficio en ese emisor.
const ACCEPTANCE_CASES = [
  ['Banco de Chile', 'PROWASHGO', /^ProwashGo$/],
  ['Tenpo', 'temu', /Temu/],
  ['BCI', 'pedidos ya', /PedidosYa/],
  ['Santander', 'burger king', /^Burger King$/],
  ['Mercado Pago', 'turbus', /^Turbus$/],
  ['Copec Pay', 'Rappi', /^Rappi$/],
  ['Copec Pay', 'El Café Rosa', /^El Café Rosa$/],
];

// Todas las consultas de los golden (las de caracterizacion mas las de aceptacion).
const ALL_QUERIES = [...new Set([...QUERIES, ...ACCEPTANCE_CASES.map(([, q]) => q)])];

// Variables de entorno de los tests: no dependen del .env local.
const TEST_ENV = {
  BCI_SUBSCRIPTION_KEY: 'test-key',
  MELI_ACCESS_TOKEN: '',
  MERCADOPAGO_TOKEN: '',
  LOG_LEVEL: 'silent',
};

// Golden generado con el codigo original (commit f8352c7), antes del refactor y del cambio de
// fuente de Banco de Chile. Se conserva para demostrar la equivalencia del resto de emisores.
const ORIGINAL_GOLDEN_DIR = path.join(FIXTURES_DIR, 'golden-original');

module.exports = {
  ROOT,
  FIXTURES_DIR,
  HTTP_FIXTURES_DIR,
  GOLDEN_DIR,
  ORIGINAL_GOLDEN_DIR,
  FIXED_NOW,
  QUERIES,
  ACCEPTANCE_CASES,
  ALL_QUERIES,
  TEST_ENV,
};
