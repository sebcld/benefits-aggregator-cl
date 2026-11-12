# 0006. API versionada `/v1`, conservando las rutas 1.x

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Relación:** usa [0004](0004-entry-inmutable-con-id-estable.md) y [0005](0005-errores-con-codigo-estable.md); la extienden [0014](0014-autenticacion-con-api-key.md) y [0015](0015-rate-limiting.md)

## Contexto

La API 1.x (`/search`, `/health`) tenía varios problemas:
- devolvía el `Entry` interno, con campos distintos por emisor y `""` en los vacíos;
- no tenía paginación ni identificadores;
- reconocía las rutas con `startsWith`, así que `/searchXYZ` respondía como `/search`.

La regla del refactor era mantener la compatibilidad de las respuestas. Al mismo tiempo, una app móvil necesita un contrato estable y liviano.

## Alternativas consideradas

1. **Cambiar las rutas existentes.** Es más simple, pero rompe a los clientes 1.x.
2. **Versionar con un header** *(reconstruida)* (`Accept: application/vnd...+json;v=1`). Es más difícil de probar y de cachear, y menos visible para un equipo móvil.
3. **Prefijo `/v1` para el contrato nuevo, manteniendo las rutas sin versión con su formato** (elegida).

## Decisión

- **Rutas v1:** `GET` y `POST` `/v1/search`, `GET /v1/banks` y `GET /v1/health`, documentadas en `docs/openapi.yaml`.
- **Respuesta de `/v1/search`:**
  - `results: Benefit[]`, con `id`, `bankKey`, `logo` y `null` en lugar de `""`, y la descripción recortada a 300 caracteres;
  - `pagination` (`page` y `pageSize`, de 1 a 100);
  - `sources` (estado de cada emisor), `errors` y `meta.partial`.
- **Validación:** `q` de 1 a 100 caracteres, y hasta 20 `banks`, por `key` o nombre.
- **Ruteo exacto** para todas las rutas. En v1, un método no permitido responde 405 con `Allow`; en la API legada, 404 (como antes).
- **Las rutas legadas conservan su body y su status**, salvo tres cambios pedidos en el brief:
  - JSON inválido, body `null` o `query` que no es texto: 400 (antes 500);
  - rutas con prefijo: 404 (antes 200);
  - body sobre el límite: 413 (antes se cortaba la conexión).

## Consecuencias

- **Positivas:**
  - Ningún cliente 1.x se rompe; `original-equivalence.test.js` lo demuestra.
  - El equipo móvil integra la API leyendo solo `openapi.yaml`.
  - Un test falla si el contrato y el código se desalinean.
- **Negativas:**
  - Hay que mantener dos formatos de respuesta.
  - Las rutas legadas quedan deprecadas, pero sin una fecha de retiro definida.
  - La caché y los timeouts también afectan a `/search`, así que sus datos pueden tener hasta 30 min de antigüedad.

## Evidencia

- **Commit:** `0af036a`.
- **Código:** `src/interfaces/http/routes.js`, `serializers.js` y `validation.js`.
- **Documentación:** `docs/openapi.yaml` y `docs/CHANGELOG_REFACTOR.md` (cambios 2 a 5).
- **Tests:** `tests/interfaces/http-v1.test.js`.
