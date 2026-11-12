# 0009. Tests de caracterización con fixtures reales y golden

- **Estado:** Aceptado
- **Fecha:** 2026-11-12

## Contexto

La versión 1.0.0 no tenía tests (`npm test` era un placeholder) y el refactor tenía que demostrar que no cambiaba resultados. Las fuentes son 7 sitios externos: sus datos cambian a diario, aplican límites de uso y a veces fallan (`r.jina.ai`). El filtro de Copec Pay depende de la fecha del día. Unos tests contra los sitios reales no son deterministas.

## Alternativas consideradas

1. **Tests contra los sitios reales.** Son realistas, pero lentos, no deterministas y dependen de internet.
2. **Datos sintéticos escritos a mano.** Son deterministas, pero no capturan rarezas reales: la regex de Tenpo, entidades HTML o campos faltantes.
3. **Respuestas reales grabadas una vez (fixtures) más la salida de referencia generada con el código original (golden)** (elegida).

## Decisión

- **Fixtures.** `npm run fixtures:record` graba en `tests/fixtures/http/` la URL, el status, el content-type y el body de cada respuesta, sin los headers de la petición, para que la llave de BCI no quede guardada. Banco de Chile se recorta a los campos que usa el parser.
- **Golden original.** `tests/fixtures/golden-original/` se generó **una vez** con el código 1.0.0 (`f8352c7`) y no se regenera. `original-equivalence.test.js` compara contra él, salvo los cambios declarados en el mismo test.
- **Golden vigente.** `tests/fixtures/golden/` se regenera solo con `npm run fixtures:golden`, cuando hay un cambio intencional, y se revisa con `git diff`.
- **Procesos hijo.** El CLI y el servidor legado se prueban como procesos separados, con `-r tests/helpers/preload.js`, que reemplaza `fetch`, congela `Date` en 2026-11-12 12:00 (hora de Chile) y acelera las pausas.
- **Pruebas en vivo.** `npm run smoke` corre los casos de aceptación contra las fuentes reales. Es opcional y requiere internet.

## Consecuencias

- **Positivas:**
  - 241 tests deterministas en unos 5 s, sin internet.
  - La equivalencia con 1.x quedó demostrada byte a byte.
  - Un cambio intencional deja un diff revisable en git.
- **Negativas:**
  - Unos 5,7 MB de fixtures en el repositorio.
  - Los fixtures envejecen: no detectan que una fuente cambió hasta correr `smoke` o volver a grabar.
  - Los helpers tienen detalles finos: hay que usar `setEncoding('utf8')` en los procesos hijo (un bug ya corregido) y normalizar CRLF en Windows (corregido en `971b498`).

## Evidencia

- **Commits:** `6ef3bc2`, `8e4acca` (fixture de Banco de Chile recortado) y `971b498`.
- **Código:** `tests/helpers/` y `tests/tools/`.
- **Diagrama:** [12](../arquitectura/12-estrategia-pruebas.md).
