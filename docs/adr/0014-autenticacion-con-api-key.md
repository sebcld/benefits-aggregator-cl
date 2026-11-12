# 0014. Autenticación de la API con API key

- **Estado:** **Propuesto** (no implementado)
- **Fecha:** 2026-11-12
- **Relación:** extiende [0006](0006-api-versionada-v1-con-rutas-legadas.md); se complementa con [0015](0015-rate-limiting.md)

## Contexto

Hoy cualquiera que conozca la URL puede usar la API: no hay autenticación (`docs/RIESGOS.md` #10). Antes de publicarla para la app móvil y la web, hace falta saber qué cliente llama y poder cortar a uno abusivo.

Una restricción importante: **una llave embebida en una app móvil o en una web se puede extraer.** Sirve para identificar al cliente, no como secreto fuerte. CORS ya permite el header `x-api-key` (`src/interfaces/http/middlewares/cors.js`).

## Alternativas consideradas

1. **Middleware propio de API key en Node.**
   - Cómo: un middleware valida `x-api-key` contra una lista de llaves configurada en `.env` (por ejemplo, `API_KEYS=movil:<llave>,web:<llave>`) y responde 401 `UNAUTHORIZED`.
   - Pros: sin dependencias, simple de probar.
   - Contras: rotar llaves exige reiniciar o recargar la config, y no hay panel ni métricas por llave.
2. **API key validada en un API gateway** (Cloudflare, AWS API Gateway, Kong).
   - Pros: rotación, cuotas y métricas sin tocar el código.
   - Contras: introduce infraestructura y costo.
3. **Autenticación de usuario con OAuth2 o JWT.**
   - Pros: identifica a cada persona.
   - Contras: no hay cuentas de usuario hoy, y es desproporcionado para un catálogo público.
4. **No autenticar y depender solo del rate limiting** ([0015](0015-rate-limiting.md)).
   - Pros: cero fricción.
   - Contras: no se puede distinguir ni revocar a un cliente.

## Recomendación

**Opción 2 si la API se despliega detrás de un gateway; si no, la opción 1 como paso intermedio.** En los dos casos:
- solo en `/v1/*`;
- `/v1/health` queda abierto para los monitores;
- las rutas legadas siguen sin llave hasta que se retiren;
- una llave por cliente (móvil, web), para poder revocarlas por separado;
- se agrega el código `UNAUTHORIZED` (401) en `openapi.yaml` y `STATUS_BY_CODE`.

## Consecuencias si se aprueba

- **Positivas:** identificación y revocación por cliente, y una base para cuotas.
- **Negativas:**
  - La app tiene que distribuir la llave en su build.
  - Una llave extraída permite usar la API hasta que se rote.
  - Agregar el 401 cambia el contrato v1 (solo agrega un caso; los clientes existentes no se rompen).
