# 0010. Secretos solo en `.env`, leídos por una config validada

- **Estado:** Aceptado
- **Fecha:** 2026-11-12

## Contexto

La llave de suscripción de BCI estaba escrita en `src/benefits.js` como valor por defecto. La primera solución (`src/config.js`, commit `f8352c7`) la movió a `.env`, pero leía el archivo al importarse y no validaba los valores: con `PORT=abc` usaba 3000 sin avisar.

## Alternativas consideradas

1. **`node --env-file=.env` en los scripts** *(reconstruida)* (Node 20.6+). No hay que escribir código, pero no funciona en Node 18 ni al importar la fachada como librería.
2. **`process.loadEnvFile`** (Node 20.12+). Lo usaba la primera versión, pero modifica `process.env` y no existe en Node 18.
3. **Un parser propio sin efectos más una config validada y tipada** (elegida).

## Decisión

- **Lectura sin efectos.** `src/config/env-file.js` lee `.env` (formato `CLAVE=valor`, con comentarios, `export` y comillas) **sin modificar** `process.env`.
- **Config validada.** `loadConfig({ env, envFilePath })` combina, en orden de prioridad, las variables del entorno, el archivo `.env` y los valores por defecto. Valida los tipos y rangos y devuelve un objeto congelado. Si encuentra problemas, lanza `ConfigError` con todos ellos.
- **Solo `src/config/` lee `process.env`;** el resto recibe la `config` (los providers, en `ctx.config`). `npm run lint` lo verifica, y verifica también que no haya llaves de 32 caracteres hexadecimales en `src/` ni en `docs/`.
- **`.env` está en `.gitignore`;** `.env.example` documenta todas las variables sin valores reales.
- **`BCI_SUBSCRIPTION_KEY` es obligatoria.** Sin ella, BCI falla con `MISSING_CREDENTIALS` y los demás emisores siguen funcionando.

## Consecuencias

- **Positivas:**
  - Ninguna llave en el código ni en el historial de los commits del refactor.
  - Una configuración errónea falla al iniciar con un mensaje claro.
  - Los tests pasan su propio `env`, sin depender del `.env` local.
- **Negativas:**
  - El parser no soporta valores multilínea.
  - La llave de BCI se saca del sitio público del banco y puede rotar sin aviso (`docs/RIESGOS.md` #6).
  - Las llaves no salen de un gestor de secretos (Vault, Secrets Manager): para producción hay que inyectarlas como variables de entorno.

## Evidencia

- **Commits:** `f8352c7` y `1755f54`.
- **Código:** `src/config/` y `.env.example`.
- **Tests:** `tests/unit/config/config.test.js`.
