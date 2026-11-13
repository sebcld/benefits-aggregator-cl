// Registro de providers. Agregar un emisor = crear su archivo y sumarlo a esta lista.
// El orden de la lista es el orden de los resultados.
const { assertProvider } = require('./provider.interface');

const DEFAULT_PROVIDERS = [
  require('./santander.provider').provider,
  require('./bci.provider').provider,
  require('./tenpo.provider').provider,
  require('./tapp.provider').provider,
  require('./copec.provider').provider,
  require('./bancochile.provider').provider,
  require('./mercadopago.provider').provider,
  require('./entel.provider').provider,
];

/**
 * @param {import('./provider.interface').Provider[]} [providers]
 */
function createProviderRegistry(providers = DEFAULT_PROVIDERS) {
  const keys = new Set();
  const names = new Set();
  for (const provider of providers) {
    assertProvider(provider);
    const name = provider.name.toLowerCase();
    if (keys.has(provider.key) || names.has(name)) {
      throw new TypeError(`Provider duplicado: ${provider.key} / ${provider.name}`);
    }
    keys.add(provider.key);
    names.add(name);
  }

  const list = () => [...providers];
  const get = (key) => providers.find((p) => p.key === key) || null;

  // Busca por nombre visible ("Copec Pay") y, si allowKeys, tambien por key ("copec").
  const find = (value, { allowKeys = false } = {}) => {
    const needle = String(value || '').trim().toLowerCase();
    return (
      providers.find((p) => p.name.toLowerCase() === needle || (allowKeys && p.key === needle)) ||
      null
    );
  };

  // Providers incluidos segun "banks" (sin distinguir mayusculas). Vacio = todos.
  const select = (banks, options) => {
    if (!banks || !banks.length) return list();
    const wanted = new Set(banks.map((b) => find(b, options)).filter(Boolean));
    return providers.filter((p) => wanted.has(p));
  };

  return { list, get, find, select };
}

module.exports = { createProviderRegistry, DEFAULT_PROVIDERS };
