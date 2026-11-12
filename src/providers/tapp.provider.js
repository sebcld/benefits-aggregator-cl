// Tapp (Caja Los Andes): CMS headless paginado de 100 en 100. Omite los "finalizados".
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { cleanText } = require('../shared/text');

const NAME = 'Tapp';
const BASE_URL = 'https://web.cajalosandes.cl/api/content/spaces/wp-tapp-beneficios-copia';
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 100;

// Convierte una entrada del CMS en Entry, o null si el beneficio esta finalizado.
function parseTappEntry(item) {
  const title = item?.meta?.name || '';
  const description = cleanText(item?.fields?.['Cuerpo'] || item?.fields?.['Bajada'] || '');
  const subtitle = cleanText(item?.fields?.['Bajada'] || '');
  const slug = item?.meta?.slug || '';
  const category = item?.meta?.category || 'beneficios';

  if (category.includes('finalizados')) {
    return null;
  }

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
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `${BASE_URL}/types/beneficios/entries?per_page=${PAGE_SIZE}&page=${page}`;
      const data = await http.getJson(url, { label: NAME, signal });
      totalPages = data?.meta?.total_pages || 1;

      for (const item of data?.entries || []) {
        const entry = parseTappEntry(item);
        if (entry) results.push(entry);
      }

      page += 1;
      await sleep(PAGE_DELAY_MS, signal);
    }

    return results;
  },
});

module.exports = { provider, parseTappEntry };
