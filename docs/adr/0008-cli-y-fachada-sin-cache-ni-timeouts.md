# 0008. CLI y fachada sin caché ni timeouts

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Relación:** acota [0007](0007-cache-en-memoria-detras-de-cachestore.md)

## Contexto

Al principio, `createApp` aplicaba los mismos timeouts a todas las interfaces (`HTTP_TIMEOUT_MS=20000` por petición y `PROVIDER_TIMEOUT_MS=60000` por emisor). En una comparación en vivo contra el código original, Banco de Chile tardó más de 60 s por lentitud de `r.jina.ai`: la versión nueva cortó con `TIMEOUT`, mientras que la original habría seguido esperando y devuelto resultados.

Para el CLI y la fachada `src/benefits.js` (API pública 1.x) regía la regla de no cambiar el comportamiento observable. Además, el CLI es un proceso nuevo en cada ejecución, así que una caché en memoria no le aporta nada.

## Alternativas consideradas

1. **Los mismos timeouts y la misma caché para todas las interfaces.** Es lo más uniforme, pero rompe la semántica 1.x del CLI y la fachada cuando una fuente está lenta.
2. **Timeouts mucho más altos en todas partes** (por ejemplo, 5 min). Siguen cambiando el comportamiento en el peor caso y le quitan utilidad al timeout en el servidor.
3. **Una opción `timeouts: false` y `cache: null` para el CLI y la fachada** (elegida).

## Decisión

- **El CLI y la fachada** llaman a `createApp({ defaultLogLevel: 'silent', cache: null, timeouts: false })`, en `src/index.js` y `src/benefits.js`: sin caché, sin timeouts y sin logs, salvo que se defina `LOG_LEVEL`.
- **El servidor** (`src/server.js`) llama a `createApp({ defaultLogLevel: 'info' })`, con caché en memoria y timeouts configurables.

## Consecuencias

- **Positivas:** el CLI y la fachada producen exactamente lo mismo que 1.x, incluso con fuentes lentas, y la API sigue protegida contra fuentes colgadas.
- **Negativas:**
  - Si una fuente se cuelga, el CLI espera indefinidamente, como en 1.x.
  - El sistema se comporta distinto según la interfaz, y eso hay que tenerlo en cuenta al depurar: un emisor puede fallar con `TIMEOUT` en la API y funcionar en el CLI.

## Evidencia

- **Código:** `src/bootstrap.js` (opción `timeouts`), `src/index.js` y `src/benefits.js`.
- **Documentación:** `docs/CHANGELOG_REFACTOR.md` (cambios 6 y 7).
- **Diagrama:** [9](../arquitectura/09-interfaces-compatibilidad.md).
