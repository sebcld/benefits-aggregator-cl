// Contrato CacheStore. Es asincrono a proposito: una implementacion con Redis (u otro almacen
// compartido entre instancias) puede reemplazar a MemoryCacheStore sin tocar los servicios.
//
//   get(key)               -> Promise<any | undefined>   (undefined = no existe o vencio)
//   set(key, value, ttlMs) -> Promise<void>
//   delete(key)            -> Promise<void>
//   clear()                -> Promise<void>
//
// Los valores deben ser serializables a JSON si la implementacion es remota.

/** @typedef {{ get: Function, set: Function, delete: Function, clear: Function }} CacheStore */

const METHODS = ['get', 'set', 'delete', 'clear'];

function assertCacheStore(store) {
  const missing = METHODS.filter((m) => typeof store?.[m] !== 'function');
  if (missing.length) {
    throw new TypeError(`CacheStore invalido: faltan ${missing.join(', ')}`);
  }
  return store;
}

module.exports = { assertCacheStore, METHODS };
