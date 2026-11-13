// Formato de las respuestas HTTP. La API legada conserva la forma historica; la v1 entrega un
// payload liviano y estable pensado para clientes moviles (ver docs/openapi.yaml).
const { toLegacyEntry } = require('../../domain/entry');
const { truncate } = require('../../shared/text');

const V1_DESCRIPTION_LIMIT = 300;
const orNull = (value) => (value === undefined || value === '' ? null : value);

// API legada: { matches, errors: [{ bank, message }] }
const toLegacySearchResponse = ({ matches, errors }) => ({
  matches: matches.map(toLegacyEntry),
  errors: errors.map(({ bank, message }) => ({ bank, message })),
});

/**
 * Beneficio en la API v1. Campos opcionales en null (no ""), descripcion acotada.
 * @param {import('../../domain/entry').Entry} entry
 * @param {(bankName: string) => string|null} keyForBank
 */
const toV1Benefit = (entry, keyForBank) => ({
  id: entry.id,
  bank: entry.bank,
  bankKey: keyForBank(entry.bank),
  title: entry.title,
  subtitle: orNull(entry.subtitle),
  description: entry.description ? truncate(entry.description, V1_DESCRIPTION_LIMIT) : null,
  commerceName: orNull(entry.commerceName),
  category: orNull(entry.category),
  validFrom: orNull(entry.validFrom),
  validUntil: orNull(entry.validUntil),
  url: orNull(entry.url),
  logo: orNull(entry.logo),
  cardType: orNull(entry.cardType),
  discountCap: orNull(entry.discountCap),
  termsUrl: orNull(entry.termsUrl),
  discount: orNull(entry.discount),
  schedule: orNull(entry.schedule),
});

const toV1Source = ({ key, bank, status, count, cached, durationMs, fetchedAt, error }) => {
  const source = { key, bank, status, count, cached, durationMs, fetchedAt: fetchedAt ?? null };
  if (error) source.error = error;
  return source;
};

// El primer momento en que refresh=true volveria a descargar algun catalogo de esta busqueda.
// null si no hay cache (cada busqueda ya descarga) o si ningun emisor respondio.
// Las fechas ISO en UTC con el mismo formato se ordenan bien como texto.
const earliestRefresh = (sources) =>
  sources
    .map((s) => s.refreshableAt)
    .filter(Boolean)
    .sort()[0] ?? null;

function paginate(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    pagination: { page, pageSize, total, totalPages, hasMore: start + pageSize < total },
  };
}

/**
 * @param {object} params
 * @param {string} params.query
 * @param {import('../../services/search-service').SearchResult} params.result
 * @param {number} params.page
 * @param {number} params.pageSize
 * @param {(bankName: string) => string|null} params.keyForBank
 * @param {Date} params.now
 */
function toV1SearchResponse({ query, result, page, pageSize, keyForBank, now }) {
  return { query, ...toV1BenefitsResponse({ result, page, pageSize, keyForBank, now }) };
}

/** Respuesta de /v1/benefits: la de /v1/search sin "query" (no hay consulta). */
function toV1BenefitsResponse({ result, page, pageSize, keyForBank, now }) {
  const { items, pagination } = paginate(result.matches, page, pageSize);
  return {
    results: items.map((entry) => toV1Benefit(entry, keyForBank)),
    pagination,
    sources: result.sources.map(toV1Source),
    errors: result.errors,
    meta: {
      generatedAt: now.toISOString(),
      partial: result.errors.length > 0,
      refreshableAt: earliestRefresh(result.sources),
    },
  };
}

module.exports = {
  toLegacySearchResponse,
  toV1Benefit,
  toV1SearchResponse,
  toV1BenefitsResponse,
  paginate,
  V1_DESCRIPTION_LIMIT,
};
