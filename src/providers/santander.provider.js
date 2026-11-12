// Santander: JSON publico con todo el catalogo en una sola llamada.
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { cleanText } = require('../shared/text');

const NAME = 'Santander';
const URL = 'https://banco.santander.cl/beneficios/promociones.json?per_page=9999&custom_fields=true';

function parseSantander(data) {
  const promos = data?.promociones || [];

  return promos.map((item) => {
    const subtitle =
      item?.custom_fields?.['Bajada externa']?.value ||
      item?.custom_fields?.['Bajada interna']?.value ||
      '';

    return createEntry(
      {
        bank: NAME,
        title: item?.title?.trim() || '',
        subtitle: cleanText(subtitle),
        description: cleanText(item?.description),
        commerceName: cleanText(item?.title),
        slug: item?.slug || '',
        tagsText: (item?.tags || []).join(' '),
        url: item?.url || '',
      },
      { sourceId: item?.id, logo: item?.covers?.[0] },
    );
  });
}

const provider = defineProvider({
  key: 'santander',
  name: NAME,
  async fetch({ http, signal }) {
    const data = await http.getJson(URL, { label: NAME, signal });
    return parseSantander(data);
  },
});

module.exports = { provider, parseSantander };
