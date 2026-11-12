# Arquitectura

Buscador de beneficios de bancos, tarjetas y billeteras de Chile. Consulta en vivo las fuentes públicas de 7 emisores, normaliza cada beneficio a un `Entry` común y filtra por palabra clave. Se usa por CLI y por API HTTP. La API está pensada para una app móvil Android/iOS.

- Node 26 o superior, CommonJS y **cero dependencias de runtime** (solo módulos nativos).
- Contrato HTTP: [`openapi.yaml`](openapi.yaml). Agregar un emisor: [`AGREGAR_EMISOR.md`](AGREGAR_EMISOR.md).
- Qué cambió respecto de la 1.x: [`CHANGELOG_REFACTOR.md`](CHANGELOG_REFACTOR.md). Riesgos y deuda: [`RIESGOS.md`](RIESGOS.md).
- **Diagramas** (contexto, capas, secuencias, dominio, errores, arquitectura objetivo): [`arquitectura/`](arquitectura/README.md).
- **Decisiones registradas** (15 aceptadas y 7 propuestas): [`adr/`](adr/README.md).
- **Web** (Next.js, consume `/v1` a través de su propio BFF `/api/*`): [`web/README.md`](../web/README.md) y [ADR 0022](adr/0022-web-nextjs-con-bff.md).

## Capas

```
src/
├── config/        Lee .env y entrega la configuración validada (sin efectos al importar)
├── domain/        Entry (factory, validación, id estable) y errores con código estable
├── shared/        Utilidades sin negocio: texto, fechas, async, cliente HTTP, logger, caché
├── providers/     Un módulo por emisor + contrato común + registro
├── services/      Orquestación de la búsqueda, matcher, runner (caché/timeout) y estado por emisor
├── interfaces/
│   ├── cli/       Formateo de texto y ejecución del CLI
│   └── http/      Servidor, router, controllers, middlewares, validación y serializers
├── bootstrap.js   Composition root: único lugar que arma las dependencias concretas
├── index.js       Entrypoint del CLI
├── server.js      Entrypoint de la API
└── benefits.js    Fachada de compatibilidad con la API pública 1.x
```

**Regla de dependencias.** Las dependencias apuntan hacia `domain`. `services` no conoce emisores concretos: recibe el registro. `interfaces` no importa `services`: recibe el `searchService` ya armado a través del `app` de `bootstrap.js`. El grafo real de imports y la tabla de dependencias prohibidas que verifica `npm run lint` están en el [diagrama 2: Capas y dependencias](arquitectura/02-capas.md). Cómo se conectan las piezas en tiempo de ejecución está en el [diagrama 3: Componentes](arquitectura/03-componentes.md).

## Flujo de una búsqueda

- [Diagrama 4: secuencia de `GET /v1/search`](arquitectura/04-secuencia-busqueda.md), con acierto y fallo de caché y emisor caído.
- [Diagrama 5: ciclo del `provider-runner`](arquitectura/05-provider-runner.md): caché, deduplicación, timeout y estados `ok`/`empty`/`error`.
- [Diagrama 7: flujo de datos de un emisor](arquitectura/07-flujo-datos-emisor.md), de la fuente al serializer.

## Decisiones (qué y por qué)

Resumen de una línea por decisión. El contexto, las alternativas y las consecuencias están en cada ADR.

| Decisión | Por qué | ADR |
|---|---|---|
| **Composition root único** (`bootstrap.js`) | Las interfaces y los tests piden una "app" armada. Así se inyectan `fetch`, reloj, `sleep`, caché y providers sin tocar el código de negocio. | [0001](adr/0001-arquitectura-por-capas-con-composition-root.md) |
| **Contrato de provider** `{ key, name, queryDependent, fetch(ctx) }` + parsers puros | El servicio depende del contrato, no de los emisores; los providers se prueban sin red ni reloj real. | [0003](adr/0003-contrato-de-provider-y-registro.md) |
| **`Entry` inmutable y con `id` estable** | La caché comparte objetos entre peticiones, y la app necesita una clave estable. | [0004](adr/0004-entry-inmutable-con-id-estable.md) |
| **Errores con `code` estable y respuestas parciales** | La app decide por `code`, y un emisor caído no rompe la búsqueda. | [0005](adr/0005-errores-con-codigo-estable.md) |
| **Dos formatos de API**: legado y `/v1` | La 1.x no se rompe, y `/v1` tiene un contrato pensado para móvil. | [0006](adr/0006-api-versionada-v1-con-rutas-legadas.md) |
| **`CacheStore` asíncrono**, con implementación en memoria | Latencia de milisegundos, y reemplazable por Redis. | [0007](adr/0007-cache-en-memoria-detras-de-cachestore.md) |
| **El CLI y la fachada sin caché ni timeouts** | Conservan exactamente la semántica 1.x. | [0008](adr/0008-cli-y-fachada-sin-cache-ni-timeouts.md) |
| **CommonJS y sin dependencias** | Lo pide el proyecto; la fachada debe seguir siendo `require`-able. | [0002](adr/0002-node-nativo-sin-dependencias-y-commonjs.md) |
| **Node 26 LTS y CI** | Runtime con soporte hasta 2029-04-30, y ningún PR entra con tests rotos. | [0020](adr/0020-actualizacion-a-node-26-y-ci.md) |
| **Web en Next.js con BFF** (`web/`) | La API key y la URL de la API quedan en el servidor; la futura app en Expo usa el mismo puente. | [0022](adr/0022-web-nextjs-con-bff.md) |

## Preparación para la app móvil

| Tema | Implementación |
|---|---|
| Versionado | `/v1/search`, `/v1/banks`, `/v1/health`. Las rutas sin versión siguen funcionando (deprecadas). |
| Contrato | [`openapi.yaml`](openapi.yaml), con un test (`tests/interfaces/openapi-sync.test.js`) que falla si una ruta o un campo no está documentado. |
| Errores | `{ error: { code, message, details? } }` con el status HTTP correcto (400, 404, 405, 413 y 500). Los 500 no exponen detalles internos. |
| Ruteo | Coincidencia exacta de método y ruta. En `/v1`, un método no permitido responde 405 con el header `Allow`. |
| Validación | `q` de 1 a 100 caracteres; hasta 20 `banks`, por key o nombre (si hay desconocidos, responde 400 `UNKNOWN_BANK` con la lista válida); `page` ≥ 1; `pageSize` entre 1 y 100. |
| Payload | `Benefit` con `id`, `bank`, `bankKey`, `title`, `subtitle`, `description` (hasta 300 caracteres), `commerceName`, `category`, `validFrom`, `validUntil`, `url` y `logo`. Los campos vacíos van como `null`. No se envían los campos internos de búsqueda. |
| Paginación | `page` y `pageSize`; la respuesta trae `pagination { page, pageSize, total, totalPages, hasMore }`. |
| Caché | En memoria, con TTL por emisor (`CACHE_TTL_SECONDS`, por defecto 1800). Las búsquedas siguientes pasan de unos 12-20 s a milisegundos. `CACHE_WARMUP=true` precarga los catálogos al iniciar. |
| Resiliencia | Timeout por petición (`HTTP_TIMEOUT_MS`) y por emisor (`PROVIDER_TIMEOUT_MS`). Si un emisor falla, la respuesta es parcial (`meta.partial`, `errors`, `sources`). Un catálogo con 0 registros queda como `empty`, genera una alerta `provider_empty` en el log y se guarda en caché solo 1 minuto. |
| Observabilidad | Logger JSON por línea en stderr (`LOG_LEVEL`), con `x-request-id` por petición y log de acceso. `/v1/health` muestra el estado de cada emisor; `?probe=true` los consulta en el momento. |
| CORS | `CORS_ORIGINS` (lista o `*`). Vacío = desactivado, porque las apps nativas no lo necesitan. |

Cómo se convierte cada error en una respuesta HTTP, para v1 y para la API legada: [diagrama 8](arquitectura/08-manejo-errores.md). Cómo conviven el CLI, la fachada y las dos APIs: [diagrama 9](arquitectura/09-interfaces-compatibilidad.md).

### Hacia producción (propuesto, no implementado)

Ver el [diagrama 10: arquitectura objetivo](arquitectura/10-arquitectura-objetivo.md) y los ADR propuestos, que necesitan aprobación:

| Tema | ADR |
|---|---|
| Autenticación con API key (`x-api-key`) | [0014](adr/0014-autenticacion-con-api-key.md) |
| Rate limiting | [0015](adr/0015-rate-limiting.md) |
| `CacheStore` compartido en Redis para varias instancias | [0016](adr/0016-cachestore-compartido-en-redis.md) |
| Warm-up programado y stale-while-revalidate | [0017](adr/0017-warm-up-programado-y-stale-while-revalidate.md) |
| Futuro de Mercado Pago | [0018](adr/0018-futuro-de-mercado-pago.md) |
| Acceso a Banco de Chile sin un proxy gratuito | [0021](adr/0021-acceso-a-banco-de-chile-sin-proxy-gratuito.md) |

Las métricas por emisor (`durationMs` y `status` en los logs `provider_*`) ya están disponibles para conectarlas a un sistema de alertas.

## Pruebas

Estrategia (fixtures reales, golden, preload y smoke en vivo) y tabla de tipos de prueba: [diagrama 12](arquitectura/12-estrategia-pruebas.md) y [ADR 0009](adr/0009-tests-de-caracterizacion-con-fixtures-y-golden.md).

- **Actualizar fixtures:** `npm run fixtures:record -- <emisor>`, luego `npm run fixtures:golden`, y revisar el diff en git.

## Calidad

`npm run lint` no tiene dependencias. Revisa la sintaxis de todos los archivos y estas reglas de arquitectura:
- máximo 200 líneas por módulo;
- `process.env` solo en `src/config/`;
- `fetch` global solo en `src/shared/http-client.js`;
- ninguna llave de 32 caracteres hexadecimales en `src/` ni en `docs/`;
- las dependencias entre capas del [diagrama 2](arquitectura/02-capas.md).

`npm run check` corre el lint y los tests. Ver [ADR 0013](adr/0013-reglas-de-arquitectura-con-lint-propio.md).

El CI de GitHub Actions corre `npm run check` en Node 26 en cada PR y el smoke en vivo una vez al día ([ADR 0020](adr/0020-actualizacion-a-node-26-y-ci.md)).

**Propuesta pendiente de aprobación:** ESLint y Prettier como devDependencies ([ADR 0019](adr/0019-eslint-y-prettier.md)).
