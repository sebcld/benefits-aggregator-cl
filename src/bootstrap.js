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
const { createMemoryCacheStore } = require('./shared/cache/memory-cache-store');
const { assertCacheStore } = require('./shared/cache/cache-store');

// undefined = cache en memoria si CACHE_TTL_SECONDS > 0; null = sin cache; objeto = ese CacheStore.
function resolveCache(option, config, clock) {
  if (option === null) return null;
  if (option !== undefined) return assertCacheStore(option);
  return config.cacheTtlSeconds > 0 ? createMemoryCacheStore({ now: () => clock().getTime() }) : null;
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
  const runner = createProviderRunner({
    createContext,
    cache,
    cacheTtlMs: config.cacheTtlSeconds * 1000,
    timeoutMs: useTimeouts ? config.providerTimeoutMs : 0,
    logger,
    statusTracker,
  });

  const searchService = createSearchService({ registry, runner });

  return { config, logger, clock, cache, registry, runner, statusTracker, searchService };
}

module.exports = { createApp };
