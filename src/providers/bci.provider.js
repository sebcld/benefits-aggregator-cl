// BCI: API BFF de BCI Plus, paginada de 100 en 100. Requiere BCI_SUBSCRIPTION_KEY.
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { ProviderError } = require('../domain/errors');
const { cleanText } = require('../shared/text');

const NAME = 'BCI';
const BASE_URL = 'https://api.bciplus.cl/bff-loyalty-beneficios/v1/offers';
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 150;

function parseBciOffer(offer) {
  const tagsText = (offer?.tags || []).map((t) => t?.nombre || '').join(' ');
  const fallbackUrl = offer?.slug
    ? `https://www.bci.cl/beneficios/beneficios-bci#${offer.slug}`
    : 'https://www.bci.cl/beneficios/beneficios-bci';

  return createEntry(
    {
      bank: NAME,
      title: offer?.titulo?.trim() || '',
      subtitle: cleanText(offer?.subtitulo),
      description: cleanText(offer?.descripcion),
      url: offer?.link?.trim() || fallbackUrl,
      slug: offer?.slug || '',
      commerceName: cleanText(offer?.comercio?.nombre),
      keywords: cleanText(offer?.keywords),
      tagsText,
    },
    { sourceId: offer?.id, logo: offer?.imagenes?.imagen1 },
  );
}

const provider = defineProvider({
  key: 'bci',
  name: NAME,
  async fetch({ http, config, sleep, signal }) {
    const subscriptionKey = config.bciSubscriptionKey;
    if (!subscriptionKey) {
      throw new ProviderError(
        'Falta la llave de subscripcion de BCI (define BCI_SUBSCRIPTION_KEY en .env)',
        { code: 'MISSING_CREDENTIALS' },
      );
    }

    const headers = { 'ocp-apim-subscription-key': subscriptionKey, referer: 'https://www.bci.cl/' };
    const offers = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `${BASE_URL}?itemsPorPagina=${PAGE_SIZE}&pagina=${page}`;
      const data = await http.getJson(url, { label: NAME, headers, signal });
      totalPages = data?.paginado?.totalPaginas || 1;
      offers.push(...(data?.ofertas || []));
      page += 1;
      await sleep(PAGE_DELAY_MS, signal);
    }

    return offers.map(parseBciOffer);
  },
});

module.exports = { provider, parseBciOffer };
