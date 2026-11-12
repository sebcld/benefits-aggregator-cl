// Tapp (Caja Los Andes): CMS headless (Modyo), el mismo que usa www.tapp.cl/beneficios.
// Igual que el sitio, se pide cada categoria por separado (meta.category=<categoria>) y solo las
// VIGENTES: hoy "beneficios" y "convenios". Las "*-finalizados" nunca se descargan.
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { cleanText } = require('../shared/text');

const NAME = 'Tapp';
const BASE_URL = 'https://web.cajalosandes.cl/api/content/spaces/wp-tapp-beneficios-copia';
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 100;

// Si el CMS no entrega la lista de categorias, se usan las vigentes conocidas.
const DEFAULT_ACTIVE_CATEGORIES = ['beneficios', 'convenios'];
const isFinished = (category) => /finalizad/i.test(category || '');

/** Categorias vigentes segun el CMS (las mismas pestanas del sitio, sin las finalizadas). */
async function activeCategories(http, signal) {
  const data = await http.getJson(`${BASE_URL}/types/beneficios-categoria/entries`, { label: NAME, signal });
  const categories = (data?.entries || []).map((e) => e?.meta?.category).filter((c) => c && !isFinished(c));
  return categories.length ? [...new Set(categories)] : DEFAULT_ACTIVE_CATEGORIES;
}

const entriesUrl = (category, page) =>
  `${BASE_URL}/types/beneficios/entries?${new URLSearchParams({ 'meta.category': category, per_page: String(PAGE_SIZE), page: String(page) })}`;

// Convierte una entrada del CMS en Entry, o null si el beneficio esta finalizado.
function parseTappEntry(item) {
  // Resguardo: aunque solo se piden categorias vigentes, nunca se devuelve uno finalizado.
  if (isFinished(item?.meta?.category)) {
    return null;
  }
  return toTappEntry(item);
}

// Mapeo de una entrada del CMS a Entry, sin mirar la vigencia. Los tests lo usan con datos
// finalizados grabados para probar la busqueda; la API solo lo llama via parseTappEntry.
// Campos del CMS:
//   Bajada            texto descriptivo del beneficio          -> description
//   Cuerpo            "Terminos y condiciones..."              -> solo si no hay Bajada
//   Tipo de cliente   "Cliente Tapp"                           -> subtitle, junto a
//   Regiones          ["Todo el pais"]                            las regiones
function toTappEntry(item) {
  const fields = item?.fields || {};
  const title = item?.meta?.name || '';
  const description = cleanText(fields['Bajada']) || cleanText(fields['Cuerpo']);
  const regions = [].concat(fields['Regiones'] || []).map((r) => cleanText(String(r)));
  const subtitle = [cleanText(fields['Tipo de cliente']), ...regions].filter(Boolean).join(' · ');
  const slug = item?.meta?.slug || '';
  const category = item?.meta?.category || 'beneficios';

  const url = slug ? `https://www.tapp.cl/beneficios/${category}/${slug}` : 'https://www.tapp.cl/beneficios';

  return createEntry(
    {
      bank: NAME,
      title: cleanText(title),
      subtitle,
      description,
      url,
      slug,
      commerceName: cleanText(item?.fields?.['Logo anunciante']?.title || title),
      keywords: cleanText(item?.fields?.['Tipo de beneficio'] || ''),
      tagsText: cleanText(item?.meta?.tags?.join(' ') || ''),
    },
    { sourceId: item?.meta?.uuid, logo: item?.fields?.['Logo anunciante']?.url },
  );
}

const provider = defineProvider({
  key: 'tapp',
  name: NAME,
  async fetch({ http, sleep, signal }) {
    const results = [];

    for (const category of await activeCategories(http, signal)) {
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const data = await http.getJson(entriesUrl(category, page), { label: NAME, signal });
        totalPages = data?.meta?.total_pages || 1;

        for (const item of data?.entries || []) {
          const entry = parseTappEntry(item);
          if (entry) results.push(entry);
        }

        page += 1;
        await sleep(PAGE_DELAY_MS, signal);
      }
    }

    return results;
  },
});

module.exports = { provider, parseTappEntry, toTappEntry, entriesUrl, activeCategories, DEFAULT_ACTIVE_CATEGORIES };
