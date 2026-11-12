# 0002. Node nativo, sin dependencias de runtime y en CommonJS

- **Estado:** Aceptado. La versión mínima de Node (`>= 18`) quedó **reemplazada por [0020](0020-actualizacion-a-node-26-y-ci.md)** (`>= 26`); el resto sigue vigente.
- **Fecha:** 2026-11-12
- **Relación:** condiciona [0013](0013-reglas-de-arquitectura-con-lint-propio.md); [0016](0016-cachestore-compartido-en-redis.md) y [0019](0019-eslint-y-prettier.md) proponen excepciones

## Contexto

El proyecto nació sin dependencias (`package.json` sin `dependencies`). El brief del refactor lo fijó como regla: no agregar dependencias de runtime sin justificarlas y mantener CommonJS, salvo que se justifique migrar a ESM. Node 18 o superior ya trae `fetch`, `AbortSignal.timeout`, `node:test` y `Intl`.

## Alternativas consideradas

1. **Express o Fastify para HTTP**, más librerías de validación (zod) y logging (pino). Son herramientas conocidas, pero suman dependencias, mantenimiento y superficie de ataque. Quedaron descartadas por la regla del brief.
2. **Migrar a ESM.** Se evaluó y se descartó porque no había un beneficio concreto, y la fachada `src/benefits.js` debe seguir siendo usable con `require` por los consumidores 1.x.
3. **Solo módulos nativos y CommonJS** (elegida).

## Decisión

- **Las piezas de infraestructura se escriben con módulos nativos** y son pequeñas y probadas:
  - router con coincidencia exacta (`src/interfaces/http/router.js`);
  - body parser con límite de tamaño;
  - CORS;
  - logger JSON;
  - caché con TTL;
  - lector de `.env`.
- **El proyecto sigue en CommonJS.** `package.json` declara `"type": "commonjs"` y `engines.node >= 18`.
- **Solo se aceptan devDependencies con aprobación explícita.** Hoy no hay ninguna.

## Consecuencias

- **Positivas:** `npm install` no descarga nada, no hay vulnerabilidades de terceros que vigilar y el arranque es inmediato.
- **Negativas:**
  - El código de infraestructura es propio y hay que mantenerlo: el router no tiene parámetros de ruta y el parser de `.env` no admite valores multilínea.
  - El estilo de código se mantiene a mano ([0019](0019-eslint-y-prettier.md) propone resolverlo).
  - Usar Redis en el futuro probablemente requiera una dependencia ([0016](0016-cachestore-compartido-en-redis.md)).
  - El código no se probó en Node 18, aunque evita APIs posteriores como `AbortSignal.any` y `process.loadEnvFile`. Sí se probó en Node 24 y en Node 26. [0020](0020-actualizacion-a-node-26-y-ci.md) subió la versión mínima a Node 26 y agregó CI.

## Evidencia

- `package.json`: sin `dependencies` ni `devDependencies`.
- `src/shared/async.js`: `anySignal` reemplaza a `AbortSignal.any` (Node 20.3+).
- `src/config/env-file.js`: parser propio en lugar de `process.loadEnvFile` (Node 20.12+).
