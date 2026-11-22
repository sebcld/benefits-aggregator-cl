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
  const { searchService, registry, statusTracker, config, clock, refreshScheduler, cacheTtlSecondsNow } = app;
  const search = createSearchController({ searchService, registry, clock });
  const health = createHealthController({
    registry,
    statusTracker,
    searchService,
    config,
    version,
    refreshScheduler,
    cacheTtlSecondsNow,
  });
  const banks = createBanksController({ registry });

  // Todas las rutas exigen API key (si API_KEYS esta configurada), salvo las "public": solo
  // GET /health, que responde { status: "ok" } sin datos, para los health checks de las plataformas.
  return [
    // Legadas (formato historico)
    { method: 'GET', path: '/health', api: 'legacy', handler: health.legacy, public: true },
    { method: 'GET', path: '/search', api: 'legacy', handler: search.legacyGet },
    { method: 'POST', path: '/search', api: 'legacy', handler: search.legacyPost },

    // v1 (contrato en docs/openapi.yaml)
    { method: 'GET', path: '/v1/health', api: 'v1', handler: health.v1 },
    { method: 'GET', path: '/v1/banks', api: 'v1', handler: banks.list },
    { method: 'GET', path: '/v1/search', api: 'v1', handler: search.v1Get },
    { method: 'POST', path: '/v1/search', api: 'v1', handler: search.v1Post },
    { method: 'GET', path: '/v1/benefits', api: 'v1', handler: search.v1ListAll },
  ];
}

module.exports = { createRoutes };
