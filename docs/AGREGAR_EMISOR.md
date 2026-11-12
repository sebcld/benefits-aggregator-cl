# Cómo agregar un emisor

Agregar un emisor requiere **un archivo nuevo en `src/providers/` y una línea en el registro**. No hay que tocar servicios, CLI ni API: el emisor aparece automáticamente en `/v1/banks`, en las búsquedas y en `/v1/health`.

## 1. Encontrar la fuente de datos

Prefiere siempre una fuente JSON a parsear HTML.

1. Abre la página de beneficios del emisor y revisa si el HTML trae los beneficios: `curl -s <url> | grep -i "<un comercio conocido>"`.
2. Si no los trae, se cargan por JavaScript. Busca en el HTML y en sus scripts `fetch(`, `wp-json`, `api/content`, `graphql`, `__NEXT_DATA__` o `admin-ajax`.
3. Patrones que ya existen en el proyecto:

| Plataforma | Señal | Ejemplo |
|---|---|---|
| WordPress con endpoint propio | `/wp-json/...` | Copec Pay: `/wp-json/custom/v1/beneficios/` |
| Modyo (CMS headless) | imágenes en `/uploads/000/...` | Tapp, Banco de Chile: `/api/content/spaces/<space>/types/<type>/entries` |
| API propia con llave | header en las peticiones del sitio | BCI: `ocp-apim-subscription-key` |
| HTML estático | clases CSS estables | Tenpo (Webflow, regex) |

4. Si el sitio bloquea clientes automatizados (Incapsula, Cloudflare), se puede usar `r.jina.ai` como en Banco de Chile. Documéntalo como riesgo en [`RIESGOS.md`](RIESGOS.md).

## 2. Crear `src/providers/<key>.provider.js`

```js
// <Emisor>: <fuente> (<paginada | sin paginacion>). <Particularidades>.
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { cleanText } = require('../shared/text');

const NAME = 'Mi Emisor'; // nombre visible y valor de "bank"
const URL = 'https://api.ejemplo.cl/beneficios';

// Funcion PURA: datos de la fuente -> Entry[]. Se prueba sin red.
function parseMiEmisor(data) {
  return (data?.items || []).map((item) =>
    createEntry(
      {
        bank: NAME,
        title: cleanText(item.nombre),
        subtitle: cleanText(item.bajada),
        description: cleanText(item.descripcion),
        url: item.link || '',
        slug: item.slug || '',
        commerceName: cleanText(item.comercio),
        keywords: cleanText(item.palabrasClave),
        // opcionales: category, validFrom/validUntil (YYYY-MM-DD), tagsText
      },
      { sourceId: item.id, logo: item.logoUrl }, // id estable + logo para la app
    ),
  );
}

const provider = defineProvider({
  key: 'miemisor', // kebab-case, estable: lo usan la app y la cache
  name: NAME,
  // queryDependent: true  <- solo si la fuente busca por texto (recibe ctx.query)
  async fetch({ http, config, sleep, signal }) {
    const data = await http.getJson(URL, { label: NAME, signal });
    return parseMiEmisor(data);
  },
});

module.exports = { provider, parseMiEmisor };
```

Reglas del contrato:
- **Sin red, reloj ni configuración directos.** Usa `ctx.http` (nunca `fetch`), `ctx.now()` (nunca `new Date()`), `ctx.sleep` y `ctx.config`. El lint lo verifica.
- **Pasa `signal`** a cada `http.*` y `sleep`, para que el timeout por emisor cancele el trabajo.
- **Usa `label: NAME`:** los errores salen como `"<Emisor> respondio <status>: ..."`.
- **Paginación:** haz una pausa de cortesía entre páginas con `await sleep(ms, signal)` y pon un tope de páginas.
- **Formato inesperado:** lanza `ProviderError` con `code: 'INVALID_RESPONSE'`. Si falta una credencial, usa `code: 'MISSING_CREDENTIALS'`.
- **Si necesitas una llave:** agrégala en `src/config/index.js` y en `.env.example`. Nunca la escribas en el código.

## 3. Registrarlo

En `src/providers/index.js`, agrega una línea a `DEFAULT_PROVIDERS`. La posición define el orden de los resultados:

```js
  require('./miemisor.provider').provider,
```

## 4. Pruebas

1. **Grabar respuestas reales:** agrega el emisor a `JOBS` en `tests/tools/record-fixtures.js` y ejecuta `npm run fixtures:record -- miemisor`. Si la respuesta es muy grande, agrega un recorte en `TRIMMERS`.
2. **Agregar un caso de aceptación** en `ACCEPTANCE_CASES` (`tests/helpers/constants.js`): `['Mi Emisor', 'comercio conocido', /Titulo esperado/]`.
3. **Escribir los tests unitarios** del parser en `tests/unit/providers/`, usando `createTestContext({ fetchImpl })` de `tests/helpers/provider-context.js`.
4. **Regenerar el golden y revisar el diff:** `npm run fixtures:golden` y `git diff tests/fixtures/golden`. Solo deberían aparecer resultados del emisor nuevo.
5. **Verificar:** `npm run check` (lint y tests sin internet) y `npm run smoke` (en vivo).

## 5. Documentar

- `README.md`: agrega el emisor a la lista de "Detalle técnico".
- `docs/openapi.yaml`: agrega la key al ejemplo de `/v1/banks` y a `allowed` en `UNKNOWN_BANK`.
- `docs/RIESGOS.md`: anota si la fuente es frágil (regex, proxy, llave que rota).
