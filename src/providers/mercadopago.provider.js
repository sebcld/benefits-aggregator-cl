// Mercado Pago: busqueda de productos de Mercado Libre (no es un catalogo de beneficios).
// Sin token responde 403; queda en "errors" y la busqueda continua.
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { cleanText } = require('../shared/text');

const NAME = 'Mercado Pago';
const SEARCH_URL = 'https://api.mercadolibre.com/sites/MLC/search';
const LIMIT = 50;

function parseMercadoPago(data) {
  const items = data?.results || [];

  return items.map((item) =>
    createEntry(
      {
        bank: NAME,
        title: item?.title || '',
        subtitle: item?.price ? `CLP ${item.price}` : '',
        description: cleanText(item?.subtitle || item?.title),
        url: item?.permalink || '',
        commerceName: cleanText(item?.seller?.nickname || ''),
        slug: item?.id || '',
        keywords: cleanText(item?.category_id || ''),
      },
      { sourceId: item?.id, logo: item?.thumbnail },
    ),
  );
}

const provider = defineProvider({
  key: 'mercadopago',
  name: NAME,
  queryDependent: true,
  async fetch({ http, config, query, signal }) {
    if (!query) return [];

    const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&limit=${LIMIT}`;
    const headers = { accept: 'application/json' };
    if (config.mercadoPagoToken) headers.Authorization = `Bearer ${config.mercadoPagoToken}`;

    const data = await http.getJson(url, { label: NAME, headers, signal });
    return parseMercadoPago(data);
  },
});

module.exports = { provider, parseMercadoPago };
