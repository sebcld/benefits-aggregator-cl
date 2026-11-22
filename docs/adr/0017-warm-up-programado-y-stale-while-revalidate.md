# 0017. Warm-up programado y stale-while-revalidate

- **Estado:** Reemplazado por [0024](0024-actualizacion-diaria-programada.md) (actualización diaria a hora fija con un timer interno y carga inicial al arrancar). Stale-while-revalidate no se implementó: con la caché vigente hasta la próxima ejecución, deja de hacer falta.
- **Fecha:** 2026-11-12
- **Relación:** extiende [0007](0007-cache-en-memoria-detras-de-cachestore.md); se potencia con [0016](0016-cachestore-compartido-en-redis.md)

## Contexto

Cuando la caché está fría o vencida, el primer usuario espera la descarga completa: entre 10 y 20 s, con Banco de Chile en unos 16 s (`docs/RIESGOS.md` #11). Hoy existen dos mecanismos manuales: `CACHE_WARMUP=true`, que precarga solo al iniciar, y `/v1/health?probe=true`, bajo demanda. Ninguno evita que la caché venza en medio del día.

## Alternativas consideradas

1. **Solo `CACHE_WARMUP` al iniciar** (lo que existe hoy).
   - Pros: ya está implementado.
   - Contras: a los 30 minutos la caché vence y el problema vuelve.
2. **Job programado** (cron, GitHub Actions o un scheduler de la nube) que llame a `GET /v1/health?probe=true` cada 20-25 min, menos que el TTL.
   - Pros: sin cambios de código.
   - Contras: requiere un scheduler externo. Con caché en memoria y varias instancias, solo calienta la instancia que recibe la llamada.
3. **Stale-while-revalidate en `provider-runner`.**
   - Cómo: al vencer el TTL, se devuelve el dato anterior de inmediato y se renueva en segundo plano. Se guardan `expiresAt` y `staleUntil` (por ejemplo, TTL de 30 min y "stale" hasta 6 h).
   - Pros: ningún usuario espera, salvo en el arranque en frío absoluto.
   - Contras: más lógica en el runner. Además, `CacheStore` necesita poder devolver datos vencidos, así que habría que extender el contrato o guardar `{ value, fetchedAt }`.
4. **Timer interno en el servidor** que llame a `warmUp()` cada N minutos.
   - Pros: sin infraestructura.
   - Contras: con varias instancias, cada una lo ejecuta (duplicado), y en entornos serverless el proceso se duerme.

## Recomendación

**Opción 3 junto con la 2.** Stale-while-revalidate garantiza la latencia del usuario, y el job programado evita el primer acceso en frío después de un despliegue o reinicio. Con Redis ([0016](0016-cachestore-compartido-en-redis.md)), el job calienta la caché de todas las instancias a la vez.

Hay que exponer la antigüedad del dato, para que la app pueda mostrarla. Por ejemplo, `sources[].fetchedAt`, que sería un campo nuevo y aditivo en `openapi.yaml`.

## Consecuencias si se aprueba

- **Positivas:** la latencia queda estable en milisegundos y las fuentes reciben carga constante y predecible.
- **Negativas:**
  - Los datos pueden ser más viejos que el TTL (hasta el límite de "stale"), lo que interactúa con el filtro de vigencia de Copec Pay.
  - Hay más estados que probar en el runner.
  - Una fuente caída por mucho tiempo seguiría mostrando datos viejos sin avisar, salvo que se exponga `fetchedAt`.
