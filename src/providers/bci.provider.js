// BCI: API BFF de BCI Plus, paginada de 100 en 100. Requiere BCI_SUBSCRIPTION_KEY.
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { ProviderError } = require('../domain/errors');
const { cleanText } = require('../shared/text');
const { todayInChile } = require('../shared/dates');
const { formatWeekdays } = require('../shared/weekdays');

const NAME = 'BCI';
const BASE_URL = 'https://api.bciplus.cl/bff-loyalty-beneficios/v1/offers';
const LIST_URL = 'https://www.bci.cl/beneficios/beneficios-bci';
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 150;

/** Ficha del beneficio en bci.cl: /beneficios/beneficios-bci/detalle/<slug>. */
function bciDetailUrl(slug) {
  return `${LIST_URL}/detalle/${encodeURIComponent(slug)}`;
}

const thousands = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const percentText = (n) => `${Math.round(n * 10) / 10}%`;

/**
 * Descuento principal desde los datos estructurados de la oferta (el texto no siempre lo dice:
 * "50 por ciento"). deal.discount.percentage viene en puntos (30 = 30%); deal.cashback.percentage,
 * como fraccion (0.07 = 7%), con su tope en pesos.
 */
function readDeal(offer) {
  const deal = offer?.deal || {};
  const percentage = Number(deal.discount?.percentage ?? offer?.beneficio?.discount?.porcentajeDescuento);
  if (percentage > 0 && percentage <= 100) return { discount: percentText(percentage), discountCap: '' };

  const cashback = deal.cashback || deal.total?.cashback;
  const fraction = Number(cashback?.percentage);
  if (fraction > 0) {
    const points = fraction <= 1 ? fraction * 100 : fraction;
    const cap = Number(cashback.tope);
    return { discount: `${percentText(points)} cashback`, discountCap: cap > 0 ? `$${thousands(cap)}` : '' };
  }
  return { discount: '', discountCap: '' };
}

// fechaTermino es un instante UTC: "2027-01-01T02:59:00.000Z" es el 31-12-2026 a las 23:59 en Chile.
// Se resta 1 minuto para que un termino a medianoche exacta ("...T04:00Z" en invierno) cuente
// como el dia anterior, que es el ultimo en que el beneficio aplica.
function chileDate(iso, { endOfRange = false } = {}) {
  const ms = Date.parse(iso || '');
  if (Number.isNaN(ms)) return '';
  return todayInChile(new Date(endOfRange ? ms - 60_000 : ms));
}

/**
 * Vigencia en hora de Chile. Sin fecha de termino (tieneFechaTermino false) no hay "hasta"; una
 * vigencia ya vencida no se publica (con "today" vacio no se compara).
 */
function readValidity(offer, today) {
  const validUntil = offer?.tieneFechaTermino === false ? '' : chileDate(offer?.fechaTermino, { endOfRange: true });
  if (!validUntil || (today && validUntil < today)) return { validFrom: '', validUntil: '' };
  return { validFrom: chileDate(offer?.fechaInicio), validUntil };
}

// En BCI, "titulo" describe el beneficio ("Las Condes y Vitacura", "Tienda presencial - ...") y el
// comercio viene aparte. Para que la tarjeta muestre el comercio (como Santander o Copec Pay):
//   title       = comercio.nombre      ("Ansaldo")
//   subtitle    = titulo de la oferta  ("Tienda presencial - Juguetes y articulos ...")
//   description = subtitulo + descripcion (el subtitulo es la condicion de tarjeta:
//                 "Exclusivo con tus tarjetas de Credito Bci.")
// El link va a la ficha del beneficio en bci.cl (no al sitio del comercio, que trae "link").
// Del dato estructurado salen el descuento (deal), la vigencia (fechaInicio/fechaTermino) y los
// dias (scheduling.dayRecurrence), que la tarjeta muestra en pildoras.
// "today" (YYYY-MM-DD, Chile) descarta una vigencia vencida; vacio = no se compara.
function parseBciOffer(offer, { today = '' } = {}) {
  const tagsText = (offer?.tags || []).map((t) => t?.nombre || '').join(' ');
  const commerceName = cleanText(offer?.comercio?.nombre);
  const offerTitle = cleanText(offer?.titulo);
  const condition = cleanText(offer?.subtitulo);
  const description = cleanText(offer?.descripcion);
  const slug = offer?.slug?.trim() || '';
  const { discount, discountCap } = readDeal(offer);
  const { validFrom, validUntil } = readValidity(offer, today);

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
      validFrom,
      validUntil,
      discount,
      discountCap,
      schedule: offer?.scheduling?.isRecurrent === false ? '' : formatWeekdays(offer?.scheduling?.dayRecurrence),
    },
    { sourceId: offer?.id, logo: offer?.imagenes?.imagen4 },
  );
}

const provider = defineProvider({
  key: 'bci',
  name: NAME,
  async fetch({ http, config, now, sleep, signal }) {
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

    const today = todayInChile(now());
    return offers.map((offer) => parseBciOffer(offer, { today }));
  },
});

module.exports = { provider, parseBciOffer, bciDetailUrl };
