// Parsing puro de la API de contenido (Modyo) que alimenta
// https://sitiospublicos.bancochile.cl/personas/beneficios/todos-los-beneficios
const { createEntry } = require('../domain/entry');
const { ProviderError } = require('../domain/errors');
const { cleanText } = require('../shared/text');
const { todayInChile } = require('../shared/dates');

const NAME = 'Banco de Chile';
const SITE_URL = 'https://sitiospublicos.bancochile.cl/personas/beneficios';
const API_URL =
  'https://sitiospublicos.bancochile.cl/api/content/spaces/personas/types/beneficios/entries';

const detailUrl = (slug) => `${SITE_URL}/detalle/${slug}`;

// "Autos; Lavados" -> "Autos Lavados"; "20%; dto." -> "20% dto."
const fromList = (value) => cleanText(String(value || '').replace(/;/g, ' '));

/**
 * Convierte una entrada del CMS en Entry.
 * Campos usados: meta.{name, slug, uuid, tags, category_name, unpublish_at} y
 * fields.{Titulo, Extracto, Descripcion, Keywords, Tipo Beneficio, Logo}.
 */
function parseBancoChileEntry(item) {
  const meta = item?.meta || {};
  const fields = item?.fields || {};
  const title = cleanText(fields.Titulo || meta.name);
  const discount = fromList(fields['Tipo Beneficio']);
  const excerpt = cleanText(fields.Extracto);

  return createEntry(
    {
      bank: NAME,
      title,
      subtitle: [discount, excerpt].filter(Boolean).join(' - '),
      description: cleanText(fields.Descripcion) || excerpt,
      url: meta.slug ? detailUrl(meta.slug) : `${SITE_URL}/todos-los-beneficios`,
      slug: meta.slug || '',
      commerceName: title,
      category: cleanText(meta.category_name),
      // unpublish_at es el fin de publicacion, que coincide con el texto "Vigencia".
      validUntil: meta.unpublish_at ? todayInChile(new Date(meta.unpublish_at)) : '',
      keywords: fromList(fields.Keywords),
      tagsText: cleanText((meta.tags || []).join(' ')),
    },
    { sourceId: meta.uuid, logo: fields.Logo?.url },
  );
}

// Una pagina de la API -> { entries, totalPages }. Valida que sea el JSON esperado.
function parseBancoChilePage(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProviderError(`Banco de Chile devolvio una respuesta no JSON: ${text.slice(0, 120)}`, {
      code: 'INVALID_RESPONSE',
    });
  }

  if (!Array.isArray(data?.entries)) {
    throw new ProviderError('Banco de Chile devolvio un formato inesperado (falta "entries")', {
      code: 'INVALID_RESPONSE',
    });
  }

  return {
    entries: data.entries.map(parseBancoChileEntry),
    totalPages: Number(data?.meta?.total_pages) || 1,
  };
}

module.exports = { NAME, SITE_URL, API_URL, detailUrl, parseBancoChileEntry, parseBancoChilePage };
