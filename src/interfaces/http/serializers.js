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
});

const toV1Source = ({ key, bank, status, count, cached, durationMs, error }) => {
  const source = { key, bank, status, count, cached, durationMs };
  if (error) source.error = error;
  return source;
};

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
  const { items, pagination } = paginate(result.matches, page, pageSize);
  return {
    query,
    results: items.map((entry) => toV1Benefit(entry, keyForBank)),
    pagination,
    sources: result.sources.map(toV1Source),
    errors: result.errors,
    meta: {
      generatedAt: now.toISOString(),
      partial: result.errors.length > 0,
    },
  };
}

module.exports = { toLegacySearchResponse, toV1Benefit, toV1SearchResponse, paginate, V1_DESCRIPTION_LIMIT };
