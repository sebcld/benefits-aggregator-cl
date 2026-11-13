# 0023. Listado completo de beneficios en un endpoint propio

- **Estado:** Aceptado
- **Fecha:** 2026-11-13
- **Relación:** extiende [0006](0006-api-versionada-v1-con-rutas-legadas.md); reutiliza la caché de [0007](0007-cache-en-memoria-detras-de-cachestore.md)

## Contexto

La web necesitaba una forma de **ver todos los beneficios sin buscar un comercio** (la página `/beneficios`). La caché ya guarda el catálogo completo de cada emisor ([0007](0007-cache-en-memoria-detras-de-cachestore.md)), pero vive dentro del proceso de la API: los clientes (la web, la futura app móvil) solo llegan a ella por HTTP.

La única ruta que entregaba beneficios era `/v1/search`, que exige `q` (sin ella responde 400 `MISSING_QUERY`) y siempre filtra con el matcher. Ninguna consulta coincide con todo, así que la caché tenía los datos pero ninguna ruta los devolvía completos.

Además, en orden de emisor (el de la búsqueda), las primeras ~26 páginas de 12 serían solo de Santander (315 beneficios).

## Alternativas consideradas

1. **`q` opcional en `/v1/search`** (sin `q`, todo).
   - Pros: una ruta menos.
   - Contras:
     - cambia un contrato existente: un cliente podría depender del 400 `MISSING_QUERY`;
     - el orden dependería de si se envía `q` o no;
     - mezcla dos operaciones (buscar y listar) en una.
2. **Un endpoint por emisor** (`/v1/banks/{key}/benefits`).
   - Pros: URL expresiva.
   - Contras: para "todos" habría que llamar a 8 rutas y juntar y paginar en el cliente.
3. **Endpoint propio `GET /v1/benefits`** (elegida), con los mismos parámetros que la búsqueda salvo `q`.

## Decisión

- **`GET /v1/benefits?banks=&page=&pageSize=&refresh=`.**
  - **Comparte con `/v1/search`:** validación (`parseV1Listing`), paginación, errores, API key, caché y `refresh`.
  - **Respuesta:** la de la búsqueda sin `query` (`BenefitsResponse`). El bloque `meta` es compartido (`ResponseMeta`).
- **Intercalado por emisor:** el 1.º de cada emisor, luego el 2.º de cada uno, etc. (`interleave` en `search-service.js`).
  - **Mezcla:** cada página mezcla emisores.
  - **Estable:** el orden se mantiene entre peticiones, así que "Cargar más" no repite ni salta.
  - **Con un solo emisor filtrado:** el orden de su fuente.
- **Sin descargas extra:** `listAll` usa el mismo `runner.run` que `search`, que lee la caché.
- **Conteos de la web:** el BFF (`/api/beneficios`) los saca de `sources[].count`. Sin filtro, salen de la misma respuesta; con filtro, de una petición extra con `pageSize=1`.

## Consecuencias

- **Positivas:**
  - Es aditivo: ningún cliente de `/v1/search` cambia.
  - "Buscar" y "listar" quedan como operaciones separadas y documentadas en el OpenAPI.
  - La primera página ya muestra los 8 emisores.
- **Negativas:**
  - Una ruta más que mantener. Se mitiga porque comparte la validación y el serializer con la búsqueda.
  - El orden intercalado no sigue la "relevancia". No hay datos para ordenar por relevancia sin una consulta; si un día los hay, se agrega un parámetro `order`.

## Evidencia

- **Código:**
  - API: `src/services/search-service.js` (`listAll`, `interleave`), `src/interfaces/http/controllers/search.controller.js` (`v1ListAll`) y `src/interfaces/http/validation.js` (`parseV1Listing`).
  - Web: `web/src/app/api/beneficios/route.ts` y `web/src/app/beneficios/page.tsx`.
- **Tests:**
  - API: `tests/unit/services/search-service.test.js` y `tests/interfaces/http-v1.test.js`.
  - Web: `web/tests/unit/bff.test.ts` y `web/e2e/results.spec.ts`.
- **En vivo (2026-11-13):** 1.761 beneficios en 147 páginas, con los 8 emisores en la primera.
