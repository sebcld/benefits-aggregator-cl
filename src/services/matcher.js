// Regla de coincidencia del buscador. Insensible a mayusculas, tildes y puntuacion.
const { escapeRegex, normalize } = require('../shared/text');

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
 * Reglas:
 * - una palabra de 4 letras o menos: solo palabra completa (evita "bci" dentro de otra palabra).
 *   Las marcas compuestas cuentan como dos palabras: "flix" y "bus" encuentran "FlixBus";
 * - una palabra mas larga: palabra completa o substring ignorando espacios ("burgerking");
 * - varias palabras: substring, substring sin espacios o palabra completa.
 * @param {import('../domain/entry').Entry} entry
 * @param {string} query
 */
const matchesQuery = (entry, query) => {
  const target = normalize(query);
  const haystack = SEARCH_FIELDS.map((field) => entry[field])
    .filter(Boolean)
    .map(searchableText)
    .join(' ');

  const targetCompact = target.replace(/\s+/g, '');
  const haystackCompact = haystack.replace(/\s+/g, '');

  const boundaryMatch = target ? new RegExp(`\\b${escapeRegex(target)}\\b`).test(haystack) : false;

  const isSingleWord = !target.includes(' ');

  if (isSingleWord) {
    if (target.length <= 4) {
      return boundaryMatch;
    }
    return boundaryMatch || haystackCompact.includes(targetCompact);
  }

  return haystack.includes(target) || haystackCompact.includes(targetCompact) || boundaryMatch;
};

module.exports = { matchesQuery, SEARCH_FIELDS };
