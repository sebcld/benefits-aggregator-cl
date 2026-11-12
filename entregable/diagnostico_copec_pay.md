# Diagnóstico y corrección del extractor de Copec Pay

Fecha: 2026-11-12
Archivos modificados: `src/benefits.js` (función `fetchCopec` y utilidades nuevas), `src/index.js` (muestra la vigencia), `README.md`.

---

## 1. Síntoma

Al buscar `"Rappi"` o `"El Café Rosa"` no aparecían resultados de Copec Pay, aunque ambos comercios están publicados en <https://copecpay.cl/beneficios/>. El emisor quedaba en la lista de `errors` de `searchBenefits` y el CLI mostraba:

```
Copec Pay no disponible: Unexpected token '<', "<!doctype "... is not valid JSON
```

## 2. Causa raíz

`fetchCopec()` consultaba un endpoint del sitio anterior, que ya no existe:

```
https://www.appcopec.cl/wp-json/wp/v2/promo_y_beneficios?per_page=100&page=1&_embed=1
```

Ahora ese endpoint responde **`301` hacia la home de `appcopec.cl`** (`https://appcopec.cl/?per_page=1`). `fetch` sigue la redirección de forma automática y recibe la home en HTML con estado `200`. Como el código solo revisaba `response.ok`, intentaba `response.json()` sobre ese HTML y fallaba.

Además, el código anterior tenía problemas que habrían seguido aunque el endpoint respondiera:

| Problema | Efecto |
|---|---|
| Dominio y post type obsoletos (`appcopec.cl`, `promo_y_beneficios`) | En el WordPress nuevo de `copecpay.cl` no hay un post type público de beneficios en `/wp-json/wp/v2/types` (solo `posts`, `pages`, `faq`, `blog`, `tiendas`, etc.). |
| `commerceName = title` | Ignoraba la taxonomía real `comercio`. |
| No se validaba el `content-type` | Una redirección a HTML generaba un error poco claro. |
| No se filtraba por vigencia | Habría mostrado beneficios vencidos que el sitio ya no publica. |

## 3. Cómo carga los datos copecpay.cl/beneficios/

1. **Plataforma:** WordPress (tema `chris`) detrás de Cloudflare y Kinsta. La página es accesible sin autenticación ni JavaScript anti-bot para un `fetch` simple.
2. **Renderizado en el cliente:** el HTML inicial (unos 72 KB) **no incluye los beneficios**. Solo trae los contenedores vacíos `#promos-container` y `#tabs-nav-categories`. Buscar "Rappi" en ese HTML no da ningún resultado. Por eso, aunque hubiera selectores CSS, no habría nada que extraer del DOM.
3. **Fuente real de los datos:** el script `wp-content/themes/chris/js/beneficios-new.js` ejecuta:

   ```js
   fetch('/wp-json/custom/v1/beneficios/')
   ```

   Es un endpoint REST propio del tema, en el namespace `custom/v1`. Las rutas que expone son `GET /custom/v1/beneficios` y `PUT /custom/v1/beneficios/{id}`. El `PUT` no se usa.
4. **Sin paginación:** una sola respuesta trae **todos** los beneficios: 313 registros (unos 570 KB), incluidos los vencidos. `?page=2` devuelve el mismo contenido. La respuesta queda en caché de Kinsta/Cloudflare hasta 24 h (`s-maxage=86400`).
5. **Filtro del front:** el JavaScript solo muestra los beneficios con `fecha_de_inicio` y `fecha_de_termino` definidas y cuya vigencia incluye el día de hoy. De los 313 registros, **48 estaban vigentes** al 2026-11-12. Las pestañas de categoría salen de la taxonomía `categorias-beneficios`.

### Estructura de cada registro

```jsonc
{
  "id": 7121,
  "title": "El Café Rosa",
  "link": "https://copecpay.cl/beneficios/restaurante/el-cafe-rosa/",
  "descripcion_beneficio_principal": "20% de descuento pagando con tu Copec Pay de manera presencial.",
  "descripcion_corta_int_bene": "20% de descuento ... todos los dias de la semana.",
  "featured_image": "https://copecpay.cl/wp-content/uploads/...",
  "acf": {
    "descripcion_beneficio_principal": "...",
    "descripcion_corta_int_bene": "...",
    "fecha_de_inicio": "01/11/2026",      // dd/mm/yyyy
    "fecha_de_termino": "31/12/2026",     // dd/mm/yyyy
    "tipo_de_descuento": "personalizado", // o presencial_online, online_tarjeta, ...
    "etiqueta_personalizada": "Presencial",
    "lista_personalizada": [{ "pasos": "..." }],
    "condiciones_legales_int": "<p>...</p>",
    "url_sitio_web": "..."
  },
  "taxonomies": {
    "comercio":              [{ "id": 0, "name": "El Café Rosa", "slug": "...", "image": "..." }],
    "categorias-beneficios": [{ "name": "Restaurante" }, { "name": "Ruta Sabores" }],
    "descuento":             [{ "name": "20%" }],
    "dias":                  [{ "name": "Lunes" }, { "name": "Martes" }]
  }
}
```

## 4. Cambios en el código

### `src/benefits.js`

`fetchCopec()` se reescribió para usar la fuente real:

- **Endpoint:** `https://copecpay.cl/wp-json/custom/v1/beneficios/`, con una sola petición y sin el bucle de paginación.
- **Validaciones:** revisa `response.ok`, revisa que el `content-type` sea JSON y revisa que el cuerpo sea un arreglo. Si el sitio vuelve a redirigir a HTML, el mensaje de error lo dice explícitamente.
- **Vigencia:** aplica el mismo filtro que el sitio (`inicio <= hoy <= término`) y omite los registros sin fechas. La fecha de hoy se calcula en `America/Santiago` (`todayInChile()`) y se compara como texto `YYYY-MM-DD`. Así el día de término se incluye completo, sin el desfase UTC del front (`new Date('yyyy-mm-dd')` interpreta medianoche UTC). Para depurar se puede usar `fetchCopec({ includeInactive: true })`, que devuelve los 313 registros.
- **Normalización al formato común:**

  | Campo común | Origen en Copec Pay |
  |---|---|
  | `bank` | `"Copec Pay"` |
  | `title` | `title` |
  | `subtitle` | `acf.descripcion_beneficio_principal` |
  | `description` | `acf.descripcion_corta_int_bene` (si no existe, se usa la principal) |
  | `url` | `link` |
  | `slug` | último segmento de `link` |
  | `commerceName` | `taxonomies.comercio[].name` (si no existe, se usa `title`) |
  | `keywords` | categorías + canal (`Presencial`, `Online`, …) |
  | `tagsText` | descuentos (`20%`) + días |
  | `category` *(nuevo)* | `taxonomies['categorias-beneficios'][].name` |
  | `validFrom` / `validUntil` *(nuevo)* | `acf.fecha_de_inicio` / `acf.fecha_de_termino` en formato ISO `YYYY-MM-DD` |

  Los campos nuevos se agregan sin quitar ninguno, así que el CLI y la API siguen funcionando igual.

- **Utilidades nuevas:** `todayInChile()`, `parseDmyDate()` y `termNames()`.

### `src/index.js`

Si un resultado trae `validFrom` o `validUntil`, el CLI imprime `Vigencia: <inicio> al <término>`. Los emisores que no traen esos campos no cambian.

### `README.md`

Se actualizó la sección "Detalle técnico" con el endpoint nuevo y el criterio de vigencia.

### Sin cambios

`matchesQuery`, que ya era insensible a mayúsculas y tildes, `normalize` y los demás emisores.

## 5. Validación de los casos de prueba

Ejecutado el 2026-11-12 contra el sitio en producción, con Node 24.

### Búsqueda con `searchBenefits(q, { banks: ['Copec Pay'] })`

| Consulta | Resultados | Títulos | Errores |
|---|---|---|---|
| `Rappi` | 2 | Rappi, Rappi Regiones | 0 |
| `rappi` | 2 | Rappi, Rappi Regiones | 0 |
| `RAPPI` | 2 | Rappi, Rappi Regiones | 0 |
| `El Café Rosa` | 1 | El Café Rosa | 0 |
| `el cafe rosa` | 1 | El Café Rosa | 0 |
| `EL CAFE ROSA` | 1 | El Café Rosa | 0 |
| `cafe rosa` | 1 | El Café Rosa | 0 |

La fuente trae 10 registros con "Rappi", pero solo 2 están vigentes hoy, igual que en el sitio. Rappi Black Friday parte el 28/11/2026. Rappi Halloween, Rappi 18 de Septiembre y las demás campañas ya vencieron.

### CLI: `node src/index.js Rappi` (sección Copec Pay)

```
Copec Pay (2)
COMERCIO: Rappi
---------------
- Rappi - Hasta $6.000 de descuento los viernes en todo Rappi para nuevos usuarios.
  Hasta $6.000 de descuento en Rappi todos los viernes para tu primera compra y $3.000 permanentes.
  Vigencia: 2026-08-01 al 2026-11-30
  https://copecpay.cl/beneficios/delivery/rappi/
COMERCIO: Rappi
---------------
- Rappi Regiones - $3.000 los días miercoles y jueves en restaurantes seleccionados.
  ...
  Vigencia: 2026-08-01 al 2026-11-30
  https://copecpay.cl/beneficios/delivery/rappi-regiones/
```

### Registro normalizado de "El Café Rosa"

```js
{
  bank: 'Copec Pay',
  title: 'El Café Rosa',
  subtitle: '20% de descuento pagando con tu Copec Pay de manera presencial.',
  description: '20% de descuento pagando con tu Copec Pay de manera presencial todos los dias de la semana.',
  url: 'https://copecpay.cl/beneficios/restaurante/el-cafe-rosa/',
  slug: 'el-cafe-rosa',
  commerceName: 'El Café Rosa',
  category: 'Restaurante, Ruta Sabores',
  validFrom: '2026-11-01',
  validUntil: '2026-12-31',
  keywords: 'Restaurante Ruta Sabores presencial',
  tagsText: '20% Martes Sábado Domingo Jueves Miércoles Lunes Viernes'
}
```

### API HTTP (`npm start`)

- `GET /search?q=el%20cafe%20rosa&banks=Copec%20Pay`: 1 resultado (`El Café Rosa`), `errors: []`.
- `POST /search` con `{"query":"Rappi","banks":["Copec Pay"]}`: 2 resultados (`Rappi`, `Rappi Regiones`), `errors: []`.

### Cómo repetir la validación

```bash
node src/index.js "Rappi"
node src/index.js "El Café Rosa"
node -e "require('./src/benefits').fetchCopec({includeInactive:true}).then(r=>console.log(r.length))"
```

## 6. Riesgos y recomendaciones

- **Endpoint no documentado:** `custom/v1/beneficios` es propio del tema y puede cambiar sin aviso. Si vuelve a fallar, hay que revisar qué URL usa el `fetch(...)` de `wp-content/themes/chris/js/beneficios-new.js`. El nombre del script se puede ver en el HTML de `/beneficios/`.
- **Vigencia por fecha:** los beneficios con fecha de inicio futura (por ejemplo, Rappi Black Friday) aparecen automáticamente cuando comienzan. No hay que tocar el código.
- **Caché:** la respuesta puede tener hasta 24 h de antigüedad en la CDN. Los cambios publicados hoy en el sitio podrían tardar en verse.
- **Pruebas:** el proyecto no tiene suite de pruebas (`npm test` es un placeholder). Se recomienda agregar una prueba de `fetchCopec` con un JSON de ejemplo guardado, para detectar cambios de formato sin depender de la red.
