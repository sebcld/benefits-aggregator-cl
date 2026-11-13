// Configuracion tipada y validada. Importar este modulo no tiene efectos: hay que llamar
// a loadConfig(). Prioridad: variables del entorno > archivo .env > valores por defecto.
const path = require('path');
const { readEnvFile } = require('./env-file');
const { parseApiKeys } = require('./api-keys');
const { ConfigError } = require('../domain/errors');
const { LEVELS } = require('../shared/logger');

const DEFAULT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

const DEFAULTS = Object.freeze({
  PORT: 3000,
  CACHE_TTL_SECONDS: 1800, // 30 min; 0 desactiva la cache
  CACHE_REFRESH_MIN_AGE_SECONDS: 300, // 5 min: antiguedad minima para forzar la actualizacion
  HTTP_TIMEOUT_MS: 20000, // por peticion HTTP a un emisor
  PROVIDER_TIMEOUT_MS: 60000, // por emisor completo (incluye paginacion y pausas)
  BODY_LIMIT_BYTES: 1000000,
});

function createReader(vars, problems) {
  const raw = (name) => (vars[name] === undefined ? '' : String(vars[name]).trim());

  const integer = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const value = raw(name);
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      problems.push(`${name} debe ser un entero entre ${min} y ${max} (recibido "${value}")`);
      return fallback;
    }
    return parsed;
  };

  const oneOf = (name, allowed) => {
    const value = raw(name).toLowerCase();
    if (!value) return null;
    if (!allowed.includes(value)) {
      problems.push(`${name} debe ser uno de: ${allowed.join(', ')} (recibido "${value}")`);
      return null;
    }
    return value;
  };

  const list = (name) =>
    raw(name)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const boolean = (name, fallback) => {
    const value = raw(name).toLowerCase();
    if (!value) return fallback;
    if (['true', '1', 'yes', 'si'].includes(value)) return true;
    if (['false', '0', 'no'].includes(value)) return false;
    problems.push(`${name} debe ser true o false (recibido "${value}")`);
    return fallback;
  };

  return { raw, integer, oneOf, list, boolean };
}

/**
 * @param {object} [options]
 * @param {Record<string, string|undefined>} [options.env] variables del entorno (process.env)
 * @param {string|null} [options.envFilePath] ruta del .env; null para no leer archivo
 */
function loadConfig({ env = process.env, envFilePath = DEFAULT_ENV_PATH } = {}) {
  const vars = { ...readEnvFile(envFilePath), ...env };
  const problems = [];
  const read = createReader(vars, problems);

  const config = {
    port: read.integer('PORT', DEFAULTS.PORT, { min: 1, max: 65535 }),
    // null => cada interfaz decide (CLI: silent, servidor: info).
    logLevel: read.oneOf('LOG_LEVEL', Object.keys(LEVELS)),
    bciSubscriptionKey: read.raw('BCI_SUBSCRIPTION_KEY'),
    // Opcional: sube el limite de uso de r.jina.ai (proxy usado para Banco de Chile).
    jinaApiKey: read.raw('JINA_API_KEY'),
    cacheTtlSeconds: read.integer('CACHE_TTL_SECONDS', DEFAULTS.CACHE_TTL_SECONDS),
    // /v1/search?refresh=true solo vuelve a descargar catalogos con al menos esta antiguedad.
    cacheRefreshMinAgeSeconds: read.integer(
      'CACHE_REFRESH_MIN_AGE_SECONDS',
      DEFAULTS.CACHE_REFRESH_MIN_AGE_SECONDS,
    ),
    // true = el servidor descarga los catalogos al iniciar (la primera busqueda ya es rapida).
    cacheWarmup: read.boolean('CACHE_WARMUP', false),
    httpTimeoutMs: read.integer('HTTP_TIMEOUT_MS', DEFAULTS.HTTP_TIMEOUT_MS),
    providerTimeoutMs: read.integer('PROVIDER_TIMEOUT_MS', DEFAULTS.PROVIDER_TIMEOUT_MS),
    corsOrigins: read.list('CORS_ORIGINS'),
    // Llaves de los clientes (servidor de la web, app movil). Vacio = sin autenticacion.
    apiKeys: parseApiKeys(read.list('API_KEYS'), problems),
    bodyLimitBytes: read.integer('BODY_LIMIT_BYTES', DEFAULTS.BODY_LIMIT_BYTES, { min: 1 }),
  };

  if (problems.length) {
    throw new ConfigError(`Configuracion invalida: ${problems.join('; ')}`, { details: problems });
  }

  return Object.freeze(config);
}

module.exports = { loadConfig, DEFAULTS, DEFAULT_ENV_PATH };
