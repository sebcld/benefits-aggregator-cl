# 3. Componentes del backend

Cómo se conectan en tiempo de ejecución las piezas que arma `createApp()` en `src/bootstrap.js`.

```mermaid
flowchart LR
  controller["search.controller<br/>health.controller"]
  search["search-service<br/>search, listAll, warmUp, refreshAll"]
  scheduler["refresh-scheduler<br/>diario a REFRESH_TIME"]
  registry["registry<br/>providers/index.js"]
  runner["provider-runner<br/>run, fetchEntries"]
  matcher["matcher<br/>matchesQuery"]
  cache[("CacheStore<br/>memory-cache-store")]
  status[("source-status<br/>ultimo estado")]
  context["createContext<br/>en bootstrap.js"]
  provider["provider<br/>*.provider.js"]
  http["http-client<br/>getJson, getText"]
  logger["logger JSON<br/>stderr"]
  fuente{{"Fuente externa"}}

  controller --> search
  controller -->|"/v1/health"| status
  controller -->|"status()"| scheduler
  scheduler -->|"refreshAll()"| search
  search -->|"select(banks)"| registry
  search -->|"run(provider)"| runner
  search -->|"filtra"| matcher
  runner -->|"get / set"| cache
  runner -->|"record(report)"| status
  runner -->|"ctx"| context
  runner -->|"warn, debug"| logger
  context -->|"ctx.http"| http
  runner -->|"fetch(ctx)"| provider
  provider --> http --> fuente
```

**Leyenda**
- **Cilindro:** estado en memoria del proceso.
- **Hexágono:** sistema externo.
- **Texto en las flechas:** el método que se llama.

**Responsabilidades**

| Componente | Archivo | Hace | No hace |
|---|---|---|---|
| `search-service` | `src/services/search-service.js` | Elige emisores, los corre en paralelo (`Promise.all` sobre `runner.run`), filtra y arma `{ matches, errors, sources }` | Conocer emisores concretos |
| `refresh-scheduler` | `src/services/refresh-scheduler.js` | Timer nativo hasta la próxima `REFRESH_TIME` de Chile; llama a `refreshAll` (sin solapar), guarda `lastRun` y reprograma ([ADR 0024](../adr/0024-actualizacion-diaria-programada.md)). Solo lo arranca `src/server.js` | Decidir cuánto dura la caché (eso lo define `bootstrap.js`) |
| `provider-runner` | `src/services/provider-runner.js` | Caché, deduplicación de peticiones en curso, timeout por emisor, estados `ok`/`empty`/`error`, log | Parsear datos |
| `registry` | `src/providers/index.js` | Lista ordenada de providers, `get`, `find` y `select` por nombre o `key` | Ejecutar providers |
| `CacheStore` | `src/shared/cache/` | `get`, `set` (con TTL), `delete` y `clear`, asíncronos | Decidir qué se cachea |
| `http-client` | `src/shared/http-client.js` | Único uso de `fetch`: user-agent, timeout por petición, reintento en 429, error `"<Emisor> respondio <status>"` | Saber de emisores |
| `source-status` | `src/services/source-status.js` | Guarda el último `SourceReport` de cada emisor, para `/v1/health` | Consultar fuentes |
| `logger` | `src/shared/logger.js` | Una línea JSON por evento en stderr, con nivel `LOG_LEVEL` | — |

El detalle del runner está en el [diagrama 5](05-provider-runner.md).
