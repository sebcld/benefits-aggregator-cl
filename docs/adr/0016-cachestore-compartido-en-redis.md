# 0016. `CacheStore` compartido en Redis

- **Estado:** **Propuesto** (no implementado)
- **Fecha:** 2026-11-12
- **Relación:** extiende [0007](0007-cache-en-memoria-detras-de-cachestore.md); sería una excepción a [0002](0002-node-nativo-sin-dependencias-y-commonjs.md)

## Contexto

`createMemoryCacheStore` vive dentro del proceso. Con N instancias de la API, cada una descarga los catálogos por su cuenta: N veces la carga sobre las fuentes y N caches frías después de cada despliegue. El contrato `CacheStore` ya es asíncrono y se inyecta con `createApp({ cache })`, así que reemplazarlo no requiere tocar los servicios.

## Alternativas consideradas

1. **Mantener la caché en memoria con una sola instancia.**
   - Pros: sin dependencias ni infraestructura.
   - Contras: no escala horizontalmente y se pierde en cada reinicio.
2. **Redis con un cliente oficial** (por ejemplo, el paquete `redis`).
   - Pros: caché compartida y persistente entre reinicios, con TTL nativo (`SET key value PX ttl`).
   - Contras: es la primera dependencia de runtime, y hay que operar Redis (o pagarlo administrado).
3. **Cliente Redis mínimo propio** (protocolo RESP sobre `net`).
   - Pros: respeta "sin dependencias".
   - Contras: es código de red delicado de mantener (reconexión, pipelining). No se recomienda.
4. **Caché HTTP delante de la API** (CDN cacheando `GET /v1/search`).
   - Pros: no toca el backend.
   - Contras: cachea por URL, así que cada consulta distinta vuelve a descargar todos los catálogos. El problema de fondo no se resuelve.

## Recomendación

**Opción 1 mientras haya una sola instancia. La opción 2 cuando se necesite más de una,** aprobando explícitamente la dependencia como excepción a [0002](0002-node-nativo-sin-dependencias-y-commonjs.md). Para implementarla:
- crear `src/shared/cache/redis-cache-store.js` que cumpla `assertCacheStore`, serializando los `Entry` como JSON (son objetos planos);
- usar `CACHE_STORE=memory|redis` y `REDIS_URL` en la config;
- elegir el store en `bootstrap.js` (`resolveCache`).

## Consecuencias si se aprueba

- **Positivas:**
  - Una sola descarga por emisor para todas las instancias.
  - La caché sobrevive a los despliegues.
  - Habilita un job de warm-up central ([0017](0017-warm-up-programado-y-stale-while-revalidate.md)).
- **Negativas:**
  - Una dependencia más y un servicio que monitorear.
  - Al leer de Redis, los `Entry` llegan como objetos nuevos (ya no congelados): habría que volver a congelarlos o aceptar el cambio.
  - Aparece latencia de red en cada lectura de caché, aunque sea de pocos milisegundos.
