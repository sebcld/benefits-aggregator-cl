# CHANGELOG del refactor: 1.0.0 → 2.0.0

Se pasó de un módulo monolítico (`src/benefits.js`, 618 líneas) a una arquitectura por capas (ver [ARQUITECTURA.md](ARQUITECTURA.md)). La API pública de `src/benefits.js` se mantiene como fachada compatible. Base de comparación: commit `f8352c7`.

## Resumen

- **Equivalencia demostrada sin internet.** El CLI, la API legada y la fachada producen la misma salida que el código original, salvo los cambios listados en [Cambios de comportamiento](#cambios-de-comportamiento). Lo verifica `tests/characterization/original-equivalence.test.js` contra `tests/fixtures/golden-original/`, generado con el código original.
- **Equivalencia en vivo.** El 2026-11-12 se levantaron el servidor original y el nuevo en paralelo, y `GET /search` dio respuestas idénticas para `Rappi`, `El Café Rosa`, `burger king` y `kfc`. En el CLI hubo diferencias entre corridas secuenciales que venían de Banco de Chile por `r.jina.ai`: la misma página falla o responde según el momento (ver [RIESGOS.md](RIESGOS.md)).
- **241 tests** con `node:test`, sin red (`npm test`), y lint de arquitectura (`npm run lint`).

## Mapa: de `src/benefits.js` a los módulos nuevos

| Antes (`src/benefits.js` y otros) | Ahora |
|---|---|
| `sleep` | `src/shared/async.js` → `sleep(ms, signal)` (cancelable) |
| `decodeHtml`, `cleanText`, `escapeRegex`, `normalize`, `truncate`, `toTitleCase` | `src/shared/text.js` (sin cambios) |
| `todayInChile`, `parseDmyDate` | `src/shared/dates.js` (+ `isWithinRange`; `todayInChile(now)` recibe el reloj) |
| `matchesQuery` | `src/services/matcher.js` (misma lógica; campos en `SEARCH_FIELDS`) |
| `fetch(...)` + `if (!response.ok) throw ...`, repetido 7 veces | `src/shared/http-client.js` (`getJson`, `getText`, `request`, `ensureOk`; timeout, reintento 429, user-agent) |
| `fetchSantander` | `src/providers/santander.provider.js` (`parseSantander`) |
| `fetchBci` | `src/providers/bci.provider.js` (`parseBciOffer`) |
| `fetchTenpo` (regex) | `src/providers/tenpo.provider.js` (`parseTenpoPage`, misma regex) |
| `fetchTapp` | `src/providers/tapp.provider.js` (`parseTappEntry`) |
| `fetchCopec`, `termNames` | `src/providers/copec.provider.js` (`parseCopecItem`, `parseCopec`) |
| `fetchBancoChile` (9 páginas + `commerceFromSlug` + Big5 escrito 3 veces) | `src/providers/bancochile.provider.js` + `bancochile.parser.js`, **con otra fuente** (ver cambio 1) |
| `fetchMercadoPago` | `src/providers/mercadopago.provider.js` y `mercadopago.parser.js`. Desde el [ADR 0018](adr/0018-futuro-de-mercado-pago.md) lee la landing de beneficios de la tarjeta; la búsqueda en Mercado Libre (`parseMercadoPago`, `queryDependent`) se eliminó |
| Literales de objeto por emisor | `src/domain/entry.js` → `createEntry` (validación, `id`, `logo`, inmutable) y `toLegacyEntry` |
| `throw new Error(...)` sueltos | `src/domain/errors.js` (`AppError`, `ValidationError`, `ProviderError`, `TimeoutError`, `ConfigError` y `errorCode`) |
| `searchBenefits` (lista fija de 7 `if`) | `src/services/search-service.js` (usa el registro) + `src/services/provider-runner.js` (caché, timeout, dedupe, alerta de catálogo vacío) + `src/providers/index.js` (registro) |
| — | `src/services/source-status.js` (último estado por emisor para `/v1/health`) |
| `src/config.js` (leía `.env` al importarse) | `src/config/index.js` (`loadConfig()` validada, sin efectos) + `src/config/env-file.js` |
| `src/index.js` (`printResults` + `main()` al importar) | `src/interfaces/cli/formatter.js` (puro) + `src/interfaces/cli/main.js` (`runCli`) + `src/index.js` (entrypoint) |
| `src/server.js` (`startsWith`, `parseJson`, `send`, `parseBanks`) | `src/interfaces/http/`: `server.js`, `router.js`, `routes.js`, `controllers/`, `middlewares/` (body-parser, cors, error-handler), `validation.js`, `serializers.js`, `http-error.js`; y `src/server.js` (entrypoint) |
| — | `src/bootstrap.js` (composition root) |
| `src/benefits.js` (toda la lógica) | `src/benefits.js`: fachada de 58 líneas con la misma API pública |

## Cambios de comportamiento

Todos están verificados por tests. Los marcados como **brief** los pedía el documento de refactor; los marcados como **pedido** los pediste durante el trabajo.

| # | Cambio | Antes | Ahora | Origen |
|---|---|---|---|---|
| 1 | **Fuente de Banco de Chile** | Scraping de 9 páginas vía `r.jina.ai`: unos 62 registros, sin PROWASHGO, con la lista fija de Big5 | API de contenido (Modyo) de [Todos los beneficios](https://sitiospublicos.bancochile.cl/personas/beneficios/todos-los-beneficios), vía `r.jina.ai`: 919 registros, con `category`, `validUntil` y `logo`. La lista de Big5 se eliminó porque KFC, Dunkin', Wendy's, etc. vienen como beneficios propios | pedido |
| 2 | `POST /search` con JSON inválido | 500 `{"error":"JSON invalido"}` | **400**, mismo body | brief |
| 3 | `POST /search` con body `null` o `query` no texto | 500 con un error interno de JavaScript | **400** `{"error":"Falta el campo query"}` | brief (error del cliente = 4xx) |
| 4 | Rutas con prefijo (`/searchXYZ`, `/healthcheck`, `/search/`) | 200, por `startsWith` | **404** `{"error":"No encontrado"}` | brief (ruteo exacto) |
| 5 | Body mayor que el límite | Se cortaba la conexión sin responder | **413** (`Body demasiado grande`) | brief |
| 6 | Caché en el servidor | Cada petición descargaba todo (unos 12 s) | Catálogos en memoria por `CACHE_TTL_SECONDS` (30 min): los datos pueden tener hasta 30 min de antigüedad. El CLI y la fachada **no** usan caché | brief |
| 7 | Timeouts en el servidor | Esperaba indefinidamente | `HTTP_TIMEOUT_MS=20000` por petición y `PROVIDER_TIMEOUT_MS=60000` por emisor; si se excede, el emisor queda en `errors` con `TIMEOUT`. El CLI y la fachada **no** aplican timeouts | brief |
| 8 | Headers | — | `x-request-id` en cada respuesta; CORS si `CORS_ORIGINS` está configurado | brief |
| 9 | Configuración inválida (`PORT=abc`, `LOG_LEVEL=x`) | Usaba el valor por defecto sin avisar | Falla al iniciar con `ConfigError` | brief (config validada) |
| 10 | Lectura de `.env` | `process.loadEnvFile` (Node 20.12+) o un parser propio | Siempre el parser propio, sin modificar `process.env`. Es equivalente para `CLAVE=valor`, comentarios, `export` y comillas | brief (sin efectos al importar) |
| 11 | Tipo de error en la fachada (`fetchX`) | `Error` | `ProviderError` o `TimeoutError` (subclases de `Error`, con el mismo `message`) | refactor |
| 12 | CLI: vigencia con una sola fecha | — (no ocurría) | `Vigencia: hasta 2027-02-28` (Banco de Chile). Con dos fechas se mantiene `X al Y` | consecuencia de 1 |

Todo lo demás es idéntico: resultados y su orden, formato del CLI (stdout, stderr y código de salida), cuerpo y status de `/search` y `/health`, y mensajes de error de los emisores (`"<Emisor> respondio <status>: ..."`).

## Funcionalidad nueva

- **API v1** (`/v1/search` GET/POST, `/v1/banks`, `/v1/health`), documentada en [`openapi.yaml`](openapi.yaml):
  - paginación;
  - `id` estable, `bankKey` y `logo`;
  - errores `{ error: { code, message, details } }`;
  - validación de `q`, `banks` (por key o nombre), `page` y `pageSize`;
  - `sources` con el estado de cada emisor y `meta.partial`.
- **Caché** `CacheStore` (en memoria, reemplazable por Redis), deduplicación de descargas simultáneas y `CACHE_WARMUP`.
- **Observabilidad:**
  - logger JSON con `LOG_LEVEL`;
  - log de acceso con `x-request-id`;
  - alerta `provider_empty` cuando un catálogo llega vacío;
  - `/v1/health?probe=true`.
- **Variables nuevas:** `LOG_LEVEL`, `CACHE_TTL_SECONDS`, `CACHE_WARMUP`, `HTTP_TIMEOUT_MS`, `PROVIDER_TIMEOUT_MS`, `CORS_ORIGINS`, `BODY_LIMIT_BYTES` y `JINA_API_KEY` (ver `.env.example`).
- **Scripts:** `npm test`, `npm run lint`, `npm run check`, `npm run smoke` (en vivo), `npm run fixtures:record` y `npm run fixtures:golden`. En `package.json`, `"main"` pasó a ser `src/benefits.js` y se agregó `engines.node >= 18`.

## Árbol final

```
src/
├── benefits.js                  fachada 1.x
├── bootstrap.js                 composition root
├── index.js                     entrypoint CLI
├── server.js                    entrypoint API
├── config/        index.js, env-file.js
├── domain/        entry.js, errors.js
├── shared/        text.js, dates.js, async.js, http-client.js, logger.js
│   └── cache/     cache-store.js, memory-cache-store.js
├── providers/     provider.interface.js, index.js, santander, bci, tenpo, tapp, copec,
│                  bancochile (+ bancochile.parser.js), mercadopago (*.provider.js)
├── services/      search-service.js, provider-runner.js, matcher.js, source-status.js
└── interfaces/
    ├── cli/       main.js, formatter.js
    └── http/      server.js, router.js, routes.js, validation.js, serializers.js, http-error.js
        ├── controllers/  search, health, banks (*.controller.js)
        └── middlewares/  body-parser.js, cors.js, error-handler.js
tests/
├── acceptance/        casos de negocio por emisor
├── characterization/  fachada, CLI, API legada, matcher y equivalencia con el original
├── interfaces/        API v1 y sincronía con openapi.yaml
├── unit/              config, domain, providers, services, shared, interfaces
├── helpers/           fetch simulado, preload, procesos, dobles de prueba
├── tools/             record-fixtures, build-golden, smoke-live
└── fixtures/
    ├── http/              respuestas reales grabadas (Banco de Chile recortado a los campos usados)
    ├── golden/            salida de referencia vigente
    └── golden-original/   salida del código original (no se regenera)
scripts/lint.js
docs/              ARQUITECTURA.md, AGREGAR_EMISOR.md, openapi.yaml, CHANGELOG_REFACTOR.md, RIESGOS.md
```
