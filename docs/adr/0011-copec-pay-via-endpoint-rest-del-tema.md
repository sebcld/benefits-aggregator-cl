# 0011. Copec Pay a través del endpoint REST del tema WordPress

- **Estado:** Aceptado
- **Fecha:** 2026-11-12

## Contexto

El extractor de Copec Pay usaba `https://www.appcopec.cl/wp-json/wp/v2/promo_y_beneficios`, que pasó a redirigir (301) a una página HTML, y el parseo JSON fallaba. El sitio nuevo `https://copecpay.cl/beneficios/` entrega el HTML **sin beneficios**: los dibuja en el navegador el script `wp-content/themes/chris/js/beneficios-new.js`. El sitio solo muestra los beneficios vigentes.

## Alternativas consideradas

1. **Parsear el DOM.** No es posible: el HTML inicial no trae los beneficios.
2. **El REST estándar de WordPress** (`/wp-json/wp/v2/...`). `/wp-json/wp/v2/types` no expone ningún tipo de beneficios.
3. **Navegador headless** que ejecute el JavaScript. Funciona, pero requiere dependencias pesadas, en contra de [0002](0002-node-nativo-sin-dependencias-y-commonjs.md).
4. **Usar el mismo endpoint que llama el script del sitio:** `GET /wp-json/custom/v1/beneficios/` (elegida).

## Decisión

- **Fuente.** Una sola llamada a `https://copecpay.cl/wp-json/custom/v1/beneficios/`, que hoy devuelve unos 313 registros, sin paginación.
- **Validación.** Se valida el `content-type` JSON y que el cuerpo sea un arreglo; si no, se lanza `INVALID_RESPONSE`.
- **Vigencia.** Igual que el sitio, solo se incluyen los registros con `fecha_de_inicio` y `fecha_de_termino` y vigentes hoy. La comparación se hace en hora de Chile (`todayInChile`), con ambos extremos inclusive. `includeInactive: true` (solo desde la fachada) trae todos.
- **Campos extra.** Se agregan `category`, `validFrom`, `validUntil` y `logo`.

## Consecuencias

- **Positivas:**
  - Rápido (una petición) y con datos estructurados.
  - "Rappi" y "El Café Rosa" vuelven a encontrarse.
  - El resultado coincide con lo que muestra el sitio.
- **Negativas:**
  - El endpoint no está documentado y es propio del tema, así que puede cambiar sin aviso.
  - La CDN guarda la respuesta hasta 24 h (`s-maxage=86400`).
  - El filtro de vigencia se aplica al descargar, lo que interactúa con la caché ([0007](0007-cache-en-memoria-detras-de-cachestore.md)).

## Evidencia

- **Commit:** `f8352c7`.
- **Código:** `src/providers/copec.provider.js`.
- **Diagnóstico completo:** `entregable/diagnostico_copec_pay.md`.
