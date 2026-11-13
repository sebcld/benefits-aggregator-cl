# 0003. Contrato de provider y registro de emisores

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Relación:** depende de [0001](0001-arquitectura-por-capas-con-composition-root.md); lo usa [0012](0012-banco-de-chile-via-api-modyo-y-jina.md)

## Contexto

En 1.0.0, `searchBenefits` tenía siete `if (shouldInclude('X'))` escritos a mano, y cada `fetchX` repetía el mismo patrón: `fetch`, revisar `if (!response.ok)` y lanzar el error. Agregar un emisor obligaba a tocar el orquestador. Además, los extractores accedían directamente a la red, al reloj y a `process.env`.

## Alternativas consideradas

1. **Herencia** *(reconstruida)*: una clase base `Provider` con métodos plantilla. Acopla los emisores a una jerarquía, y la mayoría de los emisores es una función de parsing más una o varias peticiones.
2. **Descubrimiento automático** *(reconstruida)* de archivos `*.provider.js`. Agregar un emisor no tocaría ningún otro archivo, pero el orden de los resultados quedaría implícito, y ese orden forma parte del comportamiento histórico.
3. **Objeto con contrato más un registro explícito** (elegida).

## Decisión

- **Contrato.** Cada emisor es un objeto `{ key, name, fetch(ctx) }` creado con `defineProvider`, que valida el contrato y congela el objeto. `fetch` devuelve el catálogo completo del emisor.
- **Acceso a recursos.** `fetch(ctx)` solo accede al mundo exterior a través de `ctx`: `http`, `config`, `now`, `sleep`, `signal`, `options` y `logger`.
- **Parsing puro.** El parsing va en funciones puras exportadas (`parseSantander`, `parseCopec`, `parseBancoChileEntry`, etc.).
- **Registro.** `src/providers/index.js` (`DEFAULT_PROVIDERS`) es una lista explícita cuyo orden es el orden de los resultados. `createProviderRegistry` rechaza `key` o `name` duplicados y permite elegir emisores por nombre visible o, si se pide `allowKeys`, por `key`.
- **Solo catálogos.** Hasta el [0018](0018-futuro-de-mercado-pago.md), el contrato tenía un campo `queryDependent` para emisores que buscaban por texto en la fuente, con caché por consulta. Lo usaba solo el Mercado Pago anterior; cuando pasó a leer un catálogo, se eliminó.

## Consecuencias

- **Positivas:**
  - Agregar un emisor es un archivo más una línea, sin tocar servicios ni interfaces.
  - Los parsers se prueban con objetos, sin simular HTTP.
  - El timeout puede cancelar el trabajo de un provider a través de `signal`.
- **Negativas:**
  - El contrato se verifica en tiempo de ejecución, no en compilación: no hay TypeScript, solo JSDoc.
  - Un provider puede ignorar `signal` y seguir trabajando después del timeout. El runner igual descarta su resultado.

## Evidencia

- **Commit:** `2f958e1`.
- **Código:** `src/providers/provider.interface.js` y `src/providers/index.js`.
- **Guía:** `docs/AGREGAR_EMISOR.md`.
- **Tests:** `tests/unit/domain/entry-registry.test.js`.
