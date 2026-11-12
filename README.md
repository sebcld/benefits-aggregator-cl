Buscador de beneficios bancarios
================================

CLI y API en Node que consultan en vivo las fuentes publicas de varios emisores chilenos (bancos, tarjetas y billeteras), normalizan los beneficios a un formato comun y los filtran por palabra clave (ejemplo: "burger king").

Emisores soportados: Santander, BCI, Tenpo, Tapp, Copec Pay, Banco de Chile y Mercado Pago.

Requisitos
- Node 18 o superior (trae `fetch` nativo).
- No hay dependencias externas.

Instalacion
- `npm install`
- Copia `.env.example` como `.env` y completa las llaves (ver "Variables de entorno"). `.env` esta en `.gitignore` y no debe subirse al repositorio.

Uso rapido (CLI)
- `npm run search -- "burger king"`
- Tambien puedes ejecutar `node src/index.js "burger king"`
- Los resultados se agrupan por emisor y muestran comercio, titulo, bajada, descripcion corta, vigencia (cuando la fuente la entrega) y link.
- Si un emisor falla, se muestra `<emisor> no disponible: <motivo>` y la busqueda sigue con el resto.

API / backend
- Levanta el servidor: `npm start` (o `npm run serve`). Puerto por defecto `3000` (variable `PORT`).
- Endpoints:
  - `GET /health` -> `{ status: "ok" }`
  - `GET /search?q=<texto>&banks=<opcional lista separada por comas>` devuelve `{ matches, errors }`.
  - `POST /search` con cuerpo JSON `{ "query": "burger king", "banks": ["Santander","BCI"] }`.
    Si omites `banks`, consulta todas las fuentes.
- Nombres validos para `banks` (sin distinguir mayusculas): `Santander`, `BCI`, `Tenpo`, `Tapp`, `Copec Pay`, `Banco de Chile`, `Mercado Pago`.
- Una busqueda sobre todas las fuentes tarda unos 10-12 s (Banco de Chile y BCI son las mas lentas). No hay cache: cada busqueda descarga las fuentes de nuevo.

Formato de cada resultado
- Campos comunes: `bank`, `title`, `subtitle`, `description`, `url`, `slug`, `commerceName`, `keywords`, `tagsText`.
- Copec Pay agrega ademas `category`, `validFrom` y `validUntil` (fechas `YYYY-MM-DD`).

Estructura
- `src/config.js`: carga `.env` (sin dependencias) y expone la configuracion al resto del codigo.
- `src/benefits.js`: extractores por emisor (`fetchSantander`, `fetchBci`, `fetchTenpo`, `fetchTapp`, `fetchCopec`, `fetchBancoChile`, `fetchMercadoPago`), normalizacion y busqueda (`searchBenefits`, `matchesQuery`).
- `src/index.js`: CLI.
- `src/server.js`: API HTTP (modulo `http` nativo).
- `entregable/`: documentacion tecnica (`CONTEXTO_PROYECTO.md` con el contexto completo del proyecto y `diagnostico_copec_pay.md` con la correccion de Copec Pay).

Detalle tecnico
- Santander: `https://banco.santander.cl/beneficios/promociones.json?per_page=9999&custom_fields=true`
- BCI: `https://api.bciplus.cl/bff-loyalty-beneficios/v1/offers` (usa el header `ocp-apim-subscription-key`, cuyo valor se toma de `BCI_SUBSCRIPTION_KEY` en `.env`).
- Tenpo: se parsea el HTML publico de `https://www.tenpo.cl/beneficios` y sus paginas de paginacion.
- Tapp: se consulta `https://web.cajalosandes.cl/api/content/spaces/wp-tapp-beneficios-copia/types/beneficios/entries` paginando de 100 en 100.
- Copec Pay: se consulta el endpoint REST del tema de `https://copecpay.cl/beneficios/` (`https://copecpay.cl/wp-json/custom/v1/beneficios/`, devuelve todos los beneficios en un solo JSON). Igual que el sitio, solo se incluyen los vigentes hoy segun `fecha_de_inicio`/`fecha_de_termino` (hora de Chile). `fetchCopec({ includeInactive: true })` devuelve tambien los vencidos y futuros.
- Banco de Chile: se recorre el sitio publico de beneficios (`https://sitiospublicos.bancochile.cl/personas/beneficios`) a traves del proxy de solo lectura `https://r.jina.ai/http://...` para extraer enlaces y textos de cada beneficio.
- Mercado Pago: se consulta `https://api.mercadolibre.com/sites/MLC/search?q=<query>&limit=50` (sin token responde 403; el script muestra el error y sigue). Si tienes un token de app, define `MELI_ACCESS_TOKEN` o `MERCADOPAGO_TOKEN` para enviarlo en el header `Authorization`.
- La busqueda es insensible a mayusculas y elimina tildes; compara contra titulo, bajada, descripcion, slug, keywords, tags y nombre de comercio (util cuando el comercio no esta en el titulo). Ejemplo: `"el cafe rosa"` encuentra `"El Café Rosa"`.

Variables de entorno
- Se definen en `.env` en la raiz del proyecto (plantilla: `.env.example`). Las variables ya definidas en el sistema tienen prioridad sobre `.env`.
- `PORT`: puerto del servidor (por defecto `3000`).
- `BCI_SUBSCRIPTION_KEY`: llave de subscripcion de BCI. Obligatoria: sin ella BCI aparece como no disponible.
- `MELI_ACCESS_TOKEN` o `MERCADOPAGO_TOKEN`: token Bearer opcional para Mercado Libre.

Notas
- Si el API de BCI cambia la llave de subscripcion (responde 401/403), actualiza `BCI_SUBSCRIPTION_KEY` en `.env`.
- El CLI muestra el slug en el caso de BCI cuando no hay link directo.
- No hay pruebas automatizadas (`npm test` es un placeholder).
