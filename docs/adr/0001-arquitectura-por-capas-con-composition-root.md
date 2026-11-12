# 0001. Arquitectura por capas con composition root

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Relación:** base de [0003](0003-contrato-de-provider-y-registro.md), [0007](0007-cache-en-memoria-detras-de-cachestore.md) y [0013](0013-reglas-de-arquitectura-con-lint-propio.md)

## Contexto

En la versión 1.0.0, `src/benefits.js` (618 líneas) mezclaba utilidades de texto, red, parsing de 7 emisores, reglas de negocio (como la vigencia de Copec Pay) y orquestación. Concretamente:
- los extractores usaban `fetch`, `new Date()` y `sleep` globales, así que no se podían probar sin internet;
- importar `src/config.js` leía `.env`, es decir, tenía efectos secundarios;
- el CLI se ejecutaba al importarse.

Hay una app móvil prevista, y equipos de backend, móvil y QA tienen que poder trabajar en paralelo.

## Alternativas consideradas

1. **Mantener un solo módulo y solo ordenarlo internamente.** Es el menor esfuerzo, pero no resuelve la testabilidad ni la separación de responsabilidades.
2. **Hexagonal completa** (puertos y adaptadores con interfaces formales para todo). Es más ceremonia de la que necesita un proyecto de unos 2.000 líneas, sin TypeScript ni contenedor de inyección.
3. **Capas "clean light" con un único composition root** (elegida). Las carpetas son `domain`, `shared`, `config`, `providers`, `services` e `interfaces`, y todo se arma en `bootstrap.js`.

## Decisión

- Las dependencias apuntan hacia `domain` (ver el [diagrama 2](../arquitectura/02-capas.md)).
- `src/bootstrap.js` (`createApp`) es el único lugar que crea las dependencias concretas: config, logger, `http-client`, registro de providers, caché, runner y `searchService`.
- `createApp` acepta como opciones `fetchImpl`, `clock`, `sleep`, `cache`, `providers`, `logger` y `timeouts`, para que los tests las reemplacen.
- Las interfaces (CLI y HTTP) no importan `services`: reciben el `app` ya armado.
- Ningún módulo tiene efectos al importarse. `loadConfig()` se llama de forma explícita y los entrypoints solo se ejecutan si son el módulo principal (`require.main === module`).

## Consecuencias

- **Positivas:**
  - Los providers y servicios se prueban con dobles inyectados: 241 tests sin red.
  - Agregar un emisor no toca servicios ni interfaces.
  - Ningún módulo pasa de 105 líneas.
- **Negativas:**
  - Hay más archivos (43 en `src/`) y un desarrollador nuevo tiene que entender el flujo de `createApp`.
  - La inyección es manual, sin contenedor: un parámetro nuevo de `createApp` hay que propagarlo a mano.

## Evidencia

- **Commits:** `1755f54` (shared, config, domain), `2f958e1` (providers), `387d5a8` (services y bootstrap), `175d95a` (CLI) y `0af036a` (HTTP).
- **Código:** `src/bootstrap.js`.
- **Documentación:** `docs/CHANGELOG_REFACTOR.md` (mapa de `benefits.js` a los módulos nuevos).
