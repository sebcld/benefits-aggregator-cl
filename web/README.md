# Beneficios CL · Web

Web de Beneficios CL. Usa **Next.js 16** (App Router), **TypeScript** y **Tailwind CSS 4**, y consume la API `/v1` del repositorio a través de sus propios Route Handlers `/api/*` (BFF). Las razones del stack están en el [ADR 0022](../docs/adr/0022-web-nextjs-con-bff.md).

| Ruta | Pantalla |
|---|---|
| `/` | **Inicio.** Hero con buscador y sugerencias. En escritorio, "Cómo funciona" (Bento) y "Fuentes que consultamos"; en móvil, "Destacados de hoy". |
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

| Script | Qué hace |
|---|---|
| `npm run check` | Corre lint (ESLint), tipos (`tsc`) y los tests unitarios (Vitest). |
| `npm run build` y `npm start` | Build de producción y servidor en el puerto 3001. |
| `npm run test:e2e` | Playwright contra el build, con el BFF simulado (no necesita la API). En local usa Edge; en CI, Chromium. |
| `npm run api:types` | Regenera `src/lib/api/schema.d.ts` desde `docs/openapi.yaml`. |
| `npm run design:tokens` | Exporta las variables del diseño a `src/styles/tokens.css` y `tokens.ts`. |
| `npm run design:render` | Renderiza los frames del diseño a PNG en `design-ref/`. |
| `npm run design:compare` | Pone cada captura de la web junto a su frame del diseño, en `design-ref/compare/`. |

## Diseño → código

La fuente de verdad es [`design/beneficios_CL.figcraft`](../design/beneficios_CL.figcraft). En esta sesión no había conector de FigCraft, así que el archivo, que es un zip con `document.json`, se lee con scripts propios en `scripts/design/`:

- **Tokens.** `export-tokens.mjs` lee las colecciones Color (modos Light y Dark), Espaciado y Radio y las escribe como variables CSS semánticas (`--bg-page`, `--brand-primary`…).
  - Light es el tema por defecto. Dark se activa con `[data-theme="dark"]` o, si no hay preferencia guardada, con `prefers-color-scheme`.
  - Los efectos que cambian por tema se toman de las pantallas y también quedan como tokens: la sombra de la tarjeta (`--shadow-card`) y el brillo del shimmer.
- **Tailwind.** `globals.css` borra la paleta por defecto y mapea los tokens a utilidades (`bg-surface`, `text-fg-muted`, `rounded-lg`…). La escala de espaciado del diseño (`space/N` = N × 4 px) es la misma de Tailwind. El test `tokens.test.ts` falla si un componente usa un hex, `rgb()` o la paleta por defecto.
- **Comparación visual.** `render-design.mjs` posiciona cada nodo con su `transform` ya resuelto y Playwright lo captura. Luego `e2e/screens.spec.ts` captura la web en 390 px y 1440 px, en Light y Dark, con datos iguales a los del diseño, y `compare.mjs` arma las imágenes lado a lado.

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
└── styles/              tokens.css y tokens.ts (generados)
```

- **El navegador solo habla con `/api/*`.** La URL de la API y `BENEFITS_API_KEY` viven en el servidor de Next (`lib/server`, marcado `server-only`), así que la API key del ADR 0014 nunca llega al bundle. La futura app en Expo usará el mismo BFF.
- **Conteo por emisor.** `/v1/search` no trae conteos por emisor, así que `GET /api/search?facets=1` los calcula con una búsqueda `pageSize=1` por emisor. La API ya tiene los catálogos en caché y deduplica las descargas en curso, así que esas búsquedas no vuelven a consultar las fuentes. Al cambiar filtros no se recalculan.
- **Estado en la URL.** `?q=&banks=` permite compartir una búsqueda y que el botón "atrás" funcione.
- **Tema.** Un script inline en `<head>` aplica la preferencia guardada antes del primer pintado. `localStorage` siempre va dentro de un try/catch.

## Decisiones respecto del diseño

| Tema | Decisión | Motivo |
|---|---|---|
| Píldora "Tarjeta de crédito" (medio de pago) | No se muestra. | La API no entrega ese dato. |
| Valor del descuento (píldora hero) | Se extrae del título y, si no trae valor, de la bajada. | Santander, Copec Pay y Banco de Chile ponen el descuento en la bajada ("Burger King" / "40% dcto. todos los jueves"). Sin ese respaldo, casi ninguna tarjeta tendría píldora. |
| Texto de la vigencia y del badge Beta | Usan `accent/on-amber`; el ícono del calendario sigue en `accent/amber`. | `accent/amber` sobre `accent/amber-bg` da 2,8:1 y no cumple AA. |
| Separación entre filas de la grilla | 20 px, igual que entre columnas. | Lo pide el brief. El diseño usa 10 px entre filas (el `cross_gap` por defecto de FigCraft). |
| Sombra Dark de la tarjeta y del buscador | Borde y brillo superior. | Así lo muestran las pantallas Dark; la hoja de componentes Dark todavía tiene la sombra Light. |
| Ícono del sol | Recentrado. | En el archivo estaba desplazado 0,8 × 1,5 px. |
| Inicio en móvil | Muestra "Destacados de hoy" (de `/api/destacados`, con caché de 30 min) en vez del Bento y las fuentes. | Así está en el diseño. |
| Mercado Pago en los filtros | Aparece con conteo "–". | La API lo lista, pero hoy siempre falla ([RIESGOS #1](../docs/RIESGOS.md)). No tiene token de color, así que usa el color secundario. |
