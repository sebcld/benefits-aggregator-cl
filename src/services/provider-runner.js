// Ejecuta un provider con: cache opcional (CacheStore), deduplicacion de peticiones en curso,
// timeout por emisor, medicion de duracion, alerta cuando un catalogo llega vacio y renovacion
// manual del catalogo (refresh) con una antiguedad minima.
const { performance } = require('perf_hooks');
const { TimeoutError, errorCode } = require('../domain/errors');
const { anySignal } = require('../shared/async');

// Un catalogo que llega vacio casi siempre es una falla pasajera o un cambio en la fuente, no la
// realidad: se guarda solo 1 minuto (no todo el TTL) para recuperarse apenas la fuente vuelva.
const EMPTY_CACHE_TTL_MS = 60_000;

const toIso = (ms) => new Date(ms).toISOString();

/**
 * @param {object} deps
 * @param {(provider: object, extra: object) => object} deps.createContext arma el ProviderContext
 * @param {import('../shared/cache/cache-store').CacheStore|null} [deps.cache]
 * @param {number} [deps.cacheTtlMs]
 * @param {number} [deps.emptyCacheTtlMs] cuanto se guarda un catalogo que llego vacio
 * @param {number} [deps.refreshMinAgeMs] antiguedad minima para que refresh vuelva a descargar
 * @param {() => number} [deps.now] reloj en ms (fecha de descarga de cada catalogo)
 * @param {number} [deps.timeoutMs] limite por emisor; 0 = sin limite
 * @param {object} deps.logger
 * @param {{ record: Function }} [deps.statusTracker]
 */
function createProviderRunner({
  createContext,
  cache = null,
  cacheTtlMs = 0,
  emptyCacheTtlMs = EMPTY_CACHE_TTL_MS,
  refreshMinAgeMs = 0,
  now = () => Date.now(),
  timeoutMs = 0,
  logger,
  statusTracker,
}) {
  const inFlight = new Map();
  const useCache = Boolean(cache && cacheTtlMs > 0);

  // Se guarda el catalogo completo de cada emisor: todas las busquedas lo reutilizan.
  // Valor en cache: { entries, fetchedAt } (fetchedAt en ms, para informar su antiguedad).
  const cacheKey = (provider) => `provider:${provider.key}`;
  const ttlFor = (entries) => (entries.length === 0 ? Math.min(emptyCacheTtlMs, cacheTtlMs) : cacheTtlMs);
  // Un refresh solo vuelve a descargar un catalogo con al menos refreshMinAgeMs: asi, pulsar
  // "Actualizar" muchas veces no se traduce en muchas descargas a la fuente.
  const isRefreshable = (fetchedAt) => now() - fetchedAt >= refreshMinAgeMs;

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

  /**
   * Devuelve { entries, cached, fetchedAt }. Lanza si el emisor falla (los errores no se cachean).
   * Con refresh, un catalogo en cache con la antiguedad minima se vuelve a descargar; si esa
   * descarga falla, se sigue usando el que estaba (sigue vigente) en vez de dejar al emisor sin datos.
   */
  async function fetchEntries(provider, { options, refresh = false } = {}) {
    const key = cacheKey(provider);
    // Las opciones propias (includeInactive) no comparten cache ni descargas en curso.
    const shared = !options;
    let previous;

    if (useCache && shared) {
      const hit = await cache.get(key);
      if (hit !== undefined) {
        if (!refresh || !isRefreshable(hit.fetchedAt)) return { ...hit, cached: true };
        previous = hit;
      }
    }

    let download = shared ? inFlight.get(key) : undefined;
    const owner = !download;
    if (owner) {
      download = fetchWithTimeout(provider, { options }).then((entries) => ({ entries, fetchedAt: now() }));
      if (shared) inFlight.set(key, download);
    }
    try {
      const fresh = await download;
      if (owner && useCache && shared) await cache.set(key, fresh, ttlFor(fresh.entries));
      return { ...fresh, cached: false };
    } catch (err) {
      if (!previous) throw err;
      // Se registra como aviso: el emisor sigue respondiendo con su catalogo anterior.
      logger.warn('provider_refresh_failed', {
        provider: provider.key,
        code: errorCode(err),
        message: err?.message,
      });
      return { ...previous, cached: true };
    } finally {
      if (owner && inFlight.get(key) === download) inFlight.delete(key);
    }
  }

  // Nunca rechaza: devuelve un SourceReport con las entradas o el error normalizado.
  async function run(provider, { refresh = false } = {}) {
    const started = performance.now();
    let report;

    try {
      const { entries, cached, fetchedAt } = await fetchEntries(provider, { refresh });
      const status = entries.length ? 'ok' : 'empty';
      report = {
        key: provider.key,
        bank: provider.name,
        status,
        count: entries.length,
        cached,
        fetchedAt: toIso(fetchedAt),
        // Desde cuando refresh volveria a descargarlo; null sin cache (cada busqueda ya descarga).
        refreshableAt: useCache ? toIso(fetchedAt + refreshMinAgeMs) : null,
        entries,
      };
      if (status === 'empty') {
        logger.warn('provider_empty', { provider: provider.key, hint: 'posible cambio en la fuente' });
      }
    } catch (err) {
      const error = { code: errorCode(err), message: err?.message || 'Error desconocido' };
      report = { key: provider.key, bank: provider.name, status: 'error', count: 0, cached: false, error };
      report.fetchedAt = null;
      report.refreshableAt = null;
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
