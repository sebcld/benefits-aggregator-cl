# Cambios

Lo que cambió después del refactor 2.0.0 (para el refactor, ver [CHANGELOG_REFACTOR.md](CHANGELOG_REFACTOR.md)). Lo más reciente va arriba. Cada entrada dice qué cambia para quien usa la web o la API y dónde está el detalle.

## 2026-11-13: búsqueda, filtros y tarjetas

### Filtro "Solo" en el panel de emisores (web, escritorio), `4f4c169`

- **Antes:** con todos los emisores marcados, hacer clic en uno lo **desmarcaba** y dejaba los otros 7. Para quedarse con 2 había que desmarcar 6.
- **Ahora:** cada fila del panel tiene un botón **"Solo"** que deja seleccionado únicamente ese emisor. Después se marcan los que se quieran sumar: 2 o 3 emisores son 2 o 3 clics.
- **En móvil ya funcionaba así:** desde "Todos", tocar un chip filtra solo por ese emisor.
- **Código:** `onlyThis` en `web/src/lib/filters.ts`, y el botón en `IssuerCheckbox`.

### "Todos los beneficios": ver el catálogo completo sin buscar, `a858c8f`

- **Web:** página **`/beneficios`**, que reutiliza la pantalla de resultados (filtros con conteo, "Cargar más", "Actualizar" y el aviso si un emisor falla). Se llega desde:
  - el header (escritorio);
  - el inicio ("o mira todos los beneficios");
  - `/buscar` sin consulta o sin resultados.
- **API:** nuevo `GET /v1/benefits?banks=&page=&pageSize=&refresh=`, con los mismos parámetros que `/v1/search` sin `q`. `/v1/search` no cambia: sigue exigiendo `q`.
- **Orden intercalado por emisor:** el 1.º de cada emisor, luego el 2.º de cada uno, y así. En orden por emisor, las primeras ~26 páginas serían solo de Santander. Es estable entre peticiones; con un solo emisor filtrado, sale en el orden de su fuente.
- **No descarga nada extra:** lee la misma caché de catálogos que la búsqueda.
- **Por qué un endpoint propio** y no `q` opcional en `/v1/search`: [ADR 0023](adr/0023-listado-completo-en-endpoint-propio.md).
- **Datos en vivo (13-11-2026):** 1.761 beneficios en 147 páginas de 12.

### BCI: píldora de descuento, vigencia y días, `a60159c`

- **El problema:** las tarjetas de BCI no mostraban el % de descuento, la vigencia ni los días (por ejemplo, Starbucks 30% los lunes).
  - **La causa estaba en el provider, no en la web.** La API de BCI trae esos datos en campos estructurados, pero el provider no los leía.
  - La web buscaba el % en el título y la bajada, y en BCI ninguna de las 326 ofertas lo tiene ahí: el título es el comercio, y una oferta dice "50 por ciento", en palabras.
- **Descuento:**
  - sale de `deal.discount.percentage` ("30%");
  - los cashback salen de `deal.cashback`, con su tope ("7% cashback", tope $7.000).
- **Vigencia:**
  - sale de `fechaInicio` / `fechaTermino`, convertida a fecha de Chile (`2027-01-01T02:59Z` → 31-12-2026);
  - una vigencia ya vencida no se publica.
- **Días:** salen de `scheduling.dayRecurrence`, como texto ("Todos los lunes", "Martes, miércoles y jueves", "Todos los días"), con `src/shared/weekdays.js`.
- **API v1:** dos campos opcionales nuevos en `Benefit`:
  - `discount`: dato estructurado, con prioridad sobre el texto;
  - `schedule`: los días.

  La forma 1.x no los incluye; BCI solo suma ahí `validFrom`/`validUntil`.
- **Web:**
  - la píldora usa primero `discount`;
  - una pastilla nueva con reloj muestra los días;
  - un cashback dice "CASHBACK", no "DCTO". Esto también cambia Turbus de Mercado Pago a "15% CASHBACK".
- **Cobertura en las 326 ofertas:**
  - **descuento:** 287 (las 39 restantes traen 0% en la fuente);
  - **vigencia:** 323;
  - **días:** 220.

## 2026-11-13: emisores, seguridad y despliegue

- **API key en la API** (`8522304`):
  - `API_KEYS=web:<llave>` en la API y `BENEFITS_API_KEY` en la web;
  - toda ruta exige `Authorization: Bearer` o `x-api-key`, salvo `GET /health`, y responde 401 sin ella;
  - la web rechaza una llave con prefijo `NEXT_PUBLIC_`;
  - detalle en el [ADR 0014](adr/0014-autenticacion-con-api-key.md).
- **Guía de despliegue** (`5645ea7`): Vercel, Render o servidor propio ([DESPLIEGUE.md](DESPLIEGUE.md)).
- **Tests aislados del `.env` local** (`664d569`): un `API_KEYS` local hacía fallar los tests de la API legada.
- **Entel como emisor nuevo** (`25f7697`, `ed6c79e`): 92 beneficios del Club Entel, desde el HTML de la lista y de cada ficha (no hay API JSON). Incluye condiciones, vigencia, tope y su color en la web.
- **"Destacados de hoy" también en escritorio** (`2b4a978`): una grilla de 3 columnas, sin quitar "Cómo funciona" ni las fuentes.

## 2026-11-12

- **Antigüedad de los datos y botón "Actualizar"** (`c975c42`):
  - `sources[].fetchedAt`, `meta.refreshableAt` y `refresh=true`;
  - como mucho una descarga cada 5 min por emisor (`CACHE_REFRESH_MIN_AGE_SECONDS`);
  - si la actualización falla, se mantiene el catálogo anterior.
- **Mercado Pago desde la landing de la tarjeta prepago** (`abe3f31`, `7bd3995`):
  - 7 beneficios, con tarjeta, tope, vigencia y términos;
  - se eliminaron la búsqueda en Mercado Libre (respondía 403) y `queryDependent`;
  - detalle en el [ADR 0018](adr/0018-futuro-de-mercado-pago.md).
- **Categorías de búsqueda** (`4c63de9`): `gas`, `bus` y `taxi` encuentran a sus comercios en todos los emisores.
- **Búsqueda de marcas compuestas** (`c02ec04`): `bus` encuentra "FlixBus".
- **Arreglos por emisor:**
  - **Tapp:** solo vigentes, y la descripción sin CSS (`8cad2f0`).
  - **Tenpo:** logo del comercio (`ca260a5`).
  - **BCI:** el título es el comercio, con enlace a su ficha (`c638dfd`) y logo `imagen4` (`f051196`).
- **Caché:** un catálogo vacío se guarda solo 1 minuto (`0fdae81`).
- **Web:**
  - **inicial:** Next.js con BFF (`823813e`);
  - **destacados con caché de 2 horas:** `a49b9fa`, `2e2eb53`;
  - **colores por emisor:** `8b5cf37`;
  - **logos completos:** `452c40e`;
  - **favicon:** `9865b61`;
  - **sin FigCraft:** `tokens.css` pasa a ser la fuente que se edita (`ffc197d`).
- **Node 26 y CI con GitHub Actions** (`830f8cb`, `b85fcae`).
- **Los golden de la app 1.0.0 se retiraron** (`07e0e32`): ya habían cumplido su función ([ADR 0009](adr/0009-tests-de-caracterizacion-con-fixtures-y-golden.md)).
