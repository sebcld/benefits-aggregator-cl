// CacheStore en memoria del proceso, con TTL por clave y tope de entradas.
// Adecuado para una sola instancia; con varias instancias usar un almacen compartido.
const { assertCacheStore } = require('./cache-store');

/**
 * @param {object} [options]
 * @param {() => number} [options.now]  reloj en ms (inyectable en tests)
 * @param {number} [options.maxEntries] al superarlo se descarta la entrada mas antigua
 */
function createMemoryCacheStore({ now = () => Date.now(), maxEntries = 500 } = {}) {
  const store = new Map();

  const isExpired = (item) => item.expiresAt <= now();

  const cache = {
    async get(key) {
      const item = store.get(key);
      if (!item) return undefined;
      if (isExpired(item)) {
        store.delete(key);
        return undefined;
      }
      return item.value;
    },

    async set(key, value, ttlMs) {
      if (!(ttlMs > 0)) return;
      store.delete(key); // reinsertar deja la clave como la mas reciente
      store.set(key, { value, expiresAt: now() + ttlMs });
      while (store.size > maxEntries) store.delete(store.keys().next().value);
    },

    async delete(key) {
      store.delete(key);
    },

    async clear() {
      store.clear();
    },

    // Diagnostico (no es parte del contrato CacheStore).
    size: () => store.size,
  };

  return assertCacheStore(cache);
}

module.exports = { createMemoryCacheStore };
