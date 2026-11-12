// Modelo de dominio Entry: un beneficio normalizado, igual para todos los emisores.
const crypto = require('crypto');

/**
 * @typedef {object} Entry
 * @property {string} bank          Nombre visible del emisor ("Copec Pay")
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} [description] Texto plano, sin HTML
 * @property {string} [url]
 * @property {string} [slug]
 * @property {string} [commerceName]
 * @property {string} [keywords]    Texto extra para la busqueda
 * @property {string} [tagsText]    Tags para la busqueda
 * @property {string} [category]    Categorias separadas por coma (hoy solo Copec Pay)
 * @property {string} [validFrom]   YYYY-MM-DD (hoy solo Copec Pay)
 * @property {string} [validUntil]  YYYY-MM-DD (hoy solo Copec Pay)
 * @property {string} id            Identificador estable (derivado del id de la fuente)
 * @property {string} [logo]        URL de logo o imagen, si la fuente la entrega
 */

const TEXT_FIELDS = [
  'bank',
  'title',
  'subtitle',
  'description',
  'url',
  'slug',
  'commerceName',
  'keywords',
  'tagsText',
  'category',
  'validFrom',
  'validUntil',
];

// Campos agregados por el refactor. La forma historica (API legada, CLI, fachada) no los expone.
const INTERNAL_FIELDS = ['id', 'logo'];

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// "<emisor>-<hash>": estable mientras la fuente mantenga su id (o la URL/titulo si no tiene id).
function buildEntryId(bank, sourceId) {
  const hash = crypto.createHash('sha1').update(`${bank}|${sourceId}`).digest('hex').slice(0, 12);
  return `${slugify(bank)}-${hash}`;
}

/**
 * Crea un Entry validado e inmutable. Conserva el orden de claves recibido (la salida historica
 * depende de el) y agrega "id" y, si existe, "logo" al final.
 * @param {Partial<Entry>} fields
 * @param {{ sourceId?: string|number, logo?: string }} [meta]
 * @returns {Entry}
 */
function createEntry(fields, { sourceId, logo } = {}) {
  if (!fields || typeof fields.bank !== 'string' || !fields.bank) {
    throw new TypeError('Entry invalido: "bank" es obligatorio');
  }
  for (const [key, value] of Object.entries(fields)) {
    if (TEXT_FIELDS.includes(key) && typeof value !== 'string') {
      throw new TypeError(`Entry invalido: "${key}" debe ser texto (${fields.bank})`);
    }
  }

  const identity = sourceId !== undefined && sourceId !== null && sourceId !== '' ? sourceId : null;
  const entry = {
    ...fields,
    id: buildEntryId(fields.bank, identity ?? `${fields.url || ''}|${fields.slug || ''}|${fields.title}`),
  };
  if (logo) entry.logo = logo;
  // Inmutable: la cache comparte los mismos objetos entre peticiones.
  return Object.freeze(entry);
}

// Forma historica del Entry (sin los campos agregados por el refactor).
function toLegacyEntry(entry) {
  const legacy = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!INTERNAL_FIELDS.includes(key)) legacy[key] = value;
  }
  return legacy;
}

module.exports = { createEntry, toLegacyEntry, buildEntryId, TEXT_FIELDS, INTERNAL_FIELDS };
