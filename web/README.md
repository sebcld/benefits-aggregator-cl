# Beneficios CL · Web

Web de Beneficios CL. Usa **Next.js 16** (App Router), **TypeScript** y **Tailwind CSS 4**, y consume la API `/v1` del repositorio a través de sus propios Route Handlers `/api/*` (BFF). Las razones del stack están en el [ADR 0022](../docs/adr/0022-web-nextjs-con-bff.md).

| Ruta | Pantalla |
|---|---|
| `/` | **Inicio.** Hero con buscador y sugerencias, y "Destacados de hoy" (lista en móvil, grilla de 3 en escritorio). En escritorio, además, "Cómo funciona" (Bento) y "Fuentes que consultamos". |
| `/buscar?q=&banks=` | **Resultados.** Filtros por emisor con conteo, aviso de resultado parcial, grilla y "Cargar más". |
| `/sistema` | Tokens y biblioteca de componentes, en Light y Dark lado a lado. |
| `/api/search`, `/api/banks`, `/api/destacados` | **BFF.** Lo usan el navegador y, más adelante, la app en Expo. |

## Desarrollo

Requisito: Node 26 o superior, igual que el resto del repo (`.nvmrc`).

```bash
# 1. API (en la raíz del repo)
npm start                       # http://localhost:3000

# 2. Web
cd web
cp .env.example .env.local      # BENEFITS_API_URL=http://localhost:3000
npm install
npm run dev                     # http://localhost:3001
```

**Desde el teléfono (misma red Wi-Fi).** Abre `http://<IP-del-computador>:3001`, por ejemplo `http://192.168.0.101:3001`.
- **IP del computador:** búscala con `ipconfig`. Usa la de la red Wi-Fi, que no siempre es la "Network" que muestra Next.
- **Sin configuración extra:** `next.config.ts` ya permite en desarrollo las IPs de red local del equipo (`allowedDevOrigins`). Para otros hosts, como un túnel, usa `DEV_ALLOWED_ORIGINS`.
- **API:** el teléfono no necesita alcanzarla, porque el BFF la llama desde el computador.
- **Si no carga:** permite el puerto 3001 en el firewall de Windows.

| Script | Qué hace |
|---|---|
| `npm run check` | Corre lint (ESLint), tipos (`tsc`) y los tests unitarios (Vitest). |
| `npm run build` y `npm start` | Build de producción y servidor en el puerto 3001. |
| `npm run test:e2e` | Playwright contra el build, con el BFF simulado (no necesita la API). En local usa Edge; en CI, Chromium. |
| `npm run api:types` | Regenera `src/lib/api/schema.d.ts` desde `docs/openapi.yaml`. |

## Sistema de diseño (tokens)

Los colores, medidas y sombras viven en un solo archivo, [`src/styles/tokens.css`](src/styles/tokens.css), que **se edita a mano**. Por ejemplo, para cambiar el color de un emisor se edita su `--issuer-<key>`.

- **Temas.** Light es el tema por defecto. Dark se activa con `[data-theme="dark"]` o, si no hay preferencia guardada, con `prefers-color-scheme`.
  - Por eso cada color de Dark va en **dos bloques** que deben ser iguales: el de `@media (prefers-color-scheme: dark)` y el de `[data-theme='dark']`.
  - El test `tokens.test.ts` falla si esos bloques difieren.
- **Uso desde TypeScript.** [`read-tokens.ts`](src/styles/read-tokens.ts) lee `tokens.css` en el build para el `themeColor` del navegador, los swatches de `/sistema` y el test de contraste. No hay que copiar valores a otro archivo.
- **Tailwind.** `globals.css` borra la paleta por defecto y mapea los tokens a utilidades (`bg-surface`, `text-fg-muted`, `rounded-lg`…). La escala de espaciado (`--space-N` = N × 4 px) es la misma de Tailwind.
- **Controles.** El test `tokens.test.ts` también falla si un par de texto usado en la UI no cumple contraste AA en algún tema, o si un componente usa un hex, `rgb()` o la paleta por defecto de Tailwind.

## Arquitectura

```
src/
├── app/                 Rutas: páginas (/, /buscar, /sistema) y BFF (api/*)
├── components/
│   ├── ui/              Biblioteca: BenefitCard, SearchBox, Chip, Notice, ThemeToggle, BetaBadge,
│   │                    LoadingCard, IssuerCheckbox, SourcePill, PillButton, Icon
│   ├── layout/          SiteHeader (fijo, efecto vidrio)
│   ├── home/            Hero, HowItWorks (Bento), Sources, Featured
│   └── results/         ResultsView, IssuerFilters, use-search, use-banks
├── lib/
│   ├── api/             Tipos (generados desde OpenAPI), cliente del navegador, errores
│   ├── server/          Solo servidor ('server-only'): acceso a la API y casos de uso del BFF
│   └── *.ts             Formato (fechas, iniciales, descuento), filtros, emisores, tema
└── styles/              tokens.css (fuente de colores y medidas) y read-tokens.ts (lo lee en el build)
```

- **El navegador solo habla con `/api/*`.** La URL de la API y `BENEFITS_API_KEY` viven en el servidor de Next (`lib/server`, marcado `server-only`), así que la API key del ADR 0014 nunca llega al bundle. La futura app en Expo usará el mismo BFF.
- **Conteo por emisor.** `/v1/search` no trae conteos por emisor, así que `GET /api/search?facets=1` los calcula con una búsqueda `pageSize=1` por emisor. La API ya tiene los catálogos en caché y deduplica las descargas en curso, así que esas búsquedas no vuelven a consultar las fuentes. Al cambiar filtros no se recalculan.
- **Estado en la URL.** `?q=&banks=` permite compartir una búsqueda y que el botón "atrás" funcione.
- **Tema.** Un script inline en `<head>` aplica la preferencia guardada antes del primer pintado. `localStorage` siempre va dentro de un try/catch.

## Decisiones de la interfaz

| Tema | Decisión | Motivo |
|---|---|---|
| Valor del descuento (píldora hero) | Se extrae del título y, si no trae valor, de la bajada. | Santander, Copec Pay y Banco de Chile ponen el descuento en la bajada ("Burger King" / "40% dcto. todos los jueves"). Sin ese respaldo, casi ninguna tarjeta tendría píldora. |
| Píldora de tarjeta ("medio de pago") | Se muestra cuando la API trae `cardType` (hoy, Mercado Pago). | En el resto de los emisores la fuente no entrega el dato. |
| Texto de la vigencia y del badge Beta | Usan `--accent-on-amber`; el ícono del calendario sigue en `--accent-amber`. | `--accent-amber` sobre `--accent-amber-bg` da 2,8:1 y no cumple AA. |
| Sombra de la tarjeta y del buscador | Sombra suave en Light; en Dark, borde y brillo superior (`--shadow-card`). | Una sombra oscura casi no se ve sobre un fondo oscuro. |
| Grilla de resultados | 2 columnas en escritorio (gap 20 px) y 1 en móvil (gap 14 px). | — |
| Inicio en móvil | Muestra "Destacados de hoy" (de `/api/destacados`, con caché de 2 horas) en vez del Bento y las fuentes. | Pantalla más corta y con contenido real al abrir la app. |
| Destacados en escritorio | Grilla de 3 columnas entre el hero y "Cómo funciona"; solo filas completas (con 10 destacados se ven 9). En tablet, 2 columnas. | Contenido real también en escritorio, sin quitar el Bento ni las fuentes. La caché del servidor evita consultas extra a las fuentes. |
