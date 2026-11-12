# 0018. Futuro de Mercado Pago como emisor

- **Estado:** **Propuesto** (no implementado)
- **Fecha:** 2026-11-12

## Contexto

`mercadopago.provider.js` consulta `https://api.mercadolibre.com/sites/MLC/search`: es la búsqueda de **productos** de Mercado Libre, no un catálogo de beneficios de Mercado Pago. Sin token responde **403** en todas las búsquedas, lo que tiene tres efectos:
- siempre aparece en `errors` y deja `meta.partial: true` en todas las respuestas;
- deja `/v1/health` en `degraded` de forma permanente;
- le enseña a la app que "parcial" es lo normal.

Desde 1.0.0 se comporta así y está documentado (`docs/RIESGOS.md` #1).

## Alternativas consideradas

1. **Mantenerlo como está.**
   - Pros: no hay cambio de comportamiento.
   - Contras: el ruido es permanente en `errors` y en `health`, y no aporta beneficios reales.
2. **Quitarlo del registro**, borrando una línea en `src/providers/index.js` y dejando el archivo para referencia o eliminándolo.
   - Pros: las respuestas quedan limpias y `health` vuelve a ser útil.
   - Contras: es un cambio de comportamiento. Desaparece de `/v1/banks`, y un `banks=mercadopago` pasa a responder 400 `UNKNOWN_BANK`.
3. **Reemplazarlo por la fuente real de beneficios de Mercado Pago.** Habría que investigarla con el método de `docs/AGREGAR_EMISOR.md`.
   - Pros: aporta datos reales.
   - Contras: no se sabe si existe una fuente pública.
4. **Marcarlo como opcional:** que no cuente para `meta.partial` ni para `health`.
   - Pros: sin quitarlo.
   - Contras: agrega una excepción al contrato y oculta un emisor que no funciona.

## Recomendación

**Opción 2 ahora y opción 3 como trabajo posterior.** Al quitarlo:
- documentarlo en `CHANGELOG_REFACTOR.md`;
- actualizar los ejemplos de `openapi.yaml` (la lista de `/v1/banks` y `allowed`);
- regenerar el golden, cuyo diff solo debería quitar las entradas de error de Mercado Pago;
- ajustar `original-equivalence.test.js`, porque los `errors` dejarían de coincidir con 1.x.

## Consecuencias si se aprueba

- **Positivas:** `meta.partial` y `/v1/health` vuelven a ser señales útiles, con menos peticiones y menos ruido en el log.
- **Negativas:** es un cambio visible para clientes 1.x, que ya no recibirán el error de Mercado Pago en `errors`. Hay que avisarlo.
