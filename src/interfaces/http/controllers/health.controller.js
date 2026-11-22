// Salud del servicio. /health es el historico; /v1/health agrega el estado por emisor.

/**
 * @param {object} deps
 * @param {ReturnType<import('../../../providers').createProviderRegistry>} deps.registry
 * @param {ReturnType<import('../../../services/source-status').createSourceStatusTracker>} deps.statusTracker
 * @param {{ warmUp: Function }} deps.searchService
 * @param {object} deps.config
 * @param {string} deps.version
 * @param {() => number} [deps.uptime] segundos desde el inicio
 * @param {{ status: Function }|null} [deps.refreshScheduler] actualizacion programada (ADR 0024)
 * @param {() => number} [deps.cacheTtlSecondsNow] cuanto dura hoy un catalogo descargado ahora
 */
function createHealthController({
  registry,
  statusTracker,
  searchService,
  config,
  version,
  uptime,
  refreshScheduler = null,
  cacheTtlSecondsNow = () => config.cacheTtlSeconds,
}) {
  const getUptime = uptime || (() => Math.round(process.uptime()));
  const enabled = config.cacheTtlSeconds > 0;
  const NO_SCHEDULE = { enabled: false, time: null, timeZone: null, nextRunAt: null, lastRun: null };
  const schedule = () => (refreshScheduler ? refreshScheduler.status() : NO_SCHEDULE);

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
          cache: {
            enabled,
            // Ya no es fijo (ADR 0024): cuanto duraria un catalogo descargado ahora, hasta la
            // proxima actualizacion programada mas el margen. Se mantiene por compatibilidad.
            ttlSeconds: enabled ? cacheTtlSecondsNow() : 0,
            refreshMinAgeSeconds: config.cacheRefreshMinAgeSeconds,
            schedule: schedule(),
          },
          sources,
        },
      };
    },
  };
}

module.exports = { createHealthController };
