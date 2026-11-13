// Contrato comun de los providers (un modulo por emisor).
//
// Un provider es un objeto { key, name, fetch(ctx) } donde fetch devuelve el catalogo completo del
// emisor (Promise<Entry[]>). No usa fetch/Date/process.env directamente: todo llega en "ctx".

/**
 * @typedef {object} ProviderContext
 * @property {ReturnType<import('../shared/http-client').createHttpClient>} http
 * @property {object} config         configuracion (ver src/config)
 * @property {() => Date} now        reloj inyectable
 * @property {(ms: number, signal?: AbortSignal) => Promise<void>} sleep
 * @property {AbortSignal} [signal]  se aborta si el emisor excede su tiempo limite
 * @property {object} [options]      opciones propias del emisor (ej. { includeInactive })
 * @property {object} logger
 */

/**
 * @typedef {object} Provider
 * @property {string} key             identificador tecnico estable ("copec")
 * @property {string} name            nombre visible y valor de "bank" ("Copec Pay")
 * @property {(ctx: ProviderContext) => Promise<import('../domain/entry').Entry[]>} fetch
 */

const KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

function assertProvider(provider) {
  const problems = [];
  if (!provider || typeof provider !== 'object') problems.push('debe ser un objeto');
  else {
    if (!KEY_PATTERN.test(provider.key || '')) problems.push('"key" debe ser kebab-case');
    if (typeof provider.name !== 'string' || !provider.name) problems.push('"name" es obligatorio');
    if (typeof provider.fetch !== 'function') problems.push('"fetch" debe ser una funcion');
  }
  if (problems.length) {
    throw new TypeError(`Provider invalido (${provider?.key || '?'}): ${problems.join(', ')}`);
  }
  return provider;
}

// Declara un provider validando el contrato.
const defineProvider = (definition) => Object.freeze(assertProvider({ ...definition }));

module.exports = { defineProvider, assertProvider };
