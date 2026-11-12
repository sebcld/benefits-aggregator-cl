# 0004. `Entry` validado, inmutable y con `id` estable

- **Estado:** Aceptado
- **Fecha:** 2026-11-12

## Contexto

Cada extractor de 1.0.0 armaba su propio objeto literal, con claves y orden distintos según el emisor y sin identificador. Para la app móvil hacía falta una clave estable por beneficio (listas, favoritos, deep links) y un logo. Además, con la caché ([0007](0007-cache-en-memoria-detras-de-cachestore.md)), los mismos objetos se comparten entre peticiones. Y la salida JSON legada depende del orden exacto de las claves de cada emisor.

## Alternativas consideradas

1. **Normalizar todos los `Entry` con todas las claves** (con `''` en los campos vacíos). El modelo queda más uniforme, pero cambia la salida legada (agrega claves y altera el orden), y eso violaba la regla de no cambiar el comportamiento observable.
2. **Id incremental o UUID al descargar** *(reconstruida)*. Cambiaría en cada descarga, así que no sirve como clave estable.
3. **Factory que respeta el orden recibido, agrega `id` y `logo` al final y congela el objeto** (elegida).

## Decisión

- **`createEntry(fields, { sourceId, logo })`** (`src/domain/entry.js`):
  - exige `bank`;
  - valida que los campos de texto conocidos sean `string`;
  - conserva el orden de las claves;
  - agrega `id` y, si existe, `logo`;
  - devuelve el objeto congelado (`Object.freeze`).
- **`id`** = `<slug del emisor>-<12 hex de sha1(bank|sourceId)>`. `sourceId` es el identificador de la fuente (`uuid` en Banco de Chile y Tapp, `id` en Santander, BCI y Copec Pay); si la fuente no lo trae (Tenpo), se usa `url|slug|title`.
- **`toLegacyEntry`** quita `id` y `logo`, para que la API legada, el CLI y la fachada entreguen exactamente la forma 1.x.

## Consecuencias

- **Positivas:**
  - `id` y `logo` disponibles para la app.
  - La caché no puede corromperse por una mutación accidental.
  - La salida legada es idéntica byte a byte (lo verifican los tests de caracterización).
  - Con los fixtures actuales no hay `id` repetidos en ningún emisor.
- **Negativas:**
  - **La validación es estricta.** Si una fuente cambia un campo a otro tipo (por ejemplo, un `slug` numérico), el emisor completo queda en `errors`. Se prefirió una falla visible a datos corruptos (`docs/RIESGOS.md` #12).
  - **El `id` de Tenpo depende de la URL:** si Tenpo cambia la URL de un beneficio, su `id` cambia.
  - **La forma interna (`Entry`) y la pública (`Benefit` en v1) son distintas**, así que hay que mantener el serializer.

## Evidencia

- **Código:** `src/domain/entry.js`.
- **Tests:** `tests/unit/domain/entry-registry.test.js` y `tests/unit/providers/providers.test.js` (los ids son estables entre ejecuciones).
