// Entel (Club Entel): beneficios para clientes Entel, desde https://www.entel.cl/beneficios.
//
// No hay API JSON: el sitio (Modyo) se renderiza en el servidor y la pagina no hace peticiones de
// datos (ver entel.parser.js). Se leen 2 niveles:
//   1. pagina de beneficios -> los 92 beneficios: comercio, descuento, dias, categorias, logo, ficha
//   2. ficha de cada uno    -> condiciones, vigencia y tope (de a 4 fichas a la vez)
// La ficha es opcional: si falla, el beneficio se devuelve igual con los datos de la lista.
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { cleanText } = require('../shared/text');
const { todayInChile } = require('../shared/dates');
const { mapWithLimit } = require('../shared/async');
const parser = require('./entel.parser');

const NAME = 'Entel';
const LIST_URL = 'https://www.entel.cl/beneficios';
const DETAIL_CONCURRENCY = 4;
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  'accept-language': 'es-CL,es;q=0.9',
};

const sentence = (text) => (text && !/[.!?:]$/.test(text) ? `${text}.` : text);
const lastPathSegment = (url) => url.split('?')[0].replace(/\/+$/, '').split('/').pop() || '';

// "Descuento Jueves: 30% de descuento todos los jueves. No acumulable con otras promociones."
const conditionsText = (sections) =>
  cleanText(sections.map((s) => [s.heading && `${s.heading}:`, ...s.items.map(sentence)].filter(Boolean).join(' ')).join(' '));

/**
 * Arma el Entry de un beneficio. "today" (YYYY-MM-DD, Chile) descarta una vigencia ya vencida: la
 * pagina sigue mostrando el beneficio, asi que se publica sin fecha en vez de ocultarlo.
 */
function buildEntelEntry({ card, sections = [], today }) {
  const terms = parser.readTerms(sections);
  const current = terms.validUntil && terms.validUntil >= today;
  return createEntry(
    {
      bank: NAME,
      title: card.title,
      subtitle: card.text,
      description: conditionsText(sections) || card.text,
      url: card.url,
      slug: lastPathSegment(card.url),
      commerceName: card.title,
      // Titulos de las secciones ("Descuento Jueves", "Usuarios nuevos"): ayudan a la busqueda.
      keywords: cleanText([...new Set(sections.map((s) => s.heading))].join(' ')),
      tagsText: card.days.join(', '),
      category: card.categories.join(', '),
      validFrom: current ? terms.validFrom : '',
      validUntil: current ? terms.validUntil : '',
      discountCap: terms.discountCap,
    },
    { sourceId: card.url, logo: card.logo },
  );
}

const provider = defineProvider({
  key: 'entel',
  name: NAME,
  async fetch({ http, now, signal }) {
    const get = (url) => http.getText(url, { label: NAME, headers: HEADERS, signal });
    const cards = parser.parseList(await get(LIST_URL));
    const today = todayInChile(now());

    return mapWithLimit(cards, DETAIL_CONCURRENCY, async (card) => {
      // Un fallo en una ficha no debe tumbar el emisor completo (pero si un aborto por timeout).
      const sections = await get(card.url)
        .then(parser.parseDetail)
        .catch((err) => {
          if (signal?.aborted) throw err;
          return [];
        });
      return buildEntelEntry({ card, sections, today });
    });
  },
});

module.exports = { provider, buildEntelEntry, LIST_URL };
