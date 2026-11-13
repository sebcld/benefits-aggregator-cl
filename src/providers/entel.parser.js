// Parser del Club Entel (funciones puras, sin red).
//
// https://www.entel.cl/beneficios es un sitio Modyo que se renderiza en el servidor: no llama a
// ninguna API JSON (solo consentimiento de cookies y analitica) y su API de contenido no es
// publica. Los datos salen del HTML:
//   - lista:  una <ads-card-general> por tarjeta. Un beneficio aparece en varias secciones
//             (categorias y el banner principal), asi que se agrupa por el link de su ficha.
//   - ficha:  las condiciones estan en el modal "Información del beneficio", en secciones con
//             un titulo en <strong> ("Descuento Jueves") y una lista de condiciones.
const { ProviderError } = require('../domain/errors');
const { cleanText, decodeHtml } = require('../shared/text');

// Logo del comercio: misma URL que arma el componente <ads-icon-image eds-type="marcas"> del sitio.
const brandLogo = (name) => `https://entel.cdn.modyo.com/libraries/recursos/src/icon-lit/marcas/${name}.png`;

const CARD = /(?:<swiper-slide\b([^>]*)>\s*)?<ads-card-general\b[^>]*>([\s\S]*?)<\/ads-card-general>/g;

/** Primera etiqueta <tag ...> cuyo texto de apertura contiene "marker" (o la primera, sin marker). */
const findTag = (html, tag, marker = '') =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => m[0]).find((t) => t.includes(marker)) || '';

/** Valor de un atributo, con comillas simples o dobles (eds-data trae JSON entre comillas simples). */
function attr(tagHtml, name) {
  const match = tagHtml.match(new RegExp(`\\s${name}=(["'])([\\s\\S]*?)\\1`));
  return match ? decodeHtml(match[2]) : '';
}

function parseJsonAttr(value) {
  try {
    return JSON.parse(value.replace(/\r?\n/g, '\\n'));
  } catch {
    return null;
  }
}

// "**30% descuento** \n Todos los jueves" -> "30% descuento · Todos los jueves".
const cardText = (raw) =>
  (raw || '')
    .replace(/\*\*/g, '')
    .split(/\\n|\n/)
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(' · ');

// "Beneficios Comida" -> "Comida". El banner principal ("banner club entel") no es una categoria.
const categoryOf = (section) => (/^beneficios\s+/i.test(section || '') ? section.replace(/^beneficios\s+/i, '').trim() : '');

function readCard(slideAttrs, body) {
  const anchor = findTag(body, 'ads-anchor');
  const data = parseJsonAttr(attr(anchor, 'eds-data')) || {};
  const image = parseJsonAttr(attr(findTag(body, 'ads-image'), 'ads-sources'))?.[0]?.src || '';
  return {
    url: attr(anchor, 'eds-href'),
    title: cleanText(attr(findTag(body, 'ads-text', 'slot="title"'), 'eds-text') || data.title || ''),
    text: cardText(attr(findTag(body, 'ads-text', 'slot="text"'), 'eds-text') || data.description),
    category: categoryOf(data.section),
    days: attr(slideAttrs || '', 'data-tags')
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean),
    brand: attr(findTag(body, 'ads-icon-image', 'eds-type="marcas"'), 'eds-name'),
    image,
  };
}

/**
 * Beneficios de la pagina de lista, uno por ficha, en el orden en que aparecen por primera vez.
 * Lanza INVALID_RESPONSE si la pagina no trae tarjetas (cambio de formato o pagina de error).
 */
function parseList(html) {
  const byUrl = new Map();
  for (const [, slideAttrs, body] of String(html).matchAll(CARD)) {
    const card = readCard(slideAttrs, body);
    if (!card.url) continue;
    const seen = byUrl.get(card.url) || { url: card.url, title: '', text: '', categories: [], days: [], brand: '', image: '' };
    for (const key of ['title', 'text', 'brand', 'image']) seen[key] ||= card[key];
    if (card.category && !seen.categories.includes(card.category)) seen.categories.push(card.category);
    for (const day of card.days) if (!seen.days.includes(day)) seen.days.push(day);
    byUrl.set(card.url, seen);
  }
  if (byUrl.size === 0) {
    throw new ProviderError('Entel: la pagina de beneficios no trae tarjetas', { code: 'INVALID_RESPONSE' });
  }
  return [...byUrl.values()].map(({ brand, image, ...card }) => ({ ...card, logo: brand ? brandLogo(brand) : image }));
}

const MODAL = /<andino-modal-passive\b[^>]*eds-title=(["'])Información del beneficio\1[^>]*>([\s\S]*?)<\/andino-modal-passive>/;
// Un parrafo que es solo <strong>...</strong> es el titulo de una seccion de condiciones.
const HEADING = /<p\b[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/g;
const BLOCK_TAGS = /<\/?(?:p|li|ul|ol|div|br|h[1-6])\b[^>]*>/g;

/** Condiciones de la ficha: [{ heading, items }]. Vacio si la ficha no trae el modal. */
function parseDetail(html) {
  const modal = String(html).match(MODAL);
  if (!modal) return [];
  const lines = modal[2]
    .replace(HEADING, '\n##$1\n')
    .replace(BLOCK_TAGS, '\n')
    .split('\n')
    .map((line) => cleanText(line))
    .filter(Boolean);

  const sections = [];
  for (const line of lines) {
    if (line.startsWith('##') || !sections.length) sections.push({ heading: '', items: [] });
    const current = sections[sections.length - 1];
    if (line.startsWith('##')) current.heading = line.slice(2).replace(/[\s:]+$/, '').trim();
    // "1. ", "2.- ", "- ": la numeracion de la fuente no aporta.
    else current.items.push(line.replace(/^(?:\d+\s*[.)]-?|-)\s*/, ''));
  }
  return sections.filter((s) => s.heading || s.items.length);
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : '');
// "31-12-2026", "31/12/2026", "30 Abril 2026", "30 de abril de 2026".
const DATE = String.raw`(\d{1,2})(?:[-/](\d{1,2})[-/]|\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de(?:l)?\s+)?)(\d{4})`;
// "hasta el 31-12-2026" y el final de "del 03/02/2026 al 31/12/2026".
const UNTIL = new RegExp(String.raw`(?:hasta|\bal)\s+(?:el\s+)?(?:d[ií]a\s+)?${DATE}`, 'gi');
const FROM = new RegExp(String.raw`(?:desde|\bdel)\s+(?:el\s+)?(?:d[ií]a\s+)?${DATE}`, 'gi');

const toIso = ([, d, m, monthName, y]) => isoDate(Number(y), m ? Number(m) : MONTHS.indexOf((monthName || '').toLowerCase()) + 1, Number(d));
const datesIn = (text, re) => [...text.matchAll(re)].map(toIso).filter(Boolean).sort();

// "Tope de descuento por transacción: $15.000", "tope $4.000", "Tope 2.000". Se exige "$" o
// separador de miles para no confundir "tope de 4 entradas" con un monto.
const CAP = /\btope\b[^.$\d]{0,60}?(\$\s?\d{1,3}(?:\.\d{3})+|\$\s?\d+|\d{1,3}(?:\.\d{3})+)/i;

/** Vigencia y tope a partir del texto de las condiciones. La vigencia es la fecha "hasta" mas tardia. */
function readTerms(sections) {
  const text = sections.flatMap((s) => [s.heading, ...s.items]).join(' . ');
  const until = datesIn(text, UNTIL);
  const cap = text.match(CAP)?.[1].replace(/\s/g, '');
  return {
    validFrom: datesIn(text, FROM)[0] || '',
    validUntil: until[until.length - 1] || '',
    discountCap: cap ? `$${cap.replace(/^\$/, '')}` : '',
  };
}

module.exports = { parseList, parseDetail, readTerms, cardText, brandLogo };
