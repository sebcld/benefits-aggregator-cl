# Diagramas de arquitectura

Diagramas Mermaid del sistema, uno por tema. Se renderizan directamente en GitHub y están validados con `mmdc` (mermaid-cli 11.4.2). Todo lo que muestran sale del código en `src/`; cuando un elemento todavía no existe, el diagrama lo marca como **futuro**.

**Ruta sugerida para un desarrollador nuevo (unos 15 minutos):** 1 → 2 → 4 → 9 → 10. Si vas a trabajar en la app móvil, suma [`../openapi.yaml`](../openapi.yaml).

| # | Diagrama | Qué responde |
|---|---|---|
| 1 | [Contexto del sistema](01-contexto.md) | ¿Quién usa el sistema y de qué fuentes externas depende? |
| 2 | [Capas y dependencias](02-capas.md) | ¿Qué módulo puede importar a cuál? |
| 3 | [Componentes del backend](03-componentes.md) | ¿Cómo se conectan las piezas del núcleo? |
| 4 | [Secuencia de `GET /v1/search`](04-secuencia-busqueda.md) | ¿Qué pasa en una búsqueda, incluso con un emisor caído? |
| 5 | [Ciclo del `provider-runner`](05-provider-runner.md) | ¿Cómo funcionan la caché, la deduplicación, el timeout y los estados? |
| 6 | [Modelo de dominio](06-modelo-dominio.md) | ¿Qué es un `Entry`, un `Provider`, un `SourceReport`, un error? |
| 7 | [Flujo de datos de un emisor](07-flujo-datos-emisor.md) | ¿Cómo llega un beneficio desde la fuente hasta la respuesta? |
| 8 | [Manejo de errores](08-manejo-errores.md) | ¿Cómo se convierte una excepción en una respuesta HTTP? |
| 9 | [Interfaces y compatibilidad](09-interfaces-compatibilidad.md) | ¿Cómo conviven el CLI, la API legada, la API v1 y `benefits.js`? |
| 10 | [Arquitectura objetivo](10-arquitectura-objetivo.md) | ¿Hacia dónde va el sistema? (**futuro**) |
| 11 | [Cómo agregar un emisor](11-agregar-emisor.md) | ¿Qué pasos sigo para sumar una fuente? |
| 12 | [Estrategia de pruebas](12-estrategia-pruebas.md) | ¿Cómo se prueba sin internet y qué son los golden? |

**Convenciones comunes**
- **Rectángulo:** módulo o componente del código.
- **Cilindro:** almacenamiento (caché, fixtures).
- **Hexágono:** sistema externo.
- **Línea continua:** dependencia o llamada que existe en el código.
- **Línea punteada:** uso inyectado en tiempo de ejecución o elemento **futuro**, según la leyenda de cada diagrama.

**Documentación relacionada**
- [`../ARQUITECTURA.md`](../ARQUITECTURA.md): visión general y tablas de referencia.
- [`../adr/`](../adr/README.md): por qué se decidió cada cosa.
- [`../openapi.yaml`](../openapi.yaml): contrato HTTP.
