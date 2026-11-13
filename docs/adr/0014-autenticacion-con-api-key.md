# 0014. Autenticación de la API con API key

- **Estado:** Aceptado. Se implementó la opción 1 (middleware propio), con un alcance mayor que el recomendado al principio (ver "Decisión").
- **Fecha:** 2026-11-12 (propuesta) · 2026-11-13 (implementación)
- **Relación:** extiende [0006](0006-api-versionada-v1-con-rutas-legadas.md); se complementa con [0015](0015-rate-limiting.md) y [0022](0022-web-nextjs-con-bff.md)

## Contexto

Cualquiera que conociera la URL podía usar la API: no había autenticación (`docs/RIESGOS.md` #10). La web llama a la API desde su servidor (BFF, [0022](0022-web-nextjs-con-bff.md)), así que si la API queda con una URL pública, por ejemplo en Render con la web en Vercel ([`DESPLIEGUE.md`](../DESPLIEGUE.md)), tiene que poder rechazar a todo cliente que no sea la web.

Una restricción importante: **una llave embebida en una app móvil o en una web se puede extraer.** Sirve para identificar al cliente, no como secreto fuerte. En la web eso no pasa, porque la llave solo vive en el servidor de Next.

## Alternativas consideradas

1. **Middleware propio de API key en Node.**
   - Cómo: un middleware valida la llave contra una lista configurada en `.env` y responde 401 `UNAUTHORIZED`.
   - Pros: sin dependencias, simple de probar.
   - Contras: rotar llaves exige reiniciar o recargar la config, y no hay panel ni métricas por llave.
2. **API key validada en un API gateway** (Cloudflare, AWS API Gateway, Kong).
   - Pros: rotación, cuotas y métricas sin tocar el código.
   - Contras: introduce infraestructura y costo.
3. **Autenticación de usuario con OAuth2 o JWT.**
   - Pros: identifica a cada persona.
   - Contras: no hay cuentas de usuario, y es desproporcionado para un catálogo público.
4. **No autenticar y depender solo del rate limiting** ([0015](0015-rate-limiting.md)).
   - Pros: cero fricción.
   - Contras: no se puede distinguir ni revocar a un cliente.

## Decisión

**Opción 1**, porque no hay gateway delante:

- **Configuración:** `API_KEYS=web:<llave>,movil:<llave>`. Es una llave por cliente, para revocarlas por separado; el nombre es opcional (sin él, `cliente-N`). Una llave de menos de 32 caracteres, o repetida, detiene el inicio con un error que no muestra la llave.
- **Cómo se envía:** `Authorization: Bearer <llave>` o `x-api-key: <llave>`.
- **Comparación:** sobre los hash SHA-256 con `timingSafeEqual`, recorriendo todas las llaves, así que el tiempo de respuesta no da pistas.
- **Respuesta:** 401 `UNAUTHORIZED` con `WWW-Authenticate: Bearer`. Es la misma si falta la llave o si es incorrecta. Las rutas legadas responden en su formato (`{ "error": "..." }`).
- **Alcance: todas las rutas**, no solo `/v1/*` como decía la propuesta:
  - **Las rutas legadas:** dejarlas abiertas habría sido una puerta trasera, porque `/search` entrega los mismos datos.
  - **`/v1/health`:** expone el estado de las fuentes, y con `?probe=true` dispara la descarga de todos los catálogos.
  - **Rutas inexistentes:** se autentica antes de responder 404/405, así que sin llave no se puede averiguar qué rutas existen.
- **Abierto solo:** `GET /health` (`{ "status": "ok" }`, sin datos, para los health checks de las plataformas) y el preflight de CORS, que el navegador envía sin credenciales.
- **Sin `API_KEYS`:** no se exige llave, para el desarrollo local y los tests. El servidor lo avisa al iniciar (`auth_disabled` en el log y un aviso en la consola).
- **Log de acceso:** registra el nombre del cliente (`client`), nunca la llave.
- **Web:** el BFF envía `Authorization: Bearer <BENEFITS_API_KEY>` en cada petición.
  - Si la variable aparece con prefijo `NEXT_PUBLIC_`, que Next podría incrustar en el navegador, el BFF se niega a llamar a la API y lo deja en el log al iniciar (`instrumentation.ts`).
  - Un 401 de la API llega al navegador como 502 `UPSTREAM_UNAUTHORIZED`: el que está mal configurado es el servidor de la web, no la persona que busca.

## Consecuencias

- **Positivas:**
  - Con una URL pública, solo responde a quien tiene una llave.
  - Una llave filtrada se revoca sin tocar a los demás clientes.
  - Se puede rotar sin corte: se agrega la llave nueva, se cambia la web y se quita la vieja.
- **Negativas:**
  - Rotar exige reiniciar la API.
  - No hay cuotas ni métricas por llave (lo cubriría un gateway o el [0015](0015-rate-limiting.md)).
  - La app móvil tendrá que distribuir su llave en el build, y una llave extraída sirve hasta que se rote.
  - El contrato v1 suma el caso 401 (solo agrega un caso: los clientes que envían la llave no se rompen).

## Evidencia

- **Código:**
  - API: `src/config/api-keys.js`, `src/interfaces/http/middlewares/auth.js` y `src/interfaces/http/server.js`.
  - Web: `web/src/lib/server/upstream.ts` y `web/src/instrumentation.ts`.
- **Tests:** `tests/unit/interfaces/auth.test.js`, `tests/interfaces/http-v1.test.js` (API con `API_KEYS`) y `web/tests/unit/bff.test.ts`.
