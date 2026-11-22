const fs = require('fs');
const path = require('path');
const { parseEnvContent } = require('../../src/config/env-file');

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
  ['Entel', 'dunkin', /^Dunkin$/],
  ['Copec Pay', 'Rappi', /^Rappi$/],
  ['Copec Pay', 'El Café Rosa', /^El Café Rosa$/],
];

// Todas las consultas de los golden (las de caracterizacion mas las de aceptacion).
const ALL_QUERIES = [...new Set([...QUERIES, ...ACCEPTANCE_CASES.map(([, q]) => q)])];

// Variables de entorno de los tests: NO dependen del .env local. Los procesos hijo (CLI y
// servidor) leen el .env de la raiz, y las variables del entorno tienen prioridad sobre el, asi
// que se fija CADA variable de .env.example a su valor documentado (o vacio = por defecto). Sin
// esto, un API_KEYS en el .env local hacia que el servidor de los tests respondiera 401. Una
// variable nueva queda cubierta sola al agregarla a .env.example.
const EXAMPLE_ENV = parseEnvContent(fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8'));
const TEST_ENV = {
  ...EXAMPLE_ENV,
  BCI_SUBSCRIPTION_KEY: 'test-key',
  LOG_LEVEL: 'silent',
  // Sin actualizacion programada ni carga inicial en los tests: preload.js congela el reloj y
  // vuelve inmediatos los timers de 100 ms o mas, asi que un scheduler en un proceso hijo se
  // reprogramaria sin fin. Los tests del scheduler usan timers y reloj inyectados.
  REFRESH_TIME: 'off',
  CACHE_WARMUP: 'false',
};

module.exports = {
  ROOT,
  FIXTURES_DIR,
  HTTP_FIXTURES_DIR,
  GOLDEN_DIR,
  FIXED_NOW,
  QUERIES,
  ACCEPTANCE_CASES,
  ALL_QUERIES,
  TEST_ENV,
};
