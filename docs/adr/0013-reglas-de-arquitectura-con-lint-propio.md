# 0013. Reglas de arquitectura verificadas con un lint propio

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Relación:** depende de [0001](0001-arquitectura-por-capas-con-composition-root.md) y [0002](0002-node-nativo-sin-dependencias-y-commonjs.md); [0019](0019-eslint-y-prettier.md) propone complementarlo

## Contexto

Las reglas de capas ([0001](0001-arquitectura-por-capas-con-composition-root.md)) y de secretos ([0010](0010-secretos-en-env-via-config-validada.md)) solo sirven si alguien las verifica. ESLint y Prettier requieren devDependencies, y [0002](0002-node-nativo-sin-dependencias-y-commonjs.md) exige aprobación para agregarlas.

## Alternativas consideradas

1. **Solo revisión manual en los PR.** No escala y depende de quién revise.
2. **ESLint con `eslint-plugin-boundaries` o `import/no-restricted-paths`.** Es estándar y se integra con el editor, pero requiere dependencias no aprobadas. Queda como propuesta en [0019](0019-eslint-y-prettier.md).
3. **Un script propio sin dependencias** (elegida).

## Decisión

`scripts/lint.js` (`npm run lint`, incluido en `npm run check`):
- revisa la sintaxis de todo `.js` con `node --check`;
- falla si un módulo de `src/` pasa de 200 líneas;
- falla si aparece `process.env` fuera de `src/config/`;
- falla si se usa `fetch` global fuera de `src/shared/http-client.js`;
- falla si hay una llave de 32 caracteres hexadecimales en `src/` o en `docs/`;
- falla si se rompe una dependencia prohibida entre capas (tabla en el [diagrama 2](../arquitectura/02-capas.md)).

Las reglas de código ignoran los comentarios.

## Consecuencias

- **Positivas:**
  - Las reglas se verifican en cada `npm run check`, sin dependencias.
  - Se probó con un archivo trampa que detecta los tres tipos de violación.
- **Negativas:**
  - **No cubre estilo** (formato, variables sin usar).
  - **Su detección de imports es por regex** (`require('...')`), así que no ve imports dinámicos.
  - **`interfaces/` no tiene restricciones.** Que solo importe `shared` y `domain` es una convención, no una regla.
  - **Hubo que corregir la lectura de `docs/`.** La primera versión no recorría subcarpetas: al crear `docs/arquitectura/` y `docs/adr/` intentaba leer una carpeta como archivo y fallaba con `EISDIR`. Se corrigió con un listado recursivo (`listFiles`) de `.md`, `.yaml` y `.yml`, y la regla de llaves ahora cubre también las subcarpetas.

## Evidencia

- **Commit:** `cc096df`, más la corrección de `listFiles` en la rama `docs/arquitectura-adr`.
- **Código:** `scripts/lint.js`.
