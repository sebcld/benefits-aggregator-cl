# 0005. Errores con código estable y respuestas parciales

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Relación:** complementa a [0006](0006-api-versionada-v1-con-rutas-legadas.md)

## Contexto

En 1.0.0, los errores eran `throw new Error('...')` con texto libre. Un JSON inválido respondía 500, y un body `null` exponía errores internos de JavaScript ("Cannot read properties of null"). Una app móvil necesita decidir por un valor estable, no por un texto. Además, la búsqueda ya toleraba que un emisor fallara (`Promise.allSettled`) y había que conservar ese comportamiento.

## Alternativas consideradas

1. **Solo el status HTTP, con el mensaje de texto.** El cliente no puede distinguir, por ejemplo, `UNKNOWN_BANK` de `INVALID_PAGINATION` (ambos son 400).
2. **Formato [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807) (`application/problem+json`)** *(reconstruida)*. Es un estándar, pero agrega campos (`type`, `title`, `instance`) que la app no usa. El brief pedía explícitamente el formato `{ error: { code, message } }`.
3. **Errores de dominio con `code` estable y un formato uniforme por API** (elegida).

## Decisión

- **Jerarquía de errores** (`src/domain/errors.js`): `AppError` con `code` y `details`, y sus subclases `ValidationError`, `ConfigError`, `ProviderError` (con `status`) y `TimeoutError`. Además, `HttpError` (en `interfaces/http`) para 404, 405 y 413.
- **`errorCode(err)`** da un código estable también a los errores nativos: `NETWORK_ERROR`, `INVALID_RESPONSE`, `ABORTED` y `PROVIDER_ERROR`.
- **Un emisor que falla no es un error HTTP.** El runner lo convierte en un `SourceReport` con estado `error` y la búsqueda responde 200 con `errors[]` y `meta.partial: true`.
- **Errores de la petición.** `toErrorResponse(err, api)` traduce el error según la API:
  - en v1, `{ error: { code, message, details } }` con el status de `STATUS_BY_CODE`; en los 5xx usa `INTERNAL_ERROR` y un mensaje genérico;
  - en la API legada, `{ error: "<mensaje>" }`.
- **Se conservan los mensajes de los emisores** con su formato histórico: `"<Emisor> respondio <status>: <body>"`.

## Consecuencias

- **Positivas:**
  - La app decide por `code`.
  - Los errores del cliente son 4xx: los JSON inválidos, los body `null` y las `query` que no son texto pasaron de 500 a 400.
  - Los 500 de v1 no filtran detalles internos.
  - Un emisor caído no rompe la búsqueda.
- **Negativas:**
  - Cada código nuevo hay que agregarlo a `STATUS_BY_CODE`, a `openapi.yaml` y a su test de sincronía.
  - La API legada sigue exponiendo el mensaje en los 500, por compatibilidad.

## Evidencia

- **Código:** `src/domain/errors.js`, `src/interfaces/http/middlewares/error-handler.js` y `src/services/provider-runner.js` (`run`).
- **Tests:** `tests/interfaces/openapi-sync.test.js` verifica que cada código esté documentado.
- **Diagrama:** [8](../arquitectura/08-manejo-errores.md).
