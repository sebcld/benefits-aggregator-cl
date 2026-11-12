// Cliente HTTP comun para los providers: user-agent, timeout por peticion, reintento en 429
// y errores uniformes. Es la unica pieza que conoce "fetch".
const { ProviderError, TimeoutError } = require('../domain/errors');
const { anySignal, sleep: defaultSleep } = require('./async');

const DEFAULT_USER_AGENT = 'beneficios-finder/1.0';

/**
 * @param {object} [options]
 * @param {Function} [options.fetchImpl] fetch a usar (por defecto el global, resuelto en cada llamada)
 * @param {string} [options.userAgent]
 * @param {number} [options.timeoutMs] timeout por peticion; 0 = sin timeout
 * @param {Function} [options.sleep] pausa usada entre reintentos
 */
function createHttpClient({
  fetchImpl,
  userAgent = DEFAULT_USER_AGENT,
  timeoutMs = 0,
  sleep = defaultSleep,
} = {}) {
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  // Devuelve la Response tal cual (incluidos status no-OK). Reintenta 429 si "retry" lo pide.
  async function request(url, { headers = {}, signal, label = 'HTTP', retry, timeout } = {}) {
    const limit = timeout ?? timeoutMs;

    for (let attempt = 1; ; attempt += 1) {
      const timeoutSignal = limit > 0 ? AbortSignal.timeout(limit) : undefined;
      let response;

      try {
        response = await doFetch(url, {
          headers: { 'user-agent': userAgent, ...headers },
          signal: anySignal([signal, timeoutSignal]),
        });
      } catch (err) {
        if (timeoutSignal?.aborted && !signal?.aborted) {
          throw new TimeoutError(`${label}: sin respuesta en ${limit} ms`, { timeoutMs: limit });
        }
        throw err;
      }

      if (retry && response.status === 429 && attempt < retry.maxAttempts) {
        const seconds = Number(response.headers.get('retry-after')) || retry.defaultDelaySeconds;
        await sleep(seconds * 1000, signal);
        continue;
      }

      return response;
    }
  }

  // Lanza ProviderError con el mismo mensaje historico: "<Emisor> respondio <status>: <body>".
  async function ensureOk(response, label) {
    if (!response.ok) {
      const body = await response.text();
      throw new ProviderError(`${label} respondio ${response.status}: ${body.slice(0, 120)}`, {
        code: 'HTTP_ERROR',
        status: response.status,
      });
    }
    return response;
  }

  const getJson = async (url, options = {}) =>
    (await ensureOk(await request(url, options), options.label)).json();

  const getText = async (url, options = {}) =>
    (await ensureOk(await request(url, options), options.label)).text();

  return { request, ensureOk, getJson, getText };
}

module.exports = { createHttpClient, DEFAULT_USER_AGENT };
