# 0020. Actualización a Node 26 (LTS) e integración continua

- **Estado:** Aceptado (pasos 1 a 4 implementados; el paso 5 queda para PR separados)
- **Fecha:** 2026-11-12
- **Relación:** reemplaza la versión mínima de Node de [0002](0002-node-nativo-sin-dependencias-y-commonjs.md); el resto de 0002 sigue vigente

## Contexto

`package.json` declara `engines.node >= 18` y el entorno de desarrollo usa Node 24.13.0. Según el [calendario oficial de Node.js](https://github.com/nodejs/Release/blob/main/schedule.json), al 2026-11-12:

| Versión | Estado | Fin de vida |
|---|---|---|
| 18 | **Sin soporte** | 2025-04-30 |
| 20 | **Sin soporte** | 2026-04-30 |
| 22 | Mantenimiento | 2027-04-30 |
| 24 | Mantenimiento (desde 2026-10-20) | 2028-04-30 |
| **26 "Lithium"** | **LTS activa** (desde 2026-10-28; última versión v26.13.1, del 2026-11-10) | 2029-04-30 |

`engines` promete compatibilidad con dos versiones sin soporte que nunca se probaron (`docs/RIESGOS.md` #14). Tampoco hay CI: `npm run check` y `npm run smoke` se corren a mano.

**Evidencia de compatibilidad.** El 2026-11-12 se probó el proyecto, sin cambios de código, con el binario oficial de Node **v26.13.1** (`win-x64`, SHA-256 verificado contra `SHASUMS256.txt`):
- `npm run lint`: OK (74 archivos JS, 40 documentos);
- `npm test`: **241/241**, incluidos los procesos hijo del CLI y del servidor, que corren con el mismo binario;
- `npm run smoke` en vivo: **6/6** casos de aceptación;
- sin avisos de deprecación en stderr. Los tests de caracterización comparan stderr byte a byte, así que cualquier aviso los habría hecho fallar.

## Alternativas consideradas

1. **Mantener `>=18`** (lo de hoy).
   - Pros: ningún usuario tiene que actualizar.
   - Contras: promete versiones sin parches de seguridad y sin probar, e impide usar APIs modernas.
2. **Subir a `>=22`.**
   - Pros: la actualización es menor.
   - Contras: Node 22 queda sin soporte en unos 5 meses (2027-04-30), así que habría que volver a decidir enseguida.
3. **Subir a `>=24`.**
   - Pros: coincide con el entorno de desarrollo actual.
   - Contras: ya está en mantenimiento; recibe solo correcciones críticas.
4. **Actualizar a Node 26 LTS** como runtime de desarrollo, CI y producción, con `engines.node >= 26`.
   - Pros: soporte hasta 2029-04-30, y ya se verificó que funciona.
   - Contras: los entornos con Node 24 o anterior tienen que actualizarse.

## Decisión

**Opción 4: actualizar a Node 26 LTS.** Se implementó así:

1. **Versión fija.**
   - `package.json`: `"engines": { "node": ">=26" }`.
   - Agregar `.nvmrc` con `26`, para que nvm, fnm y los servicios de despliegue tomen la versión.
2. **CI con GitHub Actions** (`.github/workflows/check.yml`). La versión de Node se toma de `.nvmrc`.
   - **Job `check`:** en cada PR y en cada push a `main`, `npm run check` en Node 26, sin secretos, porque los tests no usan red.
   - **Job `smoke`:** una vez al día (08:00 en Chile) o a mano (`workflow_dispatch`), `npm run smoke` con los secretos del repositorio `BCI_SUBSCRIPTION_KEY` y `JINA_API_KEY` (opcional).
     - Si falla, abre el issue "Smoke en vivo fallando", o lo comenta si ya está abierto, porque indica que una fuente cambió.
     - Antes de publicar la salida en el issue, reemplaza los valores de los secretos por `***`.
3. **Entorno local.** Node 26 instalado con `winget upgrade --id OpenJS.NodeJS.LTS` (de 24.13.0 a 26.13.1).
4. **Documentación.** "Node 26 o superior" en `README.md`, `docs/ARQUITECTURA.md` y `entregable/CONTEXTO_PROYECTO.md`. El riesgo #14 de `docs/RIESGOS.md` quedó resuelto.
5. **Simplificaciones opcionales (pendientes), en PR separados y protegidas por los tests de caracterización.** Ahora que la versión mínima es 26, se pueden usar:
   - reemplazar `anySignal` (`src/shared/async.js`) por `AbortSignal.any`, nativo desde Node 20.3;
   - evaluar reemplazar el parser de `src/config/env-file.js` por `util.parseEnv` (Node 20.12+), que tampoco modifica `process.env`. Hay que verificar con `tests/unit/config/config.test.js` que se comporta igual con comentarios, `export` y comillas.

## Consecuencias

- **Positivas:**
  - Runtime con soporte hasta 2029-04-30.
  - `engines` deja de prometer versiones sin probar.
  - Ningún PR entra con tests rotos, y los cambios de las fuentes se detectan en menos de un día.
- **Negativas:**
  - **Es un cambio visible.** Quien use el proyecto con Node 24 o anterior verá un aviso de `engines` y tendrá que actualizar.
  - **Los secretos de BCI quedan en GitHub,** y el smoke diario consume parte del límite de `r.jina.ai`.
  - **Habrá que repetir el ejercicio** cuando Node 26 pase a mantenimiento (2027-10-20).

## Evidencia

- **Código:** `package.json` (`engines.node >= 26`), `.nvmrc` y `.github/workflows/check.yml`.
- **Verificación local con Node v26.13.1 instalado:** `npm run check` (lint y 241 tests) y `npm run smoke` en vivo.
- **CI:** la primera corrida del job `check` en el PR de esta implementación.
