# 0022. Web en Next.js con Route Handlers como BFF

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Relación:** consume la API de [0006](0006-api-versionada-v1-con-rutas-legadas.md); prepara [0014](0014-autenticacion-con-api-key.md) (la API key queda en el servidor); no afecta [0002](0002-node-nativo-sin-dependencias-y-commonjs.md) porque vive en `web/` con sus propias dependencias

## Contexto

Faltaba una página web para buscar beneficios. Más adelante vendrá una app móvil. El diseño inicial tenía las pantallas Inicio y Resultados en móvil y escritorio, Light y Dark, y una biblioteca de componentes.

Hay tres restricciones:
- **La API key no puede llegar al navegador.** Si se aprueba el ADR 0014, la API exigirá `x-api-key`, y cualquier llave presente en el navegador queda a la vista en DevTools.
- **El backend no debe sumar dependencias.** El ADR 0002 lo prohíbe, y la API cachea en memoria, así que no conviene llevarla a funciones serverless.
- **La primera búsqueda con la caché fría tarda 10-20 s.**

## Alternativas consideradas

1. **SPA con React y Vite, llamando a `/v1` directamente.**
   - Pros: hosting estático y menos piezas.
   - Contras: la API key quedaría expuesta, hay que abrir CORS y no sirve para SEO.
2. **Servir la web desde el mismo servidor de la API.**
   - Pros: un solo proceso.
   - Contras: mezcla dependencias de frontend con un backend que no tiene ninguna (ADR 0002) y acopla los despliegues.
3. **Next.js con Route Handlers `/api/*` como BFF, en un paquete aparte (`web/`)** (elegida).

## Decisión

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, en `web/`, con su propio `package.json` y Node 26 (ADR 0020).
- **BFF:** el navegador solo llama a `/api/search`, `/api/banks` y `/api/destacados`.
  - Los handlers llaman a `/v1` con `BENEFITS_API_URL` y, si existe, `BENEFITS_API_KEY`, desde `src/lib/server`, un módulo marcado `server-only`.
  - Devuelven el mismo formato de error que `/v1`.
  - La futura app en Expo / React Native usará el mismo BFF.
- **Conteo por emisor (facets):** `/api/search?facets=1` agrega un conteo por emisor, calculado con una búsqueda `pageSize=1` por emisor. No se cambió el contrato de `/v1`.
- **Contrato tipado:** los tipos se generan desde `docs/openapi.yaml` (`npm run api:types`).
- **Tokens de diseño:** `web/src/styles/tokens.css` es la única fuente de colores, medidas y sombras, y se edita a mano. Al principio se exportaba desde un archivo de FigCraft y las pantallas se comparaban con un render del diseño; ese flujo se eliminó cuando los colores pasaron a ajustarse directamente en el código.
- **Calidad:** ESLint, Vitest (unitarios y BFF) y Playwright (e2e con el BFF simulado) corren en el job `web` del CI.

## Consecuencias

- **Positivas:**
  - La API key y la URL de la API nunca llegan al navegador ni a la app.
  - No hace falta CORS: el navegador llama a su propio dominio.
  - Las páginas son estáticas y el contenido dinámico se carga en el cliente.
  - Si la API cambia, `tsc` marca todo lo que hay que ajustar en la web.
- **Negativas:**
  - **Hay un proceso más que desplegar** (Next.js), además de la API. La API debe seguir en un proceso persistente: en serverless perdería la caché en memoria.
  - **Las dependencias del frontend son de terceros.** `web/` tiene `next`, `react` y `react-dom`, más devDependencies, con su propio ciclo de actualización y de `npm audit`.
  - **Los facets cuestan una petición por emisor** a la API. Son baratas porque los catálogos ya están en caché, pero sería mejor que `/v1/search` devolviera el conteo directamente (propuesta futura).

## Evidencia

- **Código:** `web/` (ver [web/README.md](../../web/README.md)).
- **Pruebas:** `web/tests/unit/` (componentes, cliente de la API, BFF, contraste AA y consistencia de los tokens) y `web/e2e/` (estados y flujos).
