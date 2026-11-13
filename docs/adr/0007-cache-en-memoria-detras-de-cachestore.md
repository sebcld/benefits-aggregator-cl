# 0007. Caché en memoria por emisor detrás de `CacheStore`

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Relación:** depende de [0001](0001-arquitectura-por-capas-con-composition-root.md); acotado por [0008](0008-cli-y-fachada-sin-cache-ni-timeouts.md); lo extenderían [0016](0016-cachestore-compartido-en-redis.md) y [0017](0017-warm-up-programado-y-stale-while-revalidate.md)

## Contexto

Cada búsqueda descargaba los 7 emisores: unos 25 requests y entre 10 y 20 s (Banco de Chile tarda unos 16 s y BCI unos 8 s). Para una app móvil, esa latencia no es aceptable. Los catálogos cambian pocas veces al día.

## Alternativas consideradas

1. **Cachear las respuestas por consulta** (`q` + `banks`). Cada consulta distinta vuelve a descargar todo y las entradas de caché se multiplican.
2. **Base de datos con indexación periódica** (por ejemplo, SQLite). Cambia el modelo del sistema, que consulta en vivo y no tiene persistencia, y requiere dependencias y jobs.
3. **Caché del catálogo completo de cada emisor, detrás de un contrato asíncrono reemplazable** (elegida).

## Decisión

- **Contrato `CacheStore`** (`src/shared/cache/cache-store.js`): `get`, `set(key, value, ttlMs)`, `delete` y `clear`, todos asíncronos, para que una implementación remota (Redis) pueda reemplazarlo sin cambiar los servicios.
- **Implementación inicial:** `createMemoryCacheStore`, con TTL por clave y un tope de 500 entradas. Al superarlo, se descarta la entrada más antigua.
- **Qué se cachea:** el runner guarda el catálogo completo de cada emisor, con la clave `provider:<key>`, y todas las búsquedas lo reutilizan. Los errores nunca se cachean, y un catálogo vacío se guarda solo 1 minuto.
- **Deduplicación:** si llegan N peticiones simultáneas al mismo emisor, se hace una sola descarga.
- **Configuración:** `CACHE_TTL_SECONDS` (1800 por defecto; 0 la desactiva). `CACHE_WARMUP=true` descarga los catálogos al iniciar. `/v1/health?probe=true` hace lo mismo bajo demanda.
- **Antigüedad visible y actualización manual** (agregado después): cada catálogo se guarda con su fecha de descarga, que la API expone en `sources[].fetchedAt`. `/v1/search?refresh=true` vuelve a descargar solo los catálogos con al menos `CACHE_REFRESH_MIN_AGE_SECONDS` (300 por defecto), y `meta.refreshableAt` indica desde cuándo tiene efecto. Si esa descarga falla, se sigue usando el catálogo anterior. La web lo muestra como "Datos actualizados hace…" con un botón "Actualizar".

## Consecuencias

- **Positivas:**
  - Con la caché vigente, una búsqueda responde en milisegundos, incluso con consultas distintas.
  - Se reduce la carga sobre las fuentes y la exposición a sus límites de uso, como el de `r.jina.ai`.
- **Negativas:**
  - Los datos pueden tener hasta 30 min de antigüedad. Se puede forzar la actualización, pero como mucho una vez cada `CACHE_REFRESH_MIN_AGE_SECONDS` por emisor.
  - El filtro de vigencia de Copec Pay se aplica al descargar, así que un beneficio que vence a medianoche puede seguir apareciendo hasta 30 min (`docs/RIESGOS.md` #8).
  - La caché es por proceso: con varias instancias, cada una descarga todo por su cuenta ([0016](0016-cachestore-compartido-en-redis.md)).
  - El primer usuario tras un fallo de caché espera la descarga completa ([0017](0017-warm-up-programado-y-stale-while-revalidate.md)).

## Evidencia

- **Commit:** `0af036a`.
- **Código:** `src/shared/cache/`, `src/services/provider-runner.js` (`fetchEntries`) y `src/bootstrap.js` (`resolveCache`).
- **Tests:** `tests/unit/services/provider-runner.test.js` y `tests/interfaces/http-v1.test.js` (la segunda búsqueda sale de caché).
- **Diagrama:** [5](../arquitectura/05-provider-runner.md).
