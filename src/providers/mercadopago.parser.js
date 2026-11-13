// Parser de las landings de beneficios de Mercado Pago (funciones puras, sin red).
//
// Las landings se renderizan en el servidor (plataforma "Nordic") y no llaman a ninguna API JSON:
// los datos vienen incrustados en el HTML como estado serializado, en _n.ctx.s["nr"].q("...").
// Ese estado es casi JSON, salvo tres marcas propias: u (undefined), @N (referencia a otro
// objeto) y D"..." (fecha). Se convierte a JSON y se leen sus secciones:
//   - lista:   seccion "filtered-cards-section" -> config.cards.items (una tarjeta por beneficio)
//   - detalle: seccion "image-text-section" (descuento y condicion) y "tyc-section" (terminos)
const { ProviderError } = require('../domain/errors');
const { cleanText } = require('../shared/text');
const { parseDmyDate } = require('../shared/dates');

const STATE_CHUNK = /_n\.ctx\.s\["nr"\]\.q\(("(?:[^"\\]|\\.)*")\)/g;
const isWordChar = (c) => /[A-Za-z0-9_$]/.test(c || '');

/** Convierte el estado serializado de Nordic a un objeto (solo toca lo que esta fuera de strings). */
function nordicToJson(text) {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === 'u' && !isWordChar(text[i - 1]) && !isWordChar(text[i + 1])) {
      out += 'null';
    } else if (c === '@' && /\d/.test(text[i + 1] || '')) {
      while (/\d/.test(text[i + 1] || '')) i += 1;
      out += 'null';
    } else if (!(c === 'D' && text[i + 1] === '"' && !isWordChar(text[i - 1]))) {
      out += c;
    }
  }
  return JSON.parse(out);
}

/** Estado incrustado de una landing. Lanza INVALID_RESPONSE si la pagina no lo trae. */
function decodeState(html, label = 'Mercado Pago') {
  const chunks = [...String(html).matchAll(STATE_CHUNK)].map((m) => JSON.parse(m[1]));
  if (!chunks.length) {
    throw new ProviderError(`${label}: la pagina no trae el estado de la landing`, { code: 'INVALID_RESPONSE' });
  }
  try {
    return nordicToJson(chunks.join(''));
  } catch (err) {
    throw new ProviderError(`${label}: estado de la landing ilegible (${err.message})`, { code: 'INVALID_RESPONSE' });
  }
}

/** Todas las secciones de un tipo ("filtered-cards-section", "tyc-section", ...). */
function findSections(state, type) {
  const found = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === type && node.config) found.push(node);
    for (const value of Object.values(node)) walk(value);
  })(state);
  return found;
}

/** "https://mercadopago.cl/landing/x" -> "https://www.mercadopago.cl/landing/x". */
function normalizeUrl(href) {
  try {
    const url = new URL(href);
    if (url.hostname === 'mercadopago.cl') url.hostname = 'www.mercadopago.cl';
    return url.toString();
  } catch {
    return '';
  }
}

/** Tarjetas de la landing de lista: los beneficios activos que muestra la pagina. */
function parseCards(state) {
  return findSections(state, 'filtered-cards-section')
    .flatMap((section) => section.config?.cards?.items || [])
    .filter((card) => cleanText(card?.title))
    .map((card) => ({
      title: cleanText(card.title),
      description: cleanText(card.description),
      highlight: cleanText(card.highlight),
      category: [].concat(card.filters || []).filter((f) => typeof f === 'string' && f !== 'pill').join(', '),
      image: card.image?.src || '',
      url: normalizeUrl(card.link?.href || ''),
    }));
}

/** Landing de detalle: descuento ("15% OFF presencial"), condicion y link a los terminos. */
function parseDetail(state) {
  const head = findSections(state, 'image-text-section')[0]?.config?.head || {};
  const tycItems = findSections(state, 'tyc-section').flatMap((s) => s.config?.items || []);
  const termsUrl = tycItems.map((it) => /href="([^"]+)"/.exec(String(it?.text || ''))?.[1]).find(Boolean) || '';
  return {
    headline: cleanText(head.title),
    offer: cleanText(head.volanta),
    condition: cleanText(head.description),
    termsUrl,
  };
}

/** Terminos de la campana (api.mercadopago.com/v2/discounts/campaign/<id>/terms/html). */
const isCampaignTerms = (url) => /^https:\/\/api\.mercadopago\.com\/v\d+\/discounts\/campaign\/\d+\/terms\/html$/.test(url || '');

const VALIDITY = /(?:desde el|del)\s+(\d{1,2}\/\d{1,2}\/\d{4})[^;]*?(?:hasta el|al)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;
// "El tope de descuento es de hasta CLP $5.000." / "El límite de devolución es de $ 10.000 por..."
// [^.$]*? impide saltar a otra oracion (en Lipigas el tope son "dos cargas", sin monto).
const CAP = /\b(tope|l[ií]mite)\s+de\s+(descuento|devoluci[oó]n)\b[^.$]*?\$\s?(\d{1,3}(?:\.\d{3})+|\d+)/i;

/** Vigencia, tope y tarjeta desde el texto de los terminos. Cada dato es opcional. */
function parseTerms(html) {
  const text = cleanText(html);
  const validity = VALIDITY.exec(text);
  const cap = CAP.exec(text);
  return {
    validFrom: validity ? parseDmyDate(validity[1]) : '',
    validUntil: validity ? parseDmyDate(validity[2]) : '',
    cap: cap ? { kind: cap[2].toLowerCase().replace('devolucion', 'devolución'), amount: `$${cap[3]}` } : null,
    physical: /tarjeta (?:de )?prepago f[ií]sica|f[ií]sica o nfc/i.test(text),
    virtual: /tarjeta (?:de )?prepago virtual|tarjeta virtual/i.test(text),
  };
}

/**
 * Tipo de tarjeta: lo que dice la tarjeta de la lista ("TARJETA VIRTUAL") mas lo que precisan los
 * terminos. Todas son la Tarjeta Mercado Pago prepago (es la landing de la tarjeta prepago).
 */
function cardTypeLabel(highlight, terms) {
  const physical = /f[ií]sica/i.test(highlight) || Boolean(terms?.physical);
  const virtual = /virtual/i.test(highlight) || Boolean(terms?.virtual);
  if (physical && virtual) return 'Tarjeta prepago física y virtual';
  if (physical) return 'Tarjeta prepago física';
  if (virtual) return 'Tarjeta prepago virtual';
  return 'Tarjeta prepago Mercado Pago';
}

module.exports = { nordicToJson, decodeState, findSections, normalizeUrl, parseCards, parseDetail, isCampaignTerms, parseTerms, cardTypeLabel };
