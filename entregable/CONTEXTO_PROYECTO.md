# Contexto del proyecto `beneficios_banks` (v2.0.0)

> Contexto para un asistente de IA que va a trabajar en este repositorio. Resume lo esencial y apunta a la documentación detallada en `docs/`.
>
> Estado verificado el **2026-11-12**: 241 tests en verde, lint OK y smoke test en vivo OK para los 6 casos de aceptación.

## 1. Qué es

Buscador de beneficios y descuentos de bancos, tarjetas y billeteras de **Chile**. Consulta en vivo las fuentes públicas de 7 emisores (Santander, BCI, Tenpo, Tapp, Copec Pay, Banco de Chile y Mercado Pago), normaliza cada beneficio a un `Entry` común y filtra por palabra clave. No hay base de datos.

- **CLI:** `node src/index.js "<texto>"`. Sin caché ni timeouts, con la misma salida que la 1.x.
- **API HTTP:** `node src/server.js`. Ofrece `/v1/*` (contrato móvil en `docs/openapi.yaml`) y las rutas 1.x `/search` y `/health`. Tiene caché en memoria de 30 min y timeouts.
- **Librería:** `require('./src/benefits')`, fachada con la API pública 1.x (`searchBenefits`, `fetchX`, `matchesQuery`, `truncate`).
- **Cliente previsto:** una app móvil Android/iOS (todavía no existe en el repo).

## 2. Stack y reglas

| Aspecto | Detalle |
|---|---|
| Runtime | Node ≥ 26 (`.nvmrc`, CI en GitHub Actions), **CommonJS**, **cero dependencias de runtime** |
| Repo | git, `github.com/sebcld/benefits-aggregator-cl`; trabajo del refactor en la rama `refactor/arquitectura-capas` |
| Estilo | 2 espacios, comillas simples, punto y coma, trailing commas, unas 100 columnas. Comentarios en español y sin tildes |
| Secretos | Solo en `.env` (ignorado por git), leídos con `src/config`. Plantilla en `.env.example` |
| Lint | `npm run lint` hace cumplir las capas, que `process.env` solo se use en `config/` y `fetch` solo en `shared/http-client.js`, que no haya llaves en el código y el máximo de 200 líneas |
| Regla de trabajo | No cambiar el comportamiento observable sin aprobación. Todo cambio intencional queda registrado en `docs/CHANGELOG_REFACTOR.md` y en `tests/characterization/original-equivalence.test.js` |

## 3. Arquitectura (detalle en `docs/ARQUITECTURA.md`)

```
src/config      loadConfig(): .env + entorno → config validada (sin efectos al importar)
src/domain      createEntry (id estable, logo, inmutable), toLegacyEntry, errores con "code"
src/shared      text, dates, async (sleep cancelable), http-client, logger JSON, cache/ (CacheStore)
src/providers   <emisor>.provider.js con { key, name, fetch(ctx) } + parse* puros;
                index.js = registro (agregar emisor = 1 archivo + 1 línea)
src/services    search-service (orquesta y tolera fallos), provider-runner (caché, dedupe,
                timeout, alerta de catálogo vacío), matcher, source-status
src/interfaces  cli/ (formatter puro + runCli) y http/ (router exacto, controllers, middlewares,
                validation, serializers legado/v1)
src/bootstrap.js  composition root: createApp({ env, fetchImpl, clock, sleep, cache, timeouts })
```

**Flujo:**
1. La interfaz llama a `searchService.search(query, { banks })`.
2. El servicio corre `runner.run(provider)` en paralelo para cada emisor. Esa llamada nunca rechaza: devuelve un `SourceReport` con estado `ok`, `empty` o `error`.
3. `matchesQuery` filtra los resultados.
4. Se devuelve `{ matches, errors, sources }`.

## 4. Emisores

| key | Fuente | Registros (fixtures) | Notas |
|---|---|---|---|
| `santander` | JSON público | 315 | — |
| `bci` | API paginada con `BCI_SUBSCRIPTION_KEY` | 326 | La llave puede rotar |
| `tenpo` | HTML de Webflow + regex | 48 | Frágil |
| `tapp` | CMS Modyo, space `...-copia` | 6 | Revisar el space |
| `copec` | `/wp-json/custom/v1/beneficios/` | 48 vigentes / 313 | Filtra por vigencia en hora de Chile |
| `bancochile` | API Modyo `/api/content/spaces/personas/types/beneficios/entries` vía `r.jina.ai` (texto) | 919 | Desde la 2.0.0; antes era scraping de 9 páginas |
| `mercadopago` | Landing `mercadopago.cl/landing/beneficios-tarjeta-prepago` (estado incrustado) + landing por beneficio + términos de la campaña | — | 7 beneficios; incluye tipo de tarjeta, tope y vigencia |

## 5. Casos de aceptación (`tests/helpers/constants.js` → `ACCEPTANCE_CASES`)

| Emisor | Consulta | Beneficio esperado |
|---|---|---|
| Banco de Chile | `PROWASHGO` | ProwashGo |
| Tenpo | `temu` | Hasta 50% de descuento para nuevos usuarios de la App Temu |
| BCI | `pedidos ya` | PedidosYa |
| Santander | `burger king` | Burger King |
| Copec Pay | `Rappi`, `El Café Rosa` | Rappi, El Café Rosa |

## 6. Pruebas

- **Sin internet:** `npm test` usa las respuestas reales grabadas en `tests/fixtures/http/`. La fecha queda congelada en 2026-11-12 12:00 (hora de Chile), porque Copec Pay filtra por vigencia.
- **Golden:** `tests/fixtures/golden/` es la salida vigente. `golden-original/` es la del código 1.0.0 y **no se regenera**.
- **Procesos hijo:** el CLI y el servidor legado se prueban con `node -r tests/helpers/preload.js` (fetch simulado, fecha congelada, pausas aceleradas).
- **Actualizar datos:** `npm run fixtures:record -- <key>`, luego `npm run fixtures:golden`, y revisar el diff.
- **En vivo:** `npm run smoke`.

## 7. Dónde leer más

- `docs/openapi.yaml`: contrato v1 (errores, paginación, `Benefit`).
- `docs/AGREGAR_EMISOR.md`: plantilla de provider y checklist.
- `docs/CHANGELOG_REFACTOR.md`: mapa de `benefits.js` a los módulos y los 12 cambios de comportamiento.
- `docs/RIESGOS.md`: 15 riesgos con prioridad y recomendación.
- `entregable/diagnostico_copec_pay.md`: corrección de Copec Pay (endpoint REST oculto del tema).
