# 4. Secuencia de `GET /v1/search`

Qué ocurre desde que la app pide una búsqueda hasta que recibe la respuesta. Incluye el acierto y el fallo de caché y el caso en que un emisor falla.

```mermaid
sequenceDiagram
  autonumber
  participant App as App movil
  participant Srv as server.js y router
  participant Ctl as search.controller
  participant Val as validation
  participant Svc as search-service
  participant Reg as registry
  participant Run as provider-runner
  participant Cache as CacheStore
  participant Prov as provider
  participant Mat as matcher
  participant Ser as serializers

  App->>Srv: GET /v1/search?q=rappi&banks=copec,bancochile
  Srv->>Srv: corsHeaders y router.match (ruta exacta)
  Srv->>Ctl: v1Get(ctx)
  Ctl->>Val: parseV1Search(input, registry)
  alt parametros invalidos
    Val--xCtl: ValidationError (MISSING_QUERY, UNKNOWN_BANK...)
    Ctl--xSrv: el error sube al servidor
    Srv-->>App: 400 con error code, message y details
  else parametros validos
    Val-->>Ctl: query, banks (keys), page, pageSize
    Ctl->>Svc: search(query, banks, allowKeys)
    Svc->>Reg: select(banks)
    Reg-->>Svc: providers en el orden del registro
    loop cada emisor, en paralelo con Promise.all
      Svc->>Run: run(provider, query)
      Run->>Cache: get(provider:key)
      alt acierto de cache
        Cache-->>Run: Entry[] guardados
      else fallo de cache
        Run->>Prov: fetch(ctx) con timeout por emisor
        alt el emisor responde
          Prov-->>Run: Entry[]
          Run->>Cache: set(provider:key, entries, TTL)
        else el emisor falla (HTTP no-OK, red, formato o TIMEOUT)
          Prov--xRun: error
          Note over Run: status error, entries vacio, no se cachea
        end
      end
      Run-->>Svc: SourceReport (ok, empty o error)
    end
    Svc->>Mat: matchesQuery(entry, query) por cada Entry
    Mat-->>Svc: coincidencias
    Svc-->>Ctl: matches, errors, sources
    Ctl->>Ser: toV1SearchResponse(...)
    Note over Ser: paginate, toV1Benefit (null en vacios, descripcion hasta 300), meta.partial
    Ser-->>Ctl: body
    Ctl-->>Srv: status 200 y body
    Srv-->>App: 200 con x-request-id (meta.partial true si algun emisor fallo)
  end
```

**Leyenda**
- **`->>`:** llamada.
- **`-->>`:** respuesta.
- **`--x`:** error lanzado.
- **Números:** orden de los pasos.

**Qué tiene que saber la app**
- **Un emisor caído no convierte la respuesta en error.** La API responde 200 con los demás resultados, `meta.partial: true` y el detalle en `errors[]` y en `sources[]`. Solo los parámetros inválidos producen 4xx (ver el [diagrama 8](08-manejo-errores.md)).
- **La caché decide la latencia.** Un acierto responde en milisegundos (`sources[].cached: true`). Un fallo descarga la fuente: unos 16 s en Banco de Chile y unos 8 s en BCI.
- **Orden de los resultados:** primero por emisor (en el orden de `GET /v1/banks`) y, dentro de cada uno, en el orden de la fuente. No hay ranking.
- **La paginación** se aplica después de filtrar todas las coincidencias, así que `pagination.total` es el total real.
- **Cada petición se registra** en el log (`http_request`) con su `x-request-id`.

El código de este flujo está en `src/interfaces/http/controllers/search.controller.js` (`runV1`), `src/services/search-service.js` (`search`) y `src/interfaces/http/serializers.js` (`toV1SearchResponse`).
