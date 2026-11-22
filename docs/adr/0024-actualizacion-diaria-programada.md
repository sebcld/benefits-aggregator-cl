# 0024. Actualización diaria programada de los catálogos

- **Estado:** Aceptado
- **Fecha:** 2026-11-22
- **Relación:** extiende [0007](0007-cache-en-memoria-detras-de-cachestore.md) y reemplaza su expiración por TTL fijo; reemplaza a [0017](0017-warm-up-programado-y-stale-while-revalidate.md); respeta [0002](0002-node-nativo-sin-dependencias-y-commonjs.md)

## Contexto

La caché ([0007](0007-cache-en-memoria-detras-de-cachestore.md)) vencía por un TTL relativo (`CACHE_TTL_SECONDS`: 30 min por defecto, 2 h en el despliegue recomendado). Al vencer, el siguiente usuario esperaba la descarga completa, de 10 a 20 s (`docs/RIESGOS.md` #11). Eso pasaba varias veces al día, en momentos que nadie elegía, y cada vez golpeaba las 8 fuentes.

Los catálogos cambian pocas veces al día. Lo que se pide:
1. Una descarga completa **una vez al día a una hora fija** (por defecto 09:00 de Chile), configurable.
2. Que los datos se sirvan **hasta la siguiente ejecución**, sin vencer antes.
3. Que un **arranque en frío** (un reinicio con PM2, un deploy) cargue la caché solo, al iniciar.
4. Mantener la **actualización manual** (`refresh=true`, botón "Actualizar") con su antigüedad mínima.

## Alternativas consideradas

1. **Biblioteca de cron** (`node-cron`, `cron`).
   - Pros: expresiones cron conocidas.
   - Contras: es una dependencia de runtime, prohibida por [0002](0002-node-nativo-sin-dependencias-y-commonjs.md). Para una sola hora al día no aporta nada.
2. **Cron externo** (crontab del servidor, GitHub Actions, el scheduler de la nube) que llame a `GET /v1/health?probe=true` o a un endpoint nuevo.
   - Pros: sin código nuevo en la API.
   - Contras: requiere infraestructura en cada despliegue y, con API key, guardar la llave en otro lugar. `probe=true` no fuerza la descarga si la caché está vigente, así que habría que agregar una ruta protegida para eso.
3. **Timer nativo en el servidor** (elegida). `setTimeout` hasta la próxima hora programada, recalculado después de cada ejecución.
   - Pros: sin dependencias ni infraestructura; la hora se calcula con `Intl` en `America/Santiago`, así que los cambios de horario de Chile no la mueven.
   - Contras: con varias instancias, cada una ejecuta la suya. En plataformas que duermen el proceso (Render gratis), el timer no corre mientras duerme.

Para la expiración:

- **Sin expiración** (la caché solo se reemplaza al actualizar). Si la ejecución diaria falla para un emisor, nadie vuelve a intentarlo hasta el día siguiente.
- **Hasta la próxima ejecución + 1 h de gracia** (elegida). Si la ejecución diaria falla para un emisor, su catálogo anterior se sigue sirviendo durante la hora de gracia; después vence y la siguiente búsqueda vuelve a intentar la descarga.

**Respaldo en disco** (escribir la caché a un JSON para sobrevivir a un reinicio): se deja para después. La carga inicial al arrancar cubre el reinicio a cambio de 10-20 s, y un archivo agrega estado en disco y permisos en cada despliegue.

## Decisión

- **`REFRESH_TIME`** (`HH:MM` en hora de Chile, por defecto `09:00`; `off` la desactiva). Se valida al iniciar: un formato inválido detiene el servidor con un error de configuración.
- **Scheduler** (`src/services/refresh-scheduler.js`): calcula la próxima ejecución con `nextDailyAt` (`src/shared/dates.js`), programa un `setTimeout` con `unref` y, al dispararse, llama a `searchService.refreshAll()` y vuelve a programar.
  - **Sin solapamiento:** si una ejecución sigue en curso, otra llamada espera esa misma.
  - **Despertar antes de tiempo:** si el reloj cambió, solo reprograma.
  - **Nunca rechaza:** el resultado queda en `lastRun` (`ok`, `partial` o `error`, con los emisores que fallaron) y en el log (`scheduled_refresh_planned`, `scheduled_refresh_done`, `scheduled_refresh_failed`).
  - Solo lo arranca el servidor HTTP (`src/server.js`); el CLI y la fachada no programan nada ([0008](0008-cli-y-fachada-sin-cache-ni-timeouts.md)).
- **`refreshAll`** usa `runner.run(provider, { refresh: true, force: true })`: `force` se salta `CACHE_REFRESH_MIN_AGE_SECONDS`, y se mantienen la deduplicación de descargas en curso y el respaldo al catálogo anterior si un emisor falla.
- **Expiración:** el runner acepta `cacheTtlMs` como función del reloj. `bootstrap.js` la define como "hasta la próxima ejecución + 1 h" (`SCHEDULE_GRACE_MS`). Con `REFRESH_TIME=off`, un catálogo dura 24 h. El catálogo vacío sigue durando 1 minuto.
- **`CACHE_TTL_SECONDS` queda obsoleta:** solo `0` tiene efecto (desactiva la caché y el scheduler). Otro valor deja el aviso `config_warning` en el log al iniciar.
- **`CACHE_WARMUP`** pasa a `true` por defecto: la caché vive en memoria y arranca vacía.
- **Actualización manual** sin cambios: `refresh=true` con `CACHE_REFRESH_MIN_AGE_SECONDS` (300). Sobrescribe la caché y su vencimiento se recalcula hasta la próxima ejecución.
- **Contrato:** `/v1/health` agrega `cache.schedule` (`enabled`, `time`, `timeZone`, `nextRunAt`, `lastRun`), un campo aditivo. `cache.ttlSeconds` se mantiene, pero ahora informa cuánto duraría un catálogo descargado en ese momento.

## Consecuencias

- **Positivas:**
  - La descarga pesada ocurre una vez al día, a una hora conocida, y no cuando un usuario busca.
  - Cada fuente recibe una descarga completa al día por instancia, más las manuales.
  - `/v1/health` muestra la próxima ejecución y el resultado de la última, útil para alertas.
- **Negativas:**
  - Los datos pueden tener hasta ~25 h de antigüedad. Un beneficio nuevo aparece al día siguiente, salvo que alguien pulse "Actualizar".
  - El filtro de vigencia de Copec Pay se aplica al descargar: un beneficio que vence a medianoche puede seguir apareciendo hasta la próxima ejecución (`docs/RIESGOS.md` #8).
  - Con varias instancias, cada una ejecuta su actualización ([0016](0016-cachestore-compartido-en-redis.md)).
  - En plataformas que duermen el proceso, la ejecución de las 09:00 no corre si el proceso duerme; al despertar, la carga inicial llena la caché.
  - Un reinicio pierde la caché y la vuelve a descargar (10-20 s), hasta que exista un respaldo en disco o Redis.

## Evidencia

- **Commit:** `f5d0d60`.
- **Código:** `src/services/refresh-scheduler.js`, `src/shared/dates.js` (`nextDailyAt`, `parseClockTime`), `src/services/provider-runner.js` (TTL como función y `force`), `src/services/search-service.js` (`refreshAll`), `src/bootstrap.js` (`cacheTtlPolicy`), `src/config/index.js` (`REFRESH_TIME`, `CACHE_WARMUP`, avisos) y `src/server.js`.
- **Tests:** `tests/unit/services/refresh-scheduler.test.js` (reloj y timers falsos), `tests/unit/shared/dates-schedule.test.js` (verano, invierno, cambios de horario y fin de año), `tests/unit/services/provider-runner.test.js`, `tests/unit/services/search-service.test.js`, `tests/unit/config/config.test.js` y `tests/interfaces/http-v1.test.js` (`cache.schedule` en `/v1/health`).
