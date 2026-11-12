# 0012. Banco de Chile a través de la API de contenido Modyo y `r.jina.ai`

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Relación:** usa [0003](0003-contrato-de-provider-y-registro.md); [0021](0021-acceso-a-banco-de-chile-sin-proxy-gratuito.md) propone revisarla

## Contexto

En 1.0.0, Banco de Chile se obtenía recorriendo 9 páginas del sitio en formato Markdown (vía `r.jina.ai`) con regex. Así se obtenían unos 62 registros, y una lista de comercios de la campaña Big5 estaba escrita a mano tres veces. El caso de aceptación "PROWASHGO" no aparecía.

La página de referencia, `https://sitiospublicos.bancochile.cl/personas/beneficios/todos-los-beneficios`, carga sus datos desde la API de contenido de Modyo (`/api/content/spaces/personas/types/beneficios/entries`). El sitio está detrás de Incapsula: el acceso directo responde 403 a la página y 302 (desafío) a la API.

## Alternativas consideradas

1. **Mantener el scraping de 9 páginas.** No encuentra PROWASHGO, porque solo ve el primer lote de cada página, y además la regex tenía un defecto documentado.
2. **Acceder directo a la API.** Bloqueado por Incapsula.
3. **Navegador headless propio.** Requiere dependencias e infraestructura ([0002](0002-node-nativo-sin-dependencias-y-commonjs.md)).
4. **La API de contenido a través de `r.jina.ai`, pidiendo la respuesta como texto** (elegida).

## Decisión

- **Fuente.** `https://r.jina.ai/http://sitiospublicos.bancochile.cl/api/content/spaces/personas/types/beneficios/entries?per_page=100&page=N`, con el header `x-return-format: text`.
- **Paginación.** Hoy son 10 páginas y 919 registros. Hay un tope de 50 páginas y una pausa de 500 ms entre ellas, y los 429 se reintentan hasta 5 veces.
- **`JINA_API_KEY` opcional.** Si existe, se envía como `authorization: Bearer`.
- **Mapeo:**
  - `Titulo`, `Extracto`, `Descripcion`, `Keywords` y `Tipo Beneficio`, más `category` (`meta.category_name`);
  - `validUntil` (`meta.unpublish_at`, en fecha de Chile) y `logo` (`fields.Logo.url`);
  - URL `/personas/beneficios/detalle/<slug>`.
- **Se elimina la lista de Big5,** porque KFC, Dunkin', Wendy's, Domino's y McDonald's vienen como beneficios propios.
- **Es un cambio de comportamiento explícito,** pedido para el caso PROWASHGO y aislado en su propio commit para poder revertirlo.

## Consecuencias

- **Positivas:**
  - 919 beneficios en lugar de 62, con categoría, vigencia y logo.
  - Desaparece el código frágil de regex y la lista escrita a mano.
- **Negativas:**
  - Se depende de un servicio de terceros, gratuito y con límite de uso. Ya hubo variabilidad: una corrida superó los 60 s.
  - Es el emisor más lento con la caché fría (unos 16 s).
  - Se incluyen 226 registros con `Indexar: false`, que quizá el sitio no muestra (`docs/RIESGOS.md` #13).
  - Cambian los resultados históricos de Banco de Chile.

## Evidencia

- **Commit:** `8e4acca` (revertible por separado).
- **Código:** `src/providers/bancochile.provider.js` y `bancochile.parser.js`.
- **Tests:** `tests/acceptance/emisores.test.js` y `tests/unit/providers/bancochile.test.js`.
- **Diagrama:** [7](../arquitectura/07-flujo-datos-emisor.md).
