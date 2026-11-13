// Categorias de busqueda: una consulta generica ("taxi", "bus", "gas") tambien encuentra los
// comercios de esa categoria ("Cabify", "Turbus", "Lipigas"), en todos los emisores.
//
// - aliases: consultas que activan la categoria. Se compara la consulta COMPLETA (ya normalizada),
//   asi que "taxi" la activa y "taxi aeropuerto" no.
// - terms:   comercios o palabras que cuentan como coincidencia. Se buscan con las mismas reglas
//   del matcher (una palabra de 4 letras o menos, solo completa: "uber" no encuentra "suberbio").
// - ignore:  frases que se quitan antes de buscar los terminos, para no confundir servicios
//   distintos de la misma marca ("uber eats" es delivery, no taxi).
//
// Para agregar una categoria o un comercio, basta con editar esta lista (y su test).
const { normalize } = require('../shared/text');

const CATEGORIES = [
  {
    name: 'gas',
    aliases: ['gas', 'gas licuado', 'cilindro de gas', 'cilindros de gas'],
    // "gasco" solo no: la comparacion sin espacios lo encuentra en "lo paGAS COn tu tarjeta".
    terms: ['gasconnect', 'lipigas', 'abastible'],
  },
  {
    name: 'buses',
    aliases: ['bus', 'buses', 'pasaje de bus', 'pasajes de bus'],
    // "pullman" solo no: tambien es una cadena de hoteles.
    terms: ['turbus', 'tur bus', 'kupos', 'flixbus', 'pullman bus', 'buses', 'condor bus'],
  },
  {
    name: 'taxi',
    aliases: ['taxi', 'taxis', 'radio taxi'],
    terms: ['cabify', 'uber', 'didi', 'indriver', 'transvip', 'taxi', 'taxis'],
    ignore: ['uber eats', 'didi food'],
  },
];

// Normalizado una sola vez: el matcher compara contra texto normalizado.
const BY_ALIAS = new Map();
for (const category of CATEGORIES) {
  const prepared = {
    name: category.name,
    terms: category.terms.map(normalize),
    ignore: (category.ignore || []).map(normalize),
  };
  for (const alias of category.aliases) BY_ALIAS.set(normalize(alias), prepared);
}

/** Categoria activada por una consulta ya normalizada, o null. */
const categoryFor = (normalizedQuery) => BY_ALIAS.get(normalizedQuery) || null;

module.exports = { CATEGORIES, categoryFor };
