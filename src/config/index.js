// Configuracion tipada y validada. Importar este modulo no tiene efectos: hay que llamar
// a loadConfig(). Prioridad: variables del entorno > archivo .env > valores por defecto.
const path = require('path');
const { readEnvFile } = require('./env-file');
const { parseApiKeys } = require('./api-keys');
const { parseClockTime } = require('../shared/dates');
const { ConfigError } = require('../domain/errors');
const { LEVELS } = require('../shared/logger');

const DEFAULT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

const DEFAULTS = Object.freeze({
  PORT: 3000,
  // Ya no define cuanto dura la cache (ADR 0024: hasta la actualizacion programada). Solo 0 tiene
  // efecto: desactiva la cache. Se mantiene por compatibilidad con .env existentes.
  CACHE_TTL_SECONDS: 1800,
  REFRESH_TIME: '09:00', // hora diaria (Chile) de la actualizacion programada; "off" la desactiva
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
    // Solo para compatibilidad: 0 desactiva la cache; otro valor ya no cambia nada (ADR 0024).
    cacheTtlSeconds: read.integer('CACHE_TTL_SECONDS', DEFAULTS.CACHE_TTL_SECONDS),
    // Hora diaria (Chile, "HH:MM") de la actualizacion programada; null = desactivada ("off").
    refreshTime: readRefreshTime(read.raw('REFRESH_TIME') || DEFAULTS.REFRESH_TIME, problems),
    // /v1/search?refresh=true solo vuelve a descargar catalogos con al menos esta antiguedad.
    cacheRefreshMinAgeSeconds: read.integer(
      'CACHE_REFRESH_MIN_AGE_SECONDS',
      DEFAULTS.CACHE_REFRESH_MIN_AGE_SECONDS,
    ),
    // true = el servidor descarga los catalogos al iniciar (carga inicial: la cache esta en
    // memoria y arranca vacia). false solo tiene sentido en desarrollo.
    cacheWarmup: read.boolean('CACHE_WARMUP', true),
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

  // Avisos que no detienen el inicio: el servidor los deja en el log (config_warning).
  const warnings = [];
  if (read.raw('CACHE_TTL_SECONDS') && config.cacheTtlSeconds > 0) {
    warnings.push(
      'CACHE_TTL_SECONDS ya no define cuanto dura la cache: dura hasta la actualizacion ' +
        'programada (REFRESH_TIME). Solo CACHE_TTL_SECONDS=0 tiene efecto (desactiva la cache).',
    );
  }

  return Object.freeze({ ...config, warnings: Object.freeze(warnings) });
}

// "09:00" -> "09:00"; "off" -> null. Cualquier otra cosa es un error de configuracion.
function readRefreshTime(value, problems) {
  if (value.toLowerCase() === 'off') return null;
  if (parseClockTime(value)) return value;
  problems.push(`REFRESH_TIME debe ser una hora HH:MM (00:00 a 23:59) u "off" (recibido "${value}")`);
  return null;
}

module.exports = { loadConfig, DEFAULTS, DEFAULT_ENV_PATH };
