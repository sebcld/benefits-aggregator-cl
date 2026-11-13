// Mercado Pago: beneficios de la Tarjeta Mercado Pago (prepago), desde
// https://www.mercadopago.cl/landing/beneficios-tarjeta-prepago.
//
// No hay una API JSON publica: la pagina se renderiza en el servidor y trae los datos incrustados
// (ver mercadopago.parser.js). Se leen 3 niveles, todo en paralelo despues de la lista:
//   1. landing de la lista       -> los beneficios activos (titulo, descripcion, tarjeta, categoria)
//   2. landing de cada beneficio -> descuento, condicion y link a los terminos (id de campana)
//   3. terminos de la campana    -> vigencia, tope y tipo de tarjeta exacto
// 2 y 3 son opcionales: si fallan, el beneficio igual se devuelve con los datos de la lista.
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { cleanText } = require('../shared/text');
const { todayInChile } = require('../shared/dates');
const parser = require('./mercadopago.parser');

const NAME = 'Mercado Pago';
const LIST_URL = 'https://www.mercadopago.cl/landing/beneficios-tarjeta-prepago';
// Con un user-agent que no parece de navegador, la landing responde sin el estado incrustado.
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  'accept-language': 'es-CL,es;q=0.9',
};

const sentence = (text) => (text && !/[.!?]$/.test(text) ? `${text}.` : text);
const lastPathSegment = (url) => url.split('?')[0].replace(/\/+$/, '').split('/').pop() || '';

/**
 * Arma el Entry de un beneficio. "today" (YYYY-MM-DD, Chile) descarta una vigencia ya vencida:
 * la landing sigue mostrando el beneficio como activo, asi que se publica sin fecha.
 */
function buildMercadoPagoEntry({ card, detail = null, terms = null, today }) {
  const cardType = parser.cardTypeLabel(card.highlight, terms);
  const cap = terms?.cap ? `${terms.cap.amount}` : '';
  const capSentence = terms?.cap ? `Tope de ${terms.cap.kind}: ${terms.cap.amount}.` : '';
  const current = terms?.validUntil && terms.validUntil >= today;

  return createEntry(
    {
      bank: NAME,
      title: card.title,
      subtitle: card.description,
      description: cleanText([sentence(detail?.condition || ''), capSentence].join(' ')) || card.description,
      url: card.url || LIST_URL,
      slug: lastPathSegment(card.url),
      commerceName: card.title,
      keywords: cleanText([detail?.offer, detail?.headline, cardType].join(' ')),
      tagsText: card.highlight,
      category: card.category,
      validFrom: current ? terms.validFrom : '',
      validUntil: current ? terms.validUntil : '',
      cardType,
      discountCap: cap,
      termsUrl: detail?.termsUrl || '',
    },
    { sourceId: card.url || card.title, logo: card.image },
  );
}

// Un fallo en el detalle o en los terminos no debe tumbar el emisor completo.
const optional = (promise) => promise.catch(() => null);

const provider = defineProvider({
  key: 'mercadopago',
  name: NAME,
  async fetch({ http, now, signal }) {
    const get = (url) => http.getText(url, { label: NAME, headers: HEADERS, signal });
    const cards = parser.parseCards(parser.decodeState(await get(LIST_URL), NAME));
    const today = todayInChile(now());

    return Promise.all(
      cards.map(async (card) => {
        const detail = card.url ? await optional(get(card.url).then((html) => parser.parseDetail(parser.decodeState(html, NAME)))) : null;
        const terms = parser.isCampaignTerms(detail?.termsUrl) ? await optional(get(detail.termsUrl).then(parser.parseTerms)) : null;
        return buildMercadoPagoEntry({ card, detail, terms, today });
      }),
    );
  },
});

module.exports = { provider, buildMercadoPagoEntry, LIST_URL };
