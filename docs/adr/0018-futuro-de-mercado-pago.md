# 0018. Futuro de Mercado Pago como emisor

- **Estado:** Aceptado. Se implementó la opción 3: se reemplazó la fuente por la landing de beneficios de la Tarjeta Mercado Pago.
- **Fecha:** 2026-11-12

## Contexto

`mercadopago.provider.js` consultaba `https://api.mercadolibre.com/sites/MLC/search`, que es la búsqueda de **productos** de Mercado Libre, no un catálogo de beneficios de Mercado Pago. Sin token respondía **403** en todas las búsquedas, lo que tenía tres efectos:
- siempre aparecía en `errors` y dejaba `meta.partial: true` en todas las respuestas;
- dejaba `/v1/health` en `degraded` de forma permanente;
- la web mostraba el aviso de "resultado parcial" en cada búsqueda.

Se comportaba así desde la 1.0.0 (`docs/RIESGOS.md` #1).

## Alternativas consideradas

1. **Mantenerlo como estaba.**
   - Pros: no hay cambio de comportamiento.
   - Contras: el ruido es permanente en `errors` y en `health`, y no aporta beneficios reales.
2. **Quitarlo del registro.**
   - Pros: las respuestas quedan limpias.
   - Contras: desaparece de `/v1/banks`, y `banks=mercadopago` pasa a responder 400 `UNKNOWN_BANK`.
3. **Reemplazarlo por la fuente real de beneficios de Mercado Pago** (elegida). La fuente es [Beneficios tarjeta Mercado Pago](https://www.mercadopago.cl/landing/beneficios-tarjeta-prepago).
4. **Marcarlo como opcional,** de modo que no cuente para `meta.partial` ni para `health`.
   - Pros: no hay que quitarlo.
   - Contras: agrega una excepción al contrato y oculta un emisor que no funciona.

## Decisión

**Opción 3.** Se inspeccionó la red de la landing:
- **No hay una API JSON pública.** La página se renderiza en el servidor y solo hace llamadas de telemetría (`melidata/tracks`). Las variantes `?format=json`, `.json` y `/v2/discounts/campaign/<id>` responden HTML, 302 o 404.
- **Los datos están incrustados en el HTML** como estado serializado, en `_n.ctx.s["nr"].q("…")`. Es casi JSON, con tres marcas propias: `u`, `@N` y `D"…"`.
- **Se lee ese estado, no el HTML visual.** Es más estable y más liviano que interpretar las tarjetas.

La extracción tiene tres niveles. Los niveles 2 y 3 son opcionales: si fallan, el beneficio se publica igual con los datos de la lista.

| Nivel | Fuente | Datos |
|---|---|---|
| 1 | Landing de la lista (sección `filtered-cards-section`) | Los beneficios activos: comercio, descripción, tipo de tarjeta, categoría, logo y link |
| 2 | Landing de cada beneficio (`image-text-section` y `tyc-section`) | Descuento ("15% OFF presencial"), condición e id de campaña |
| 3 | Términos de la campaña (`api.mercadopago.com/v2/discounts/campaign/<id>/terms/html`) | Vigencia, tope y tarjeta exacta ("prepago física o NFC") |

Además:
- **Pasa a ser un catálogo.** Se guarda en caché y se precarga como los demás emisores. El soporte para emisores que buscan por consulta (`queryDependent`, con caché por consulta) solo existía para el Mercado Pago anterior, así que se eliminó del contrato de providers, del runner y del warm-up. En `/v1/banks`, `searchMode` queda siempre en `catalog`, por compatibilidad.
- **Sin credenciales.** `MELI_ACCESS_TOKEN` y `MERCADOPAGO_TOKEN` se eliminaron de la configuración. Si quedan en un `.env`, se ignoran.
- **Campos nuevos en la API v1:** `cardType`, `discountCap` y `termsUrl`, opcionales y en `null` para los demás emisores. Como `id` y `logo`, la forma 1.x no los expone.

## Consecuencias

- **Positivas:**
  - Mercado Pago aporta los 7 beneficios reales.
  - `meta.partial` y `/v1/health` vuelven a ser señales útiles.
  - La web deja de mostrar el aviso de resultado parcial en todas las búsquedas.
- **Negativas:**
  - **Dependencia del formato interno de la plataforma de landings.** Si Mercado Pago cambia el formato del estado o los tipos de sección, el provider falla con `INVALID_RESPONSE` en vez de devolver datos incorrectos.
  - **La vigencia y el tope salen de texto legal libre.** Se extraen con dos formatos conocidos y, si no coinciden, quedan vacíos.
  - **Términos desactualizados.** Lipigas 50% aparece en la landing, pero sus términos dicen que venció el 31/07/2026. Se publica sin fecha de vigencia.
  - **Cambio visible para clientes 1.x.** Ya no reciben el error de Mercado Pago en `errors` y ahora reciben sus beneficios. El golden de la API legada lo registra.

## Evidencia

- **Código:** `src/providers/mercadopago.provider.js` y `mercadopago.parser.js`.
- **Pruebas:** `tests/unit/providers/mercadopago.test.js` y `tests/fixtures/http/mercadopago.json`, con 14 respuestas reales recortadas a lo que usa el parser.
