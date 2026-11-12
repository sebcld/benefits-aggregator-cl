// Salud del servicio. /health es el historico; /v1/health agrega el estado por emisor.

/**
 * @param {object} deps
 * @param {ReturnType<import('../../../providers').createProviderRegistry>} deps.registry
 * @param {ReturnType<import('../../../services/source-status').createSourceStatusTracker>} deps.statusTracker
 * @param {{ warmUp: Function }} deps.searchService
 * @param {object} deps.config
 * @param {string} deps.version
 * @param {() => number} [deps.uptime] segundos desde el inicio
 */
function createHealthController({ registry, statusTracker, searchService, config, version, uptime }) {
  const getUptime = uptime || (() => Math.round(process.uptime()));

  return {
    // GET /health -> { status: "ok" } (sin cambios)
    legacy: async () => ({ status: 200, body: { status: 'ok' } }),

    // GET /v1/health[?probe=true]. Responde 200 aunque haya emisores caidos (el proceso esta
    // vivo); "status" es "degraded" si alguno fallo o llego vacio en su ultima consulta.
    v1: async ({ url }) => {
      if (url.searchParams.get('probe') === 'true') await searchService.warmUp();

      const sources = statusTracker.snapshot(registry.list());
      const degraded = sources.some((s) => s.status === 'error' || s.status === 'empty');

      return {
        status: 200,
        body: {
          status: degraded ? 'degraded' : 'ok',
          version,
          uptimeSeconds: getUptime(),
          cache: { enabled: config.cacheTtlSeconds > 0, ttlSeconds: config.cacheTtlSeconds },
          sources,
        },
      };
    },
  };
}

module.exports = { createHealthController };
