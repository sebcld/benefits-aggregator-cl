# 0015. Rate limiting

- **Estado:** **Propuesto** (no implementado)
- **Fecha:** 2026-11-12
- **Relación:** depende de [0014](0014-autenticacion-con-api-key.md) (para limitar por llave); se relaciona con [0016](0016-cachestore-compartido-en-redis.md)

## Contexto

Con la caché vigente, una búsqueda es barata. Pero cada fallo de caché descarga los 7 emisores: unas 25 peticiones a fuentes externas, entre ellas 10 a `r.jina.ai`, que tiene su propio límite de uso. Un cliente abusivo podría agotar ese límite o hacer que bloqueen al servidor. Hoy no hay ningún límite.

## Alternativas consideradas

1. **En el gateway o el proxy delante de Node** (Cloudflare, nginx `limit_req`, AWS WAF).
   - Pros: el tráfico abusivo se corta antes de llegar a Node, sin código y con escalado incluido.
   - Contras: requiere esa infraestructura.
2. **Middleware en memoria en Node** (token bucket por API key o IP).
   - Pros: sin dependencias, simple.
   - Contras: el límite es por instancia, y detrás de un proxy hay que confiar en `x-forwarded-for`.
3. **Middleware con contador compartido en Redis.**
   - Pros: el límite es exacto aunque haya varias instancias.
   - Contras: requiere Redis ([0016](0016-cachestore-compartido-en-redis.md)) y una dependencia.

## Recomendación

**Opción 1 en producción.** Como límite inicial, unas 60 peticiones por minuto por API key o IP, con respuesta 429 y el header `Retry-After`. **La opción 2 solo como protección mínima** mientras haya una sola instancia sin gateway.

Si se implementa en Node:
- agregar el código `RATE_LIMITED` (429) a `STATUS_BY_CODE` y a `openapi.yaml`;
- excluir `/v1/health`.

Aparte, conviene limitar las descargas hacia las fuentes, independientemente de los clientes. La deduplicación del runner ya evita descargas simultáneas del mismo emisor.

## Consecuencias si se aprueba

- **Positivas:** protege las fuentes y el límite de `r.jina.ai`, y los costos quedan acotados.
- **Negativas:**
  - Clientes legítimos detrás de una misma IP (redes móviles con NAT) pueden compartir el límite si se limita por IP en vez de por llave.
  - Hay un umbral más que calibrar.
