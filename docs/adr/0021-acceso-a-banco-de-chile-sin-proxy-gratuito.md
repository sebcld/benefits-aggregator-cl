# 0021. Acceso a Banco de Chile sin depender de un proxy gratuito

- **Estado:** **Propuesto** (no implementado)
- **Fecha:** 2026-11-12
- **Relación:** revisaría [0012](0012-banco-de-chile-via-api-modyo-y-jina.md)

## Contexto

Banco de Chile (919 beneficios, el emisor más grande) depende de `r.jina.ai`, un servicio de terceros gratuito, con límite de uso y sin garantía. Ya se observó variabilidad: la misma página fallaba o respondía según el momento, y una corrida superó los 60 s. El sitio del banco está detrás de Incapsula y bloquea a los clientes automatizados (302/403). Este es el riesgo de mayor prioridad (`docs/RIESGOS.md` #2).

## Alternativas consideradas

1. **Seguir con `r.jina.ai` gratuito** (lo de hoy).
   - Pros: sin costo ni infraestructura.
   - Contras: disponibilidad y límites fuera de nuestro control.
2. **`r.jina.ai` con plan pagado,** configurando `JINA_API_KEY` (el código ya lo soporta).
   - Pros: más límite y más estabilidad, sin cambiar código.
   - Contras: costo recurrente, y se sigue dependiendo de un tercero.
3. **Navegador headless propio** (por ejemplo, Playwright) que resuelva el desafío de Incapsula y llame a la API.
   - Pros: elimina al intermediario.
   - Contras: dependencias pesadas (contra [0002](0002-node-nativo-sin-dependencias-y-commonjs.md)), más infraestructura y una carrera contra las protecciones anti-bot del banco.
4. **Acuerdo con el banco:** acceso autorizado a su API de contenido, por ejemplo IPs permitidas o una llave.
   - Pros: es la solución estable y legítima.
   - Contras: depende de un tercero y de plazos que no controlamos.

## Recomendación

**Opción 2 a corto plazo y opción 4 a mediano plazo,** combinadas con [0017](0017-warm-up-programado-y-stale-while-revalidate.md) para que una caída del proxy no la note el usuario (se serviría el dato anterior). **La opción 3 solo si la 4 no prospera,** con aprobación explícita de las dependencias.

## Consecuencias si se aprueba

- **Positivas:** el emisor principal deja de depender de un servicio gratuito sin garantía.
- **Negativas:**
  - Con la opción 2, un costo mensual.
  - Con la opción 4, posibles condiciones de uso impuestas por el banco.
