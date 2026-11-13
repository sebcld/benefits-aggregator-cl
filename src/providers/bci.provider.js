// BCI: API BFF de BCI Plus, paginada de 100 en 100. Requiere BCI_SUBSCRIPTION_KEY.
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { ProviderError } = require('../domain/errors');
const { cleanText } = require('../shared/text');

const NAME = 'BCI';
const BASE_URL = 'https://api.bciplus.cl/bff-loyalty-beneficios/v1/offers';
const LIST_URL = 'https://www.bci.cl/beneficios/beneficios-bci';
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 150;

/** Ficha del beneficio en bci.cl: /beneficios/beneficios-bci/detalle/<slug>. */
function bciDetailUrl(slug) {
  return `${LIST_URL}/detalle/${encodeURIComponent(slug)}`;
}

// En BCI, "titulo" describe el beneficio ("Las Condes y Vitacura", "Tienda presencial - ...") y el
// comercio viene aparte. Para que la tarjeta muestre el comercio (como Santander o Copec Pay):
//   title       = comercio.nombre      ("Ansaldo")
//   subtitle    = titulo de la oferta  ("Tienda presencial - Juguetes y articulos ...")
//   description = subtitulo + descripcion (el subtitulo es la condicion de tarjeta:
//                 "Exclusivo con tus tarjetas de Credito Bci.")
// El link va a la ficha del beneficio en bci.cl (no al sitio del comercio, que trae "link").
function parseBciOffer(offer) {
  const tagsText = (offer?.tags || []).map((t) => t?.nombre || '').join(' ');
  const commerceName = cleanText(offer?.comercio?.nombre);
  const offerTitle = cleanText(offer?.titulo);
  const condition = cleanText(offer?.subtitulo);
  const description = cleanText(offer?.descripcion);
  const slug = offer?.slug?.trim() || '';

  return createEntry(
    {
      bank: NAME,
      title: commerceName || offerTitle,
      subtitle: commerceName ? offerTitle : condition,
      description: commerceName && condition ? cleanText(`${condition} ${description}`) : description,
      url: slug ? bciDetailUrl(slug) : offer?.link?.trim() || LIST_URL,
      slug,
      commerceName,
      keywords: cleanText(offer?.keywords),
      tagsText,
    },
    { sourceId: offer?.id, logo: offer?.imagenes?.imagen4 },
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

module.exports = { provider, parseBciOffer, bciDetailUrl };
