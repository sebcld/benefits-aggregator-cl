# Buscador de beneficios bancarios

CLI y API HTTP en Node que consultan en vivo las fuentes públicas de emisores chilenos (bancos, tarjetas y billeteras), normalizan los beneficios a un formato común y los filtran por palabra clave (por ejemplo, `"burger king"`).

**Emisores:** Santander, BCI, Tenpo, Tapp, Copec Pay, Banco de Chile y Mercado Pago.

**¿Eres nuevo en el proyecto?** Lee en este orden: [contexto](docs/arquitectura/01-contexto.md), [capas](docs/arquitectura/02-capas.md), [secuencia de una búsqueda](docs/arquitectura/04-secuencia-busqueda.md), [interfaces](docs/arquitectura/09-interfaces-compatibilidad.md) y [arquitectura objetivo](docs/arquitectura/10-arquitectura-objetivo.md). Son unos 15 minutos.

| Documento | Para qué |
|---|---|
| [docs/openapi.yaml](docs/openapi.yaml) | Contrato de la API (cliente móvil o web) |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Capas, decisiones, caché, resiliencia y pruebas |
| [docs/arquitectura/](docs/arquitectura/README.md) | **Diagramas** Mermaid: contexto, capas, secuencias, dominio, errores, arquitectura objetivo |
| [docs/adr/](docs/adr/README.md) | **Decisiones de arquitectura** (ADR): por qué se decidió cada cosa y qué está propuesto |
| [docs/AGREGAR_EMISOR.md](docs/AGREGAR_EMISOR.md) | Guía paso a paso para sumar un emisor |
| [docs/CHANGELOG_REFACTOR.md](docs/CHANGELOG_REFACTOR.md) | Qué cambió en la 2.0.0 y dónde quedó cada pieza |
| [docs/RIESGOS.md](docs/RIESGOS.md) | Riesgos y deuda pendiente |

## Requisitos e instalación

- Node 26 o superior (versión fijada en `.nvmrc`; en Windows: `winget install OpenJS.NodeJS.LTS`). No hay dependencias externas.
- `npm install`
- Copia `.env.example` como `.env` y completa `BCI_SUBSCRIPTION_KEY`. `.env` está en `.gitignore` y no se sube al repositorio.

## Uso

### CLI

```bash
npm run search -- "burger king"     # o: node src/index.js "burger king"
```

Los resultados se agrupan por emisor y muestran comercio, título, bajada, descripción corta, vigencia (si la fuente la entrega) y link. Si un emisor falla, se muestra `<emisor> no disponible: <motivo>` y la búsqueda sigue con el resto. El CLI no usa caché ni timeouts: espera a todos los emisores.

### API HTTP

```bash
npm start                            # http://localhost:3000
```

| Ruta | Descripción |
|---|---|
| `GET /v1/search?q=rappi&banks=copec,bci&page=1&pageSize=20` | Búsqueda paginada, con `id` estable, `logo`, `validUntil` y estado por emisor (`sources`) |
| `POST /v1/search` | Igual, con body `{ "query", "banks", "page", "pageSize" }` |
| `GET /v1/banks` | Emisores disponibles (`key` y `name`) |
| `GET /v1/health[?probe=true]` | Estado del servicio y de cada emisor |
| `GET /search?q=` / `POST /search` / `GET /health` | Rutas 1.x (deprecadas, mismo formato que antes) |

- **Errores de `/v1`:** `{ "error": { "code", "message", "details"? } }` con el status correcto (400, 404, 405, 413).
- **Resultado parcial:** si un emisor falla, la respuesta incluye `errors` y `meta.partial: true`.
- **Caché:** los catálogos se guardan en memoria 30 min (`CACHE_TTL_SECONDS`). La primera búsqueda puede tardar 10-20 s; las siguientes, milisegundos. Con `CACHE_WARMUP=true` el servidor los precarga al iniciar.

### Como librería (compatibilidad 1.x)

```js
const { searchBenefits, fetchCopec } = require('./src/benefits');
const { matches, errors } = await searchBenefits('rappi', { banks: ['Copec Pay'] });
```

## Fuentes

| Emisor | Fuente |
|---|---|
| Santander | JSON público `banco.santander.cl/beneficios/promociones.json` |
| BCI | API `api.bciplus.cl/bff-loyalty-beneficios/v1/offers`, paginada (header `ocp-apim-subscription-key` = `BCI_SUBSCRIPTION_KEY`) |
| Tenpo | HTML de `www.tenpo.cl/beneficios` y su paginación (regex) |
| Tapp | CMS `web.cajalosandes.cl/api/content/spaces/wp-tapp-beneficios-copia/...`, paginado |
| Copec Pay | REST del tema WordPress `copecpay.cl/wp-json/custom/v1/beneficios/`. Solo vigentes hoy (hora de Chile); `fetchCopec({ includeInactive: true })` trae todos |
| Banco de Chile | API de contenido de [Todos los beneficios](https://sitiospublicos.bancochile.cl/personas/beneficios/todos-los-beneficios) (`/api/content/spaces/personas/types/beneficios/entries`), vía el proxy `r.jina.ai` porque el sitio bloquea clientes automatizados (`JINA_API_KEY` opcional) |
| Mercado Pago | Búsqueda de Mercado Libre `api.mercadolibre.com/sites/MLC/search` (sin token responde 403; ver [RIESGOS](docs/RIESGOS.md)) |

**Búsqueda:**
- No distingue mayúsculas, tildes ni puntuación (`"el cafe rosa"` encuentra "El Café Rosa").
- Compara contra título, bajada, descripción, slug, keywords, tags y comercio.
- Una palabra de 4 letras o menos debe coincidir completa (`kfc`).

## Variables de entorno

Se definen en `.env` (plantilla con todas las opciones: [`.env.example`](.env.example)). Las variables del sistema tienen prioridad. Un valor inválido detiene el inicio con un mensaje claro.

| Variable | Por defecto | Uso |
|---|---|---|
| `BCI_SUBSCRIPTION_KEY` | — | **Obligatoria** para BCI |
| `PORT` | `3000` | Puerto de la API |
| `LOG_LEVEL` | servidor `info`, CLI `silent` | `debug`, `info`, `warn`, `error` o `silent` (JSON en stderr) |
| `CACHE_TTL_SECONDS` / `CACHE_WARMUP` | `1800` / `false` | Caché del servidor |
| `HTTP_TIMEOUT_MS` / `PROVIDER_TIMEOUT_MS` | `20000` / `60000` | Timeouts del servidor |
| `CORS_ORIGINS` | vacío (desactivado) | Orígenes permitidos o `*` |
| `BODY_LIMIT_BYTES` | `1000000` | Límite del body |
| `MELI_ACCESS_TOKEN` / `MERCADOPAGO_TOKEN` | — | Token de Mercado Libre |
| `JINA_API_KEY` | — | Más límite de uso en `r.jina.ai` (Banco de Chile) |

## Desarrollo

```bash
npm test                 # 241 tests con node:test, sin internet (fixtures reales grabados)
npm run lint             # sintaxis + reglas de arquitectura (sin dependencias)
npm run check            # lint + test
npm run smoke            # casos de aceptación EN VIVO contra las fuentes reales
npm run fixtures:record -- <emisor>   # regraba respuestas reales de un emisor
npm run fixtures:golden               # regenera las salidas de referencia (revisar el diff)
```

**CI** ([`.github/workflows/check.yml`](.github/workflows/check.yml)): `npm run check` en Node 26 en cada PR y en cada push a `main`. Una vez al día corre `npm run smoke` en vivo y, si falla, abre o comenta el issue "Smoke en vivo fallando". El smoke necesita el secreto del repositorio `BCI_SUBSCRIPTION_KEY` (y `JINA_API_KEY`, opcional).

**Casos de aceptación por emisor** (en `npm test` con fixtures y en `npm run smoke` en vivo):

| Emisor | Consulta | Beneficio esperado |
|---|---|---|
| Banco de Chile | `PROWASHGO` | ProwashGo |
| Tenpo | `temu` | Hasta 50% de descuento para nuevos usuarios de la App Temu |
| BCI | `pedidos ya` | Beneficios PedidosYa |
| Santander | `burger king` | Burger King |
| Copec Pay | `Rappi`, `El Café Rosa` | Rappi, El Café Rosa |

La carpeta `entregable/` contiene el diagnóstico de la corrección de Copec Pay y el contexto del proyecto para asistentes de IA.
