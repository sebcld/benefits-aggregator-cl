// Ejecuta un provider con: cache opcional (CacheStore), deduplicacion de peticiones en curso,
// timeout por emisor, medicion de duracion y alerta cuando un catalogo llega vacio.
const { performance } = require('perf_hooks');
const { TimeoutError, errorCode } = require('../domain/errors');
const { anySignal } = require('../shared/async');
const { normalize } = require('../shared/text');

// Un catalogo que llega vacio casi siempre es una falla pasajera o un cambio en la fuente, no la
// realidad: se guarda solo 1 minuto (no todo el TTL) para recuperarse apenas la fuente vuelva.
const EMPTY_CACHE_TTL_MS = 60_000;

/**
 * @param {object} deps
 * @param {(provider: object, extra: object) => object} deps.createContext arma el ProviderContext
 * @param {import('../shared/cache/cache-store').CacheStore|null} [deps.cache]
 * @param {number} [deps.cacheTtlMs]
 * @param {number} [deps.emptyCacheTtlMs] cuanto se guarda un catalogo que llego vacio
 * @param {number} [deps.timeoutMs] limite por emisor; 0 = sin limite
 * @param {object} deps.logger
 * @param {{ record: Function }} [deps.statusTracker]
 */
function createProviderRunner({
  createContext,
  cache = null,
  cacheTtlMs = 0,
  emptyCacheTtlMs = EMPTY_CACHE_TTL_MS,
  timeoutMs = 0,
  logger,
  statusTracker,
}) {
  const inFlight = new Map();
  const useCache = Boolean(cache && cacheTtlMs > 0);

  const cacheKey = (provider, query) =>
    provider.queryDependent ? `provider:${provider.key}:q:${normalize(query)}` : `provider:${provider.key}`;

  async function fetchWithTimeout(provider, extra) {
    const timeoutSignal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
    const signal = anySignal([extra.signal, timeoutSignal]);
    const work = provider.fetch(createContext(provider, { ...extra, signal }));
    if (!signal) return work;

    return new Promise((resolve, reject) => {
      const onAbort = () =>
        reject(
          timeoutSignal?.aborted
            ? new TimeoutError(`${provider.name} excedio el tiempo limite (${timeoutMs} ms)`, { timeoutMs })
            : signal.reason,
        );
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
      work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }

  // Devuelve { entries, cached }. Lanza si el emisor falla (los errores no se cachean).
  async function fetchEntries(provider, { query, options } = {}) {
    const key = cacheKey(provider, query);

    if (useCache && !options) {
      const hit = await cache.get(key);
      if (hit !== undefined) return { entries: hit, cached: true };
    }
    if (inFlight.has(key) && !options) return { entries: await inFlight.get(key), cached: false };

    const promise = fetchWithTimeout(provider, { query, options });
    if (!options) inFlight.set(key, promise);
    try {
      const entries = await promise;
      if (useCache && !options) {
        // En los providers por consulta (Mercado Pago), 0 resultados es una respuesta normal.
        const emptyCatalog = !provider.queryDependent && entries.length === 0;
        await cache.set(key, entries, emptyCatalog ? Math.min(emptyCacheTtlMs, cacheTtlMs) : cacheTtlMs);
      }
      return { entries, cached: false };
    } finally {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    }
  }

  // Nunca rechaza: devuelve un SourceReport con las entradas o el error normalizado.
  async function run(provider, { query } = {}) {
    const started = performance.now();
    let report;

    try {
      const { entries, cached } = await fetchEntries(provider, { query });
      const status = entries.length || provider.queryDependent ? 'ok' : 'empty';
      report = { key: provider.key, bank: provider.name, status, count: entries.length, cached, entries };
      if (status === 'empty') {
        logger.warn('provider_empty', { provider: provider.key, hint: 'posible cambio en la fuente' });
      }
    } catch (err) {
      const error = { code: errorCode(err), message: err?.message || 'Error desconocido' };
      report = { key: provider.key, bank: provider.name, status: 'error', count: 0, cached: false, error };
      report.entries = [];
      logger.warn('provider_error', { provider: provider.key, ...error });
    }

    report.durationMs = Math.round(performance.now() - started);
    logger.debug('provider_done', {
      provider: provider.key,
      status: report.status,
      count: report.count,
      cached: report.cached,
      durationMs: report.durationMs,
    });
    statusTracker?.record(report);
    return report;
  }

  return { run, fetchEntries };
}

module.exports = { createProviderRunner };
