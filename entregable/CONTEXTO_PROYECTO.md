# Contexto del proyecto `beneficios_banks`

> Este documento está pensado para que un asistente de IA entienda el proyecto completo sin tener que leer todo el código primero. Describe el propósito, la arquitectura, cada fuente de datos, la lógica de búsqueda, las convenciones y los problemas conocidos.
>
> Estado verificado el **2026-11-12**, ejecutando el código contra los sitios reales.

---

## 1. Qué es

Un buscador de beneficios y descuentos de bancos, tarjetas y billeteras digitales de **Chile**. Consulta en vivo las fuentes públicas de cada emisor, normaliza los beneficios a un formato común y filtra por palabra clave (por ejemplo, `"burger king"`, `"rappi"` o `"el café rosa"`).

Se usa de dos formas:

- **CLI:** `node src/index.js "<texto>"` imprime las coincidencias agrupadas por emisor.
- **API HTTP:** `node src/server.js` expone `/search` y devuelve JSON, para que lo consuma cualquier cliente.

No hay base de datos, caché ni indexación persistente. **Cada búsqueda vuelve a descargar todas las fuentes** y filtra en memoria.

## 2. Stack y requisitos

| Aspecto | Detalle |
|---|---|
| Lenguaje | JavaScript (Node.js), módulos **CommonJS** (`require` / `module.exports`, `"type": "commonjs"`) |
| Runtime | Node 18 o superior, por el `fetch` nativo. Verificado con Node v24.13.0 |
| Dependencias | **Ninguna**. Ni `package.json` ni `package-lock.json` declaran paquetes. Solo se usan `fetch`, `http`, `URL` e `Intl` nativos |
| Servidor HTTP | Módulo `http` nativo (sin Express) |
| Parsing HTML | Expresiones regulares (sin cheerio, jsdom ni navegador headless) |
| Tests | No hay. `npm test` solo imprime `"No hay pruebas configuradas"` |
| Control de versiones | La carpeta **no es un repositorio git** |
| Sistema del desarrollador | Windows 11 |
| Idioma | Mensajes, comentarios y documentación en **español** (sin tildes en el código, en general) |

### Scripts de `package.json`

```json
"search": "node src/index.js",
"start":  "node src/server.js",
"serve":  "node src/server.js",
"test":   "echo \"No hay pruebas configuradas\""
```

## 3. Estructura de archivos

```
beneficios_banks/
├── README.md                       ← uso y detalle técnico de cada fuente
├── package.json / package-lock.json
├── .env                            ← llaves y tokens reales (NO se versiona, está en .gitignore)
├── .env.example                    ← plantilla de .env sin valores reales
├── .gitignore
├── src/
│   ├── config.js                   ← carga .env sin dependencias y expone la configuración
│   ├── benefits.js                 ← TODA la lógica: extractores, normalización y búsqueda
│   ├── index.js                    ← CLI
│   └── server.js                   ← API HTTP
└── entregable/
    ├── CONTEXTO_PROYECTO.md        ← este documento
    └── diagnostico_copec_pay.md    ← diagnóstico de la corrección de Copec Pay (2026-11-12)
```

## 4. Arquitectura y flujo de datos

```
 CLI (index.js)  ─┐
                  ├─► searchBenefits(query, { banks }) ── benefits.js
 HTTP (server.js)─┘          │
                             ├─ lanza en paralelo un fetchX() por emisor incluido
                             ├─ Promise.allSettled → los que fallan van a `errors`, no detienen la búsqueda
                             ├─ junta todos los registros normalizados (datasets)
                             └─ filtra con matchesQuery(entry, query) → `matches`
                             ▼
                      { matches: Entry[], errors: { bank, message }[] }
```

Puntos clave:

- **Tolerancia a fallos por emisor.** Si un emisor falla, aparece en `errors` y el resto sigue funcionando.
- **Filtro opcional por emisor.** `banks` es una lista de nombres. La comparación ignora mayúsculas, pero el nombre debe ser exacto: `"Copec Pay"`, `"Banco de Chile"`, `"Mercado Pago"`, `"Santander"`, `"BCI"`, `"Tenpo"` o `"Tapp"`. Si `banks` viene vacío u omitido, se consultan todos.
- **Mercado Pago es la excepción.** Es el único emisor que recibe el `query` y busca del lado del servidor. Los demás descargan su catálogo completo.

## 5. Modelo de datos normalizado (`Entry`)

Todos los extractores devuelven arreglos de objetos con esta forma. No hay tipado formal; es una convención.

| Campo | Tipo | Uso | Notas |
|---|---|---|---|
| `bank` | string | Nombre del emisor | Se usa para agrupar en el CLI y para el filtro `banks` |
| `title` | string | Título del beneficio | Siempre presente |
| `subtitle` | string | Bajada corta | Puede ser `''` |
| `description` | string | Descripción en texto plano | Sin HTML (pasa por `cleanText`) |
| `url` | string | Link al beneficio | Hay fallbacks por emisor |
| `slug` | string | Identificador del beneficio | Opcional |
| `commerceName` | string | Nombre del comercio | El CLI lo imprime como cabecera `COMERCIO:` |
| `keywords` | string | Texto extra para la búsqueda | Opcional |
| `tagsText` | string | Tags o etiquetas para la búsqueda | Opcional |
| `category` | string | Categorías separadas por coma | **Solo Copec Pay** |
| `validFrom` / `validUntil` | string `YYYY-MM-DD` | Vigencia | **Solo Copec Pay**. El CLI la imprime si existe |

La búsqueda considera estos campos: `title`, `subtitle`, `description`, `slug`, `keywords`, `commerceName` y `tagsText`. **No considera `category`**; por eso Copec Pay también copia las categorías dentro de `keywords`.

## 6. `src/benefits.js` en detalle

### 6.1 Utilidades

| Línea | Función | Qué hace |
|---|---|---|
| 8 | `sleep(ms)` | Pausa entre páginas para no saturar las fuentes |
| 10 | `decodeHtml(text)` | Decodifica `&nbsp; &amp; &quot; &#39; &lt; &gt;` y entidades numéricas `&#NNN;` y `&#xHH;` |
| 21 | `cleanText(text)` | Quita etiquetas HTML, decodifica entidades y colapsa espacios. Acepta `null` y `undefined` |
| 26 | `escapeRegex(text)` | Escapa texto para usarlo dentro de un `RegExp` |
| 28 | `normalize(text)` | `cleanText` → minúsculas → quita tildes (NFD) → reemplaza todo lo que no sea `[a-z0-9\s]` por espacio → colapsa espacios |
| 37 | `matchesQuery(entry, query)` | Decide si un registro coincide con la búsqueda (ver §7) |
| 69 | `truncate(text, limit=180)` | Recorta el texto con `...`. Se exporta y el CLI lo usa |
| 72 | `toTitleCase(text)` | Pone en mayúscula la primera letra de cada palabra (lo usa Banco de Chile) |
| 275 | `todayInChile()` | Fecha de hoy `YYYY-MM-DD` en la zona `America/Santiago` |
| 279 | `parseDmyDate(value)` | Convierte `dd/mm/yyyy` a `yyyy-mm-dd`. Devuelve `''` si la fecha no es válida |
| 286 | `termNames(terms)` | Convierte `[{ name }]` en `string[]` limpios |

### 6.2 Constantes

```js
SANTANDER_URL   = 'https://banco.santander.cl/beneficios/promociones.json?per_page=9999&custom_fields=true'
BCI_BASE_URL    = 'https://api.bciplus.cl/bff-loyalty-beneficios/v1/offers'
BANCHILE_BASE   = 'https://sitiospublicos.bancochile.cl/personas/beneficios'
JINA_PROXY      = 'https://r.jina.ai/http://'
```

Todas las peticiones envían `user-agent: beneficios-finder/1.0`.

### 6.3 Extractores, uno por emisor

#### Santander: `fetchSantander()` (línea 79)
- **Fuente:** JSON público con todo el catálogo en una sola llamada (`per_page=9999`).
- **Mapeo:** `promociones[]`. `subtitle` sale de `custom_fields['Bajada externa'].value`, o de `'Bajada interna'` si no existe. `commerceName` es el título. `tagsText` es `tags.join(' ')`.
- **Estado:** OK, unos 315 registros en 0,2 s.

#### BCI: `fetchBci()` (línea 111)
- **Fuente:** API BFF de BCI Plus, paginada (`itemsPorPagina=100&pagina=N`), con el total de páginas en `paginado.totalPaginas`.
- **Headers obligatorios:** `ocp-apim-subscription-key` (variable `BCI_SUBSCRIPTION_KEY` definida en `.env`, sin valor por defecto en el código; si falta, BCI aparece en `errors`) y `referer: https://www.bci.cl/`.
- **Mapeo:** `ofertas[]` con `titulo`, `subtitulo`, `descripcion`, `link`, `slug`, `comercio.nombre`, `keywords` y `tags[].nombre`. Si no hay link, se usa `https://www.bci.cl/beneficios/beneficios-bci#<slug>`.
- **Estado:** OK, unos 326 registros en unos 8 s. Es una de las fuentes más lentas.

#### Tenpo: `fetchTenpo()` (línea 165)
- **Fuente:** HTML del sitio Webflow `https://www.tenpo.cl/beneficios`. La paginación usa `?ca01dc3d_page=N`, con un máximo de 10 páginas, y se detiene cuando una página no trae resultados.
- **Parsing:** una regex sobre las clases CSS `titulo-beneficio-all`, `p-text-beneficio-copy` y `cta-beneficio`. **Es frágil:** si Tenpo cambia el HTML o las clases, devolverá 0 resultados **sin lanzar error**.
- **Mapeo:** `commerceName` es el título.
- **Estado:** OK, unos 48 registros.

#### Tapp (Caja Los Andes): `fetchTapp()` (línea 217)
- **Fuente:** CMS headless `https://web.cajalosandes.cl/api/content/spaces/wp-tapp-beneficios-copia/types/beneficios/entries?per_page=100&page=N`, con el total de páginas en `meta.total_pages`.
- **Mapeo:** `meta.name`, `fields['Cuerpo']` o `fields['Bajada']`, `meta.slug`, `meta.category`, `fields['Logo anunciante'].title` (comercio), `fields['Tipo de beneficio']` y `meta.tags`.
- **Filtro:** descarta las entradas cuya categoría contiene `finalizados`.
- **URL:** `https://www.tapp.cl/beneficios/<category>/<slug>`.
- **Estado:** OK, pero solo 6 registros. Puede ser normal o puede indicar que el *space* `wp-tapp-beneficios-copia` ("copia") ya no es el principal. Conviene revisarlo si faltan beneficios de Tapp.

#### Copec Pay: `fetchCopec({ includeInactive = false })` (línea 288)
- **Fuente:** `https://copecpay.cl/wp-json/custom/v1/beneficios/`, un endpoint REST propio del tema WordPress `chris`. La página `https://copecpay.cl/beneficios/` se dibuja en el navegador con `wp-content/themes/chris/js/beneficios-new.js`, que llama a ese endpoint. **Una sola llamada trae todo** (unos 313 registros, incluidos los vencidos). No hay paginación.
- **Formato de origen:** `{ id, title, link, featured_image, acf: { descripcion_beneficio_principal, descripcion_corta_int_bene, fecha_de_inicio, fecha_de_termino, tipo_de_descuento, etiqueta_personalizada, ... }, taxonomies: { comercio[], 'categorias-beneficios'[], descuento[], dias[] } }`. Las fechas vienen como `dd/mm/yyyy`.
- **Filtro de vigencia:** igual que el sitio, solo incluye registros con ambas fechas y con `inicio <= hoy <= término`, usando la hora de Chile. `includeInactive: true` desactiva el filtro (útil para depurar).
- **Validaciones:** `response.ok`, `content-type` JSON y cuerpo de tipo arreglo.
- **Mapeo:** `subtitle` es la descripción principal. `description` es la descripción corta. `commerceName` sale de `taxonomies.comercio`. `keywords` son las categorías más el canal (Presencial u Online). `tagsText` son los descuentos y los días. También agrega `category`, `validFrom` y `validUntil`.
- **Estado:** OK, 48 registros vigentes en 0,1 s. La respuesta puede estar hasta 24 h en caché de la CDN.
- **Historia:** antes se usaba `https://www.appcopec.cl/wp-json/wp/v2/promo_y_beneficios`. Ese endpoint ahora redirige (301) a una página HTML y rompía el parseo JSON. Se corrigió el 2026-11-12; el detalle está en `entregable/diagnostico_copec_pay.md`.

#### Banco de Chile: `fetchBancoChile()` (línea 360)
- **Fuente:** el sitio `sitiospublicos.bancochile.cl/personas/beneficios`, leído **a través del proxy de solo lectura `r.jina.ai`**, que devuelve cada página convertida a Markdown. Así se evita el renderizado JavaScript y el bloqueo directo.
- **Recorrido:** 9 páginas semilla fijas (`/`, `/panoramas`, `/panoramas/cine`, `/sabores`, `/delivery`, `/marcas`, `/promociones`, `/beneficios-del-dia`, `/campanas/big5-dto`). Visita como máximo esas 9 páginas y espera 800 ms entre una y otra. Si recibe 429, reintenta hasta 5 veces respetando `retry-after`.
- **Extracción:** una regex sobre los links Markdown `[texto](https://sitiospublicos.bancochile.cl/personas/beneficios...)` que contienen `/detalle/` o `/campanas/`. El comercio se deduce del slug: sus 3 primeras palabras, con `toTitleCase`. Cada página semilla también se agrega como registro propio, usando el `Title:` y el cuerpo Markdown.
- **Hardcode:** para `big5-dto` se agregan a mano los comercios *La Fete, Dunkin, Mamut, Juan Maestro, Tommy Beans, Doggis, KFC, Wendy's, Domino's, McDonald's*. Esto aparece en tres lugares del código.
- **Errores:** si una página falla, se crea un registro de respaldo a partir del slug. Solo lanza error si no consiguió ninguna página.
- **Estado:** OK, unos 62 registros en unos 11 s. Es **la fuente más lenta** y depende de un servicio de terceros (Jina).

#### Mercado Pago: `fetchMercadoPago(query)` (línea 530)
- **Fuente:** `https://api.mercadolibre.com/sites/MLC/search?q=<query>&limit=50`, que es la búsqueda de **productos** de Mercado Libre, no un catálogo de beneficios. Conceptualmente no encaja con el resto.
- **Auth opcional:** si existe `MELI_ACCESS_TOKEN` o `MERCADOPAGO_TOKEN`, se envía `Authorization: Bearer <token>`.
- **Estado:** **FALLA con 403 forbidden** sin token. Aparece siempre en `errors`, lo cual es esperado y está documentado.

### 6.4 `searchBenefits(query, { banks } = {})` (línea 569)

1. Lanza un error si `query` está vacío.
2. Arma la lista de trabajos según `banks`.
3. Ejecuta `Promise.allSettled`.
4. Devuelve `{ matches, errors }`, donde `matches = datasets.filter(e => matchesQuery(e, query))`.

No ordena, no deduplica y no pagina los resultados. El orden es el orden de los emisores y, dentro de cada uno, el orden de la fuente.

### 6.5 Exportaciones

```js
module.exports = {
  searchBenefits, truncate, matchesQuery,
  fetchSantander, fetchBci, fetchTenpo, fetchTapp, fetchCopec, fetchBancoChile, fetchMercadoPago,
};
```

## 7. Algoritmo de búsqueda (`matchesQuery`)

1. `target = normalize(query)`: minúsculas, sin tildes y sin puntuación. Por ejemplo, `"El Café Rosa"` queda como `"el cafe rosa"` y `"Wendy's"` como `"wendy s"`.
2. `haystack` es la concatenación normalizada de los campos `title`, `subtitle`, `description`, `slug`, `keywords`, `commerceName` y `tagsText`.
3. También se calculan versiones **compactas**, sin espacios, de ambos. Así `"burgerking"` coincide con `"burger king"` y `"mc donalds"` con `"mcdonalds"`.
4. Reglas:
   - **Una palabra de 4 letras o menos** (por ejemplo `kfc` o `cine`): solo cuenta la coincidencia de **palabra completa** (`\b...\b`). Esto evita falsos positivos como `"bci"` dentro de otra palabra.
   - **Una palabra de más de 4 letras:** coincidencia de palabra completa, **o** substring en la versión compacta.
   - **Varias palabras:** substring normal, **o** substring compacto, **o** coincidencia de palabra completa.
5. No hay ranking, búsqueda difusa ni sinónimos.

Consecuencias que conviene conocer:

- Buscar `"rappi"` también encuentra beneficios donde Rappi solo aparece en la descripción.
- La versión compacta puede generar falsos positivos cuando una palabra larga queda formada por el final de una palabra y el inicio de la siguiente.

## 8. CLI: `src/index.js`

- **Uso:** `node src/index.js "burger king"` o `npm run search -- "burger king"`. Sin argumentos, termina con código 1.
- Imprime cada error como `"<bank> no disponible: <mensaje>"` en stderr.
- Agrupa los resultados por `bank` en el orden en que aparecen. Para cada registro imprime:

  ```
  COMERCIO: <commerceName>      (si existe)
  ----------
  - <title> - <subtitle>
    <description truncada a 180 caracteres>
    Vigencia: <validFrom> al <validUntil>   (solo si existe, hoy solo Copec Pay)
    <url>
    slug: <slug>                 (solo BCI)
  ```

## 9. API HTTP: `src/server.js`

- Usa el módulo `http` nativo. El puerto es `config.port` (variable `PORT` de `.env`, o `3000` si no está definida).
- **Endpoints:**
  - `GET /health` → `200 { "status": "ok" }`
  - `GET /search?q=<texto>&banks=<A,B,C opcional>` → `200 { matches, errors }`. Si falta `q`, responde `400 { "error": "Falta el parametro q" }`.
  - `POST /search` con cuerpo `{ "query": "...", "banks": ["Santander","BCI"] }`. `banks` también puede ser un string separado por comas. Si falta `query`, responde `400`. Si el JSON es inválido, responde `500 { "error": "JSON invalido" }`.
  - Cualquier otra ruta → `404 { "error": "No encontrado" }`.
- El cuerpo tiene un límite de 1 MB.
- **No hay CORS, autenticación, rate limiting ni caché.** Las rutas se reconocen con `req.url.startsWith(...)`, así que `/searchXYZ` también responde como `/search`.
- **Latencia:** una búsqueda sin filtro tarda **entre 10 y 12 s**, porque espera a Banco de Chile y BCI.

## 10. Variables de entorno

Se definen en `.env`, en la raíz del proyecto. `.env.example` sirve de plantilla. `src/config.js` carga el archivo al iniciar: usa `process.loadEnvFile` en Node 20.12 o superior, o un parser propio en Node 18. Las variables que ya existen en el entorno del sistema tienen prioridad sobre `.env`. El resto del código lee la configuración desde `require('./config')` y no directamente desde `process.env`. **No debe haber llaves escritas en el código.**

| Variable | Clave en `config` | Uso |
|---|---|---|
| `PORT` | `port` | Puerto del servidor (por defecto `3000`) |
| `BCI_SUBSCRIPTION_KEY` | `bciSubscriptionKey` | Llave de BCI. **Obligatoria**: sin ella, BCI falla con un mensaje claro |
| `MELI_ACCESS_TOKEN` / `MERCADOPAGO_TOKEN` | `mercadoPagoToken` | Token Bearer opcional para Mercado Libre |

## 11. Cosas que no son lo que parecen

- El proyecto no incluye ningún cliente (ni app móvil ni frontend web). Solo existen el CLI y la API.
- En `package.json`, `"main": "index.js"` apunta a un archivo que no existe en la raíz; los reales están en `src/`. No afecta a los scripts.

## 12. Estado actual de las fuentes (2026-11-12)

| Emisor | Estado | Registros | Tiempo | Técnica |
|---|---|---|---|---|
| Santander | OK | ~315 | 0,2 s | JSON público |
| BCI | OK | ~326 | ~8 s | API paginada con llave |
| Tenpo | OK | ~48 | 0,8 s | Regex sobre HTML (Webflow) |
| Tapp | OK (pocos) | 6 | 0,5 s | CMS headless paginado |
| Copec Pay | OK | 48 vigentes / 313 totales | 0,1 s | REST propio de WordPress, filtrado por vigencia |
| Banco de Chile | OK | ~62 | ~11 s | Proxy r.jina.ai a Markdown y regex |
| Mercado Pago | **403** | 0 | 0,2 s | API de búsqueda de Mercado Libre (requiere token) |

## 13. Convenciones de código

- Usar `async function fetchX()` por emisor, que devuelve `Entry[]` con `bank` fijo.
- Ante un HTTP no-OK, usar `throw new Error(\`<Emisor> respondio ${status}: ${body.slice(0, 120)}\`)`.
- Pasar todo el texto que venga de HTML por `cleanText()` antes de guardarlo.
- Usar optional chaining (`?.`) y fallbacks `|| ''` en todos lados; los campos nunca deberían quedar `undefined`.
- En paginación, usar un bucle `while (page <= totalPages)` con `await sleep(100–150)` entre páginas.
- Estilo: 2 espacios, comillas simples, punto y coma, *trailing commas* y líneas de hasta unos 100 caracteres (estilo Prettier, aunque no hay configuración).
- Comentarios en español, breves y sin tildes.

## 14. Cómo agregar un emisor nuevo

1. **Investigar la fuente.** Revisar si existe un JSON o API pública. Abrir el HTML y buscar `fetch(`, `wp-json`, `admin-ajax`, `__NEXT_DATA__` o `graphql` en los scripts. Si el HTML no contiene los beneficios, se dibujan en el navegador y hay que encontrar el endpoint que usa el script. Así se resolvió Copec Pay.
2. **Escribir `fetchNuevo()`** en `benefits.js`, siguiendo §5 y §13.
3. **Registrarlo** en `searchBenefits`: `if (shouldInclude('Nuevo')) jobs.push({ name: 'Nuevo', promise: fetchNuevo() });`.
4. **Exportarlo** en `module.exports`.
5. **Documentarlo** en `README.md`, en la sección "Detalle técnico".
6. **Probarlo:** `node -e "require('./src/benefits').fetchNuevo().then(r=>console.log(r.length, r[0]))"` y luego `node src/index.js "<comercio conocido>"`.

## 15. Cómo verificar rápidamente que todo funciona

```bash
# Estado de cada fuente
node -e "const b=require('./src/benefits');for(const n of ['fetchSantander','fetchBci','fetchTenpo','fetchTapp','fetchCopec','fetchBancoChile'])b[n]().then(r=>console.log(n,'OK',r.length)).catch(e=>console.log(n,'FAIL',e.message))"

# Casos de prueba conocidos
node src/index.js "Rappi"          # Copec Pay: "Rappi" y "Rappi Regiones" (mientras estén vigentes)
node src/index.js "El Café Rosa"   # Copec Pay: "El Café Rosa" (vigente hasta 2026-12-31)
node src/index.js "burger king"

# API
npm start
curl "http://localhost:3000/search?q=rappi&banks=Copec%20Pay"
```

Los resultados dependen de la fecha, porque los beneficios vencen. Copec Pay filtra por vigencia y los demás emisores reflejan lo que publique cada sitio.

## 16. Deuda técnica y mejoras posibles

1. **Sin tests.** Convendría agregar pruebas con `node:test` y datos de ejemplo guardados de cada fuente, para detectar cambios de formato sin depender de la red.
2. **Sin caché.** Cada búsqueda descarga unos 1.000 registros y tarda unos 12 s. Un caché en memoria con TTL (por ejemplo 30–60 min) por emisor bajaría la latencia a milisegundos.
3. **Extracción frágil.** Tenpo y Banco de Chile dependen de regex sobre HTML o Markdown. Si cambian, devuelven 0 resultados sin lanzar error. Convendría avisar cuando un emisor devuelve 0 registros.
4. **Mercado Pago** no es una fuente de beneficios y responde 403. Hay que buscar la página real de beneficios de Mercado Pago o quitar el emisor.
5. **Banco de Chile** depende de `r.jina.ai`, un servicio de terceros con límites de uso, y tiene el hardcode de Big5 repetido tres veces.
6. **Tapp** usa un *space* con nombre `...-copia` y devuelve pocos resultados. Hay que confirmar que sea la fuente vigente.
7. **Vigencia** solo está normalizada para Copec Pay. Se podría extender `validFrom` y `validUntil` a los demás emisores cuando la fuente lo permita.
8. **Sin deduplicación ni ranking** de resultados.
9. **Servidor:** no tiene CORS (lo necesitaría un cliente web), compara rutas con `startsWith` y devuelve 500 ante JSON inválido cuando debería ser 400.
10. **Llave de BCI**: ya está en `.env`. La llave sale del sitio público de BCI y puede rotar; si BCI empieza a responder 401 o 403, hay que obtener la nueva y actualizar `.env`.
