// Actualizacion diaria programada de los catalogos (ADR 0024): a una hora fija del dia en Chile
// (REFRESH_TIME, por defecto 09:00) vuelve a descargar todos los emisores y renueva la cache.
// Usa un timer nativo hasta la proxima ejecucion y lo recalcula despues de cada una (sin cron ni
// dependencias). Solo lo arranca el servidor HTTP: el CLI y la fachada no programan nada.

// setTimeout acepta como maximo ~24,8 dias; la espera real nunca pasa de 24 h, pero se acota por
// seguridad (si el reloj salta, el timer despierta antes y vuelve a calcular).
const MAX_TIMER_MS = 2_147_483_647;

/**
 * @param {object} deps
 * @param {() => Promise<object[]>} deps.refreshAll  searchService.refreshAll (estado por emisor)
 * @param {(nowMs: number) => number} deps.nextRunAt  proximo instante de ejecucion (ms UTC)
 * @param {() => number} deps.now  reloj en ms
 * @param {object} deps.logger
 * @param {string} [deps.time]  hora configurada ("09:00"), solo para informar
 * @param {string} [deps.timeZone]
 * @param {Function} [deps.setTimer]  inyectable en tests (por defecto setTimeout)
 * @param {Function} [deps.clearTimer]
 */
function createRefreshScheduler({
  refreshAll,
  nextRunAt,
  now,
  logger,
  time = null,
  timeZone = null,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let timer = null;
  let nextAt = null;
  let running = null;
  let lastRun = null;

  function schedule() {
    nextAt = nextRunAt(now());
    timer = setTimer(fire, Math.min(Math.max(0, nextAt - now()), MAX_TIMER_MS));
    // El timer no debe impedir que el proceso termine (el servidor HTTP lo mantiene vivo).
    timer?.unref?.();
  }

  // Ejecuta la actualizacion completa. Nunca rechaza: un fallo queda en lastRun y en el log.
  async function runNow(trigger = 'scheduled') {
    if (running) return running; // no se solapan dos actualizaciones completas
    const startedAt = now();
    const summary = (status, failed) => ({
      trigger,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(now()).toISOString(),
      status,
      failed,
    });
    running = (async () => {
      try {
        const sources = await refreshAll();
        const failed = sources.filter((s) => s.status === 'error').map((s) => s.key);
        const status =
          failed.length === 0 ? 'ok' : failed.length < sources.length ? 'partial' : 'error';
        lastRun = summary(status, failed);
        logger.info('scheduled_refresh_done', { ...lastRun, durationMs: now() - startedAt });
      } catch (err) {
        lastRun = summary('error', []);
        logger.error('scheduled_refresh_failed', { trigger, error: err });
      } finally {
        running = null;
      }
      return lastRun;
    })();
    return running;
  }

  async function fire() {
    timer = null;
    // Un timer que despierta antes de tiempo (reloj ajustado, espera acotada) solo reprograma.
    if (nextAt !== null && now() < nextAt) return schedule();
    await runNow('scheduled');
    schedule();
  }

  return {
    /** Programa la proxima ejecucion. Idempotente. */
    start() {
      if (!timer) schedule();
      // "refreshTime" y no "time": el logger ya usa "time" para la fecha de cada linea.
      logger.info('scheduled_refresh_planned', {
        refreshTime: time,
        timeZone,
        nextRunAt: new Date(nextAt).toISOString(),
      });
    },
    stop() {
      if (timer) clearTimer(timer);
      timer = null;
      nextAt = null;
    },
    runNow,
    /** Estado para /v1/health. nextRunAt es null si el scheduler no esta corriendo. */
    status: () => ({
      enabled: true,
      time,
      timeZone,
      nextRunAt: timer && nextAt !== null ? new Date(nextAt).toISOString() : null,
      lastRun,
    }),
  };
}

module.exports = { createRefreshScheduler, MAX_TIMER_MS };
