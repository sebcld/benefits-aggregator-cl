# 11. Cómo agregar un emisor

Los pasos de [`docs/AGREGAR_EMISOR.md`](../AGREGAR_EMISOR.md) en forma visual. La guía tiene el detalle, incluida la plantilla de código.

```mermaid
flowchart TB
  inicio(["Nuevo emisor"])
  html{"El HTML trae<br/>los beneficios?"}
  buscar["Buscar el endpoint en los scripts<br/>wp-json, api/content, graphql"]
  json{"Hay JSON o API?"}
  regex["Parsear HTML con regex<br/>ultimo recurso"]
  bloqueo{"El sitio bloquea<br/>clientes automatizados?"}
  proxy["Usar r.jina.ai<br/>y anotar el riesgo"]
  crear["Crear src/providers/key.provider.js<br/>parse puro + fetch(ctx)"]
  registrar["Agregar una linea<br/>en src/providers/index.js"]
  fixtures["Grabar fixtures<br/>npm run fixtures:record -- key"]
  tests["Caso en ACCEPTANCE_CASES<br/>y tests del parser"]
  golden["npm run fixtures:golden<br/>revisar git diff"]
  check["npm run check y npm run smoke"]
  docs(["Documentar en README,<br/>openapi.yaml y RIESGOS.md"])

  inicio --> html
  html -->|"no, carga por JS"| buscar --> json
  html -->|"si"| json
  json -->|"no"| regex --> bloqueo
  json -->|"si"| bloqueo
  bloqueo -->|"si"| proxy --> crear
  bloqueo -->|"no"| crear
  crear --> registrar --> fixtures --> tests --> golden --> check --> docs
```

**Leyenda**
- **Rombo:** decisión.
- **Óvalo:** inicio o fin.

**Lo que no hace falta tocar:** `services/`, `interfaces/` ni `bootstrap.js`. El emisor aparece solo en `/v1/banks`, en las búsquedas y en `/v1/health`, porque todos leen el registro ([ADR 0003](../adr/0003-contrato-de-provider-y-registro.md)).

**Checklist del provider** (`npm run lint` verifica los puntos marcados con ✓)
- No usar `fetch` ni `process.env` directamente: usar `ctx.http` y `ctx.config`. ✓
- Usar `ctx.now()` en lugar de `new Date()`, y pasar `ctx.signal` a cada `http.*` y `sleep`.
- Pasar `label: NAME` en las peticiones, para que los errores salgan como "`<Emisor>` respondio N: ...".
- Asignar `sourceId` estable y `logo` en `createEntry`.
- Mantener el archivo bajo 200 líneas; si el parser crece, sepáralo en `<key>.parser.js`, como Banco de Chile. ✓
