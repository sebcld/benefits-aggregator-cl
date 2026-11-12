// Tabla de rutas. Las rutas sin version se mantienen por compatibilidad; las nuevas van en /v1.
const { createSearchController } = require('./controllers/search.controller');
const { createHealthController } = require('./controllers/health.controller');
const { createBanksController } = require('./controllers/banks.controller');

/**
 * @param {object} deps
 * @param {ReturnType<import('../../bootstrap').createApp>} deps.app
 * @param {string} deps.version
 * @returns {import('./router').Route[]}
 */
function createRoutes({ app, version }) {
  const { searchService, registry, statusTracker, config, clock } = app;
  const search = createSearchController({ searchService, registry, clock });
  const health = createHealthController({ registry, statusTracker, searchService, config, version });
  const banks = createBanksController({ registry });

  return [
    // Legadas (formato historico)
    { method: 'GET', path: '/health', api: 'legacy', handler: health.legacy },
    { method: 'GET', path: '/search', api: 'legacy', handler: search.legacyGet },
    { method: 'POST', path: '/search', api: 'legacy', handler: search.legacyPost },

    // v1 (contrato en docs/openapi.yaml)
    { method: 'GET', path: '/v1/health', api: 'v1', handler: health.v1 },
    { method: 'GET', path: '/v1/banks', api: 'v1', handler: banks.list },
    { method: 'GET', path: '/v1/search', api: 'v1', handler: search.v1Get },
    { method: 'POST', path: '/v1/search', api: 'v1', handler: search.v1Post },
  ];
}

module.exports = { createRoutes };
