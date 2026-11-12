const { QUERIES, ACCEPTANCE_CASES } = require('./constants');

// Busquedas de caracterizacion: [nombre, query, opciones].
const SEARCH_CASES = [
  ...QUERIES.map((q) => [q, q, {}]),
  ['rappi en Copec Pay y BCI', 'rappi', { banks: ['copec pay', 'BCI'] }],
  ['cine en Banco de Chile', 'cine', { banks: ['Banco de Chile'] }],
  ['banco inexistente', 'rappi', { banks: ['NoExiste'] }],
  ['sin tildes ni mayusculas', 'EL CAFE ROSA', {}],
  ...ACCEPTANCE_CASES.map(([bank, q]) => [`${bank}: ${q}`, q, { banks: [bank] }]),
];

// Peticiones a la API legada (rutas sin version).
const LEGACY_HTTP_CASES = [
  ['health', { path: '/health' }],
  ['GET search rappi', { path: '/search?q=Rappi' }],
  ['GET search kfc con banks', { path: '/search?q=kfc&banks=Banco%20de%20Chile,BCI' }],
  ['GET search PROWASHGO', { path: '/search?q=PROWASHGO&banks=Banco%20de%20Chile' }],
  ['GET search sin q', { path: '/search' }],
  ['GET search q vacio', { path: '/search?q=%20%20' }],
  [
    'POST search El Cafe Rosa',
    {
      method: 'POST',
      path: '/search',
      body: JSON.stringify({ query: 'El Café Rosa', banks: ['Copec Pay'] }),
      headers: { 'content-type': 'application/json' },
    },
  ],
  [
    'POST search banks como texto',
    {
      method: 'POST',
      path: '/search',
      body: JSON.stringify({ query: 'burger king', banks: 'Santander,BCI' }),
    },
  ],
  ['POST search sin query', { method: 'POST', path: '/search', body: '{}' }],
  ['POST search sin body', { method: 'POST', path: '/search' }],
  ['POST search JSON invalido', { method: 'POST', path: '/search', body: '{malo' }],
  ['POST search body arreglo', { method: 'POST', path: '/search', body: '[1,2]' }],
  ['POST search body null', { method: 'POST', path: '/search', body: 'null' }],
  ['POST search query numerica', { method: 'POST', path: '/search', body: '{"query":5}' }],
  ['ruta inexistente', { path: '/nada' }],
  ['metodo no soportado', { method: 'DELETE', path: '/search' }],
  ['prefijo de search', { path: '/searchXYZ?q=rappi' }],
  ['prefijo de health', { path: '/healthcheck' }],
];

module.exports = { SEARCH_CASES, LEGACY_HTTP_CASES };
