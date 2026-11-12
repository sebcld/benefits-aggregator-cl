# 0019. ESLint y Prettier como devDependencies

- **Estado:** **Propuesto** (no implementado)
- **Fecha:** 2026-11-12
- **Relación:** complementa [0013](0013-reglas-de-arquitectura-con-lint-propio.md); excepción acotada a [0002](0002-node-nativo-sin-dependencias-y-commonjs.md) (solo desarrollo)

## Contexto

El estilo del proyecto (2 espacios, comillas simples, punto y coma, trailing commas, unas 100 columnas) se mantiene a mano. `scripts/lint.js` verifica arquitectura y sintaxis, pero no formato, variables sin usar ni errores comunes. Ya hay líneas de más de 100 columnas. Con varios equipos trabajando, el formato manual genera diffs ruidosos.

## Alternativas consideradas

1. **Seguir solo con el lint propio.**
   - Pros: sin dependencias.
   - Contras: no cubre estilo ni calidad.
2. **ESLint (con `eslint-config-prettier`) y Prettier como devDependencies.**
   - Configuración: `singleQuote`, `semi`, `trailingComma: "all"` y `printWidth: 100`.
   - Pros: estándar de facto, integración con editores, autoformato al guardar.
   - Contras: unas cuantas devDependencies y configuración que mantener.
3. **Biome** (una sola herramienta que formatea y hace lint).
   - Pros: una dependencia, muy rápida.
   - Contras: un ecosistema de reglas más chico, y menos conocido por el equipo.

## Recomendación

**Opción 2.** Además:
- conservar `scripts/lint.js` para las reglas de arquitectura, o migrarlas después a `eslint-plugin-boundaries`;
- aplicar el formato en **un solo commit separado**, para que el `git blame` siga siendo útil (`.git-blame-ignore-revs`).

`npm run check` correría `prettier --check`, `eslint`, el lint de arquitectura y los tests. No afecta a [0002](0002-node-nativo-sin-dependencias-y-commonjs.md) en runtime: `npm install --omit=dev` sigue sin descargar nada.

## Consecuencias si se aprueba

- **Positivas:** el formato es automático y los diffs quedan limpios, y se detectan errores comunes, como variables sin usar.
- **Negativas:**
  - `npm install` descarga paquetes para desarrollo.
  - El primer commit de formato toca muchos archivos.
