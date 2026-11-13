// Regla de coincidencia del buscador. Insensible a mayusculas, tildes y puntuacion.
const { escapeRegex, normalize } = require('../shared/text');
const { categoryFor } = require('./search-categories');

// Campos del Entry donde se busca. "category" no participa (Copec la copia en keywords).
const SEARCH_FIELDS = ['title', 'subtitle', 'description', 'slug', 'keywords', 'commerceName', 'tagsText'];

// Marcas escritas juntas con mayuscula interna: "FlixBus" -> "Flix Bus", "PedidosYa" -> "Pedidos Ya".
const CAMEL_BOUNDARY = /(\p{Ll})(\p{Lu})/gu;
const splitCompound = (text) => text.replace(CAMEL_BOUNDARY, '$1 $2');

/** Texto normalizado de un campo; si tiene palabras compuestas, tambien con ellas separadas. */
function searchableText(field) {
  const text = String(field);
  const plain = normalize(text);
  const split = normalize(splitCompound(text));
  return split === plain ? plain : `${plain} ${split}`;
}

/**
 * Reglas, sobre texto ya normalizado:
 * - una palabra de 4 letras o menos: solo palabra completa (evita "bci" dentro de otra palabra).
 *   Las marcas compuestas cuentan como dos palabras: "flix" y "bus" encuentran "FlixBus";
 * - una palabra mas larga: palabra completa o substring ignorando espacios ("burgerking");
 * - varias palabras: substring, substring sin espacios o palabra completa.
 */
function matchesText(haystack, target) {
  if (!target) return false;
  const boundaryMatch = new RegExp(`\\b${escapeRegex(target)}\\b`).test(haystack);
  const compactMatch = () => haystack.replace(/\s+/g, '').includes(target.replace(/\s+/g, ''));

  if (!target.includes(' ')) {
    return target.length <= 4 ? boundaryMatch : boundaryMatch || compactMatch();
  }
  return haystack.includes(target) || compactMatch() || boundaryMatch;
}

const withoutPhrases = (haystack, phrases) =>
  phrases.reduce((text, phrase) => text.replace(new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'g'), ' '), haystack);

/**
 * Coincide con la consulta o, si la consulta es una categoria ("taxi", "bus", "gas"), con alguno de
 * sus comercios (ver search-categories.js).
 * @param {import('../domain/entry').Entry} entry
 * @param {string} query
 */
const matchesQuery = (entry, query) => {
  const target = normalize(query);
  const haystack = SEARCH_FIELDS.map((field) => entry[field])
    .filter(Boolean)
    .map(searchableText)
    .join(' ');

  if (matchesText(haystack, target)) return true;

  const category = categoryFor(target);
  if (!category) return false;
  const relevant = withoutPhrases(haystack, category.ignore);
  return category.terms.some((term) => matchesText(relevant, term));
};

module.exports = { matchesQuery, SEARCH_FIELDS };
