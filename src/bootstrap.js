// Composition root: el unico lugar que arma las dependencias concretas. Interfaces (CLI, HTTP)
// y la fachada legada piden una "app" aqui; los tests inyectan fetch, reloj, pausas y cache.
const { loadConfig } = require('./config');
const { createLogger } = require('./shared/logger');
const { createHttpClient } = require('./shared/http-client');
const { sleep: defaultSleep } = require('./shared/async');
const { createProviderRegistry } = require('./providers');
const { createProviderRunner } = require('./services/provider-runner');
const { createSourceStatusTracker } = require('./services/source-status');
const { createSearchService } = require('./services/search-service');
const { createRefreshScheduler } = require('./services/refresh-scheduler');
const { createMemoryCacheStore } = require('./shared/cache/memory-cache-store');
const { assertCacheStore } = require('./shared/cache/cache-store');
const { CHILE_TIME_ZONE, nextDailyAt } = require('./shared/dates');

// Margen despues de la hora programada (ADR 0024): un catalogo vence 1 h despues de la proxima
// actualizacion. Si esa actualizacion falla para un emisor, su catalogo anterior se sigue usando
// mientras tanto, y al vencer, la siguiente busqueda vuelve a intentar la descarga.
const SCHEDULE_GRACE_MS = 60 * 60 * 1000;
// Sin actualizacion programada (REFRESH_TIME=off), un catalogo dura 24 h.
const UNSCHEDULED_TTL_MS = 24 * 60 * 60 * 1000;

// undefined = cache en memoria salvo CACHE_TTL_SECONDS=0; null = sin cache; objeto = ese CacheStore.
function resolveCache(option, config, clock) {
  if (option === null) return null;
  if (option !== undefined) return assertCacheStore(option);
  return config.cacheTtlSeconds > 0 ? createMemoryCacheStore({ now: () => clock().getTime() }) : null;
}

/** Cuanto dura un catalogo descargado en "nowMs": hasta la proxima actualizacion programada + margen. */
function cacheTtlPolicy(config) {
  if (config.cacheTtlSeconds === 0) return 0; // cache desactivada
  if (!config.refreshTime) return UNSCHEDULED_TTL_MS;
  return (nowMs) => nextDailyAt(nowMs, config.refreshTime, CHILE_TIME_ZONE) - nowMs + SCHEDULE_GRACE_MS;
}

/**
 * @param {object} [options]
 * @param {object} [options.env]              variables de entorno (por defecto process.env)
 * @param {string|null} [options.envFilePath] ruta del .env; null = no leer archivo
 * @param {string} [options.defaultLogLevel]  si LOG_LEVEL no esta definido
 * @param {object} [options.logger]
 * @param {Function} [options.fetchImpl]      fetch (por defecto el global)
 * @param {() => Date} [options.clock]
 * @param {Function} [options.sleep]
 * @param {object|null} [options.cache]       CacheStore; null desactiva; omitido = memoria
 * @param {object[]} [options.providers]      lista de providers (por defecto los 7 emisores)
 * @param {boolean} [options.timeouts]        false = sin timeouts (semantica original del CLI)
 * @param {{ setTimer?: Function, clearTimer?: Function }} [options.timers] timers del scheduler (tests)
 */
function createApp(options = {}) {
  const config = loadConfig({ env: options.env, envFilePath: options.envFilePath });
  const clock = options.clock || (() => new Date());
  const sleep = options.sleep || defaultSleep;
  const logger =
    options.logger || createLogger({ level: config.logLevel || options.defaultLogLevel || 'info', clock });
  const useTimeouts = options.timeouts !== false;

  const http = createHttpClient({
    fetchImpl: options.fetchImpl,
    timeoutMs: useTimeouts ? config.httpTimeoutMs : 0,
    sleep,
  });
  const registry = createProviderRegistry(options.providers);
  const statusTracker = createSourceStatusTracker({ clock });

  const createContext = (provider, extra = {}) => ({
    http,
    config,
    now: clock,
    sleep,
    logger: logger.child({ provider: provider.key }),
    ...extra,
  });

  const cache = resolveCache(options.cache, config, clock);
  const cacheTtlMs = cacheTtlPolicy(config);
  const now = () => clock().getTime();
  const runner = createProviderRunner({
    createContext,
    cache,
    cacheTtlMs,
    refreshMinAgeMs: config.cacheRefreshMinAgeSeconds * 1000,
    now,
    timeoutMs: useTimeouts ? config.providerTimeoutMs : 0,
    logger,
    statusTracker,
  });

  const searchService = createSearchService({ registry, runner });

  // Solo se crea; lo arranca el servidor HTTP (el CLI y la fachada no programan nada). Sin cache o
  // con REFRESH_TIME=off no hay actualizacion programada.
  const refreshScheduler =
    cache && config.refreshTime
      ? createRefreshScheduler({
          refreshAll: () => searchService.refreshAll(),
          nextRunAt: (nowMs) => nextDailyAt(nowMs, config.refreshTime, CHILE_TIME_ZONE),
          now,
          logger,
          time: config.refreshTime,
          timeZone: CHILE_TIME_ZONE,
          ...options.timers,
        })
      : null;

  // Segundos que dura hoy un catalogo descargado ahora (para /v1/health).
  const cacheTtlSecondsNow = () =>
    Math.round((typeof cacheTtlMs === 'function' ? cacheTtlMs(now()) : cacheTtlMs) / 1000);

  return {
    config,
    logger,
    clock,
    cache,
    registry,
    runner,
    statusTracker,
    searchService,
    refreshScheduler,
    cacheTtlSecondsNow,
  };
}

module.exports = { createApp, SCHEDULE_GRACE_MS };
