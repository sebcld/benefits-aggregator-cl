# 9. Interfaces y compatibilidad

Cuatro puertas de entrada usan el mismo núcleo (`searchService`). Cambian en cómo arman la app (`createApp`) y en cómo serializan la salida.

```mermaid
flowchart TB
  terminal["Persona en terminal"]
  libreria["Codigo que hace require"]
  cliente1["Cliente 1.x"]
  app["App movil o web"]

  index["src/index.js<br/>runCli + formatResults"]
  facade["src/benefits.js<br/>fachada 1.x"]
  legacy["/search y /health<br/>serializers legados"]
  v1["/v1/search, /v1/banks, /v1/health<br/>serializers v1"]
  server["src/server.js<br/>interfaces/http"]

  sinCache["createApp sin cache ni timeouts<br/>logs silent"]
  conCache["createApp con cache en memoria y timeouts<br/>logs info"]
  core["searchService<br/>mismo nucleo"]

  terminal --> index --> sinCache
  libreria --> facade --> sinCache
  cliente1 -->|"HTTP"| server
  app -->|"HTTP"| server
  server -->|"router"| legacy & v1
  legacy & v1 --> conCache
  sinCache --> core
  conCache --> core
```

**Leyenda:** las flechas siguen el camino de una petición, de arriba hacia abajo.

| Interfaz | Cliente | Formato de salida | Caché | Timeouts | Logs por defecto | Estabilidad |
|---|---|---|---|---|---|---|
| CLI `node src/index.js "<texto>"` | Persona | Texto, el mismo formato de 1.x | No | No | `silent` | Estable |
| Fachada `require('./src/benefits')` | Código Node | `searchBenefits` → `{ matches, errors: [{ bank, message }] }`, con el `Entry` 1.x | No | No | `silent` | Estable (compatibilidad 1.x) |
| API legada `/search`, `/health` | Clientes 1.x | `{ matches, errors }` y `{ status: "ok" }` | Sí | Sí | `info` | **Deprecada**, se mantiene |
| API v1 `/v1/*` | App móvil y web | `SearchResponse` de [`openapi.yaml`](../openapi.yaml) | Sí | Sí | `info` | Contrato actual |

**Por qué el CLI y la fachada no usan caché ni timeouts:** conservan exactamente la semántica 1.x. Cada ejecución es un proceso nuevo, así que la caché no aportaría nada, y en una prueba en vivo Banco de Chile superó los 60 s de timeout por lentitud de `r.jina.ai`. Ver [ADR 0008](../adr/0008-cli-y-fachada-sin-cache-ni-timeouts.md).

**Para una app nueva:** usa siempre `/v1`. Las rutas sin versión no reciben campos nuevos (`id`, `logo`, paginación) ni el formato de errores uniforme.
