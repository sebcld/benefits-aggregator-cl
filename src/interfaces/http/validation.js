// Validacion y normalizacion de parametros de busqueda (query string o body JSON).
const { ValidationError } = require('../../domain/errors');

const LIMITS = Object.freeze({
  maxQueryLength: 100,
  maxBanks: 20,
  defaultPageSize: 20,
  maxPageSize: 100,
});

// "a,b" o ["a","b"] -> ["a","b"] (sin vacios). Igual que la version original.
function parseBanks(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const asTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

// API legada: mismas reglas y mensajes que la version original.
function parseLegacySearch({ query, banks }, { missingMessage }) {
  const text = asTrimmedString(query);
  if (!text) throw new ValidationError(missingMessage, { code: 'MISSING_QUERY' });
  return { query: text, banks: parseBanks(banks) };
}

function parsePositiveInt(value, name, { fallback, max }) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || (max && parsed > max)) {
    const range = max ? `entre 1 y ${max}` : 'mayor o igual a 1';
    throw new ValidationError(`"${name}" debe ser un entero ${range}`, {
      code: 'INVALID_PAGINATION',
      details: { field: name, value },
    });
  }
  return parsed;
}

// refresh: solo true (body) o "true" (query string) lo activan, igual que probe en /v1/health.
const isTrue = (value) => value === true || value === 'true';

/**
 * API v1: valida consulta, emisores (por nombre o key), paginacion y refresh.
 * @param {{ query?: unknown, banks?: unknown, page?: unknown, pageSize?: unknown, refresh?: unknown }} input
 * @param {ReturnType<import('../../providers').createProviderRegistry>} registry
 */
function parseV1Search(input, registry) {
  const query = asTrimmedString(input.query);
  if (!query) {
    throw new ValidationError('Falta la consulta de busqueda ("q" o "query")', { code: 'MISSING_QUERY' });
  }
  if (query.length > LIMITS.maxQueryLength) {
    throw new ValidationError(`La consulta supera ${LIMITS.maxQueryLength} caracteres`, {
      code: 'QUERY_TOO_LONG',
      details: { maxLength: LIMITS.maxQueryLength },
    });
  }
  return { query, ...parseV1Listing(input, registry) };
}

/**
 * Emisores, paginacion y refresh: comun a /v1/search y /v1/benefits (este no lleva consulta).
 * @param {{ banks?: unknown, page?: unknown, pageSize?: unknown, refresh?: unknown }} input
 * @param {ReturnType<import('../../providers').createProviderRegistry>} registry
 */
function parseV1Listing(input, registry) {
  if (input.banks !== undefined && typeof input.banks !== 'string' && !Array.isArray(input.banks)) {
    throw new ValidationError('"banks" debe ser texto separado por comas o un arreglo', {
      code: 'UNKNOWN_BANK',
    });
  }
  const requested = parseBanks(input.banks);
  if (requested.length > LIMITS.maxBanks) {
    throw new ValidationError(`Maximo ${LIMITS.maxBanks} emisores por busqueda`, { code: 'UNKNOWN_BANK' });
  }

  const resolved = requested.map((bank) => registry.find(bank, { allowKeys: true }));
  const unknown = requested.filter((_, i) => !resolved[i]);
  if (unknown.length) {
    throw new ValidationError(`Emisor desconocido: ${unknown.join(', ')}`, {
      code: 'UNKNOWN_BANK',
      details: { unknown, allowed: registry.list().map((p) => p.key) },
    });
  }

  return {
    banks: resolved.map((p) => p.key),
    page: parsePositiveInt(input.page, 'page', { fallback: 1 }),
    pageSize: parsePositiveInt(input.pageSize, 'pageSize', {
      fallback: LIMITS.defaultPageSize,
      max: LIMITS.maxPageSize,
    }),
    refresh: isTrue(input.refresh),
  };
}

// Parametros de la query string en el formato que espera parseV1Search.
const v1InputFromQueryString = (params) => ({
  query: params.get('q') ?? undefined,
  banks: params.get('banks') ?? undefined,
  page: params.get('page') ?? undefined,
  pageSize: params.get('pageSize') ?? undefined,
  refresh: params.get('refresh') ?? undefined,
});

module.exports = { LIMITS, parseBanks, parseLegacySearch, parseV1Search, parseV1Listing, v1InputFromQueryString };
