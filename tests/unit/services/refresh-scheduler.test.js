// Actualizacion diaria programada (ADR 0024), con reloj y timers inyectados: sin esperas reales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRefreshScheduler } = require('../../../src/services/refresh-scheduler');
const { recordingLogger } = require('../../helpers/fakes');
const { nextDailyAt } = require('../../../src/shared/dates');

const HOUR = 3_600_000;

// Reloj manual y timers falsos: setTimer guarda el callback y su espera; tick() avanza el reloj y
// dispara el timer pendiente.
function harness({ start = '2026-11-13T09:00:00Z', refreshAll } = {}) {
  let now = Date.parse(start);
  const timers = [];
  const logger = recordingLogger();
  const calls = [];
  const scheduler = createRefreshScheduler({
    refreshAll:
      refreshAll ||
      (async () => {
        calls.push(new Date(now).toISOString());
        return [{ key: 'a', status: 'ok' }, { key: 'b', status: 'ok' }];
      }),
    nextRunAt: (ms) => nextDailyAt(ms, '09:00'),
    now: () => now,
    logger,
    time: '09:00',
    timeZone: 'America/Santiago',
    setTimer: (fn, ms) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      t.cleared = true;
    },
  });
  const pending = () => timers.filter((t) => !t.cleared && !t.fired);
  const fireNext = async () => {
    const t = pending()[0];
    now += t.ms;
    t.fired = true;
    await t.fn();
  };
  return { scheduler, timers, pending, fireNext, logger, calls, now: () => now };
}

test('start programa la proxima ejecucion a las 09:00 de Chile', () => {
  const h = harness(); // 06:00 en Chile
  h.scheduler.start();
  assert.equal(h.pending().length, 1);
  assert.equal(h.pending()[0].ms, 3 * HOUR);
  assert.equal(h.scheduler.status().nextRunAt, '2026-11-13T12:00:00.000Z');
  assert.equal(h.scheduler.status().enabled, true);
  // El log no pisa el campo "time" (la fecha de la linea) con la hora configurada.
  const planned = h.logger.lines.find((l) => l.msg === 'scheduled_refresh_planned');
  assert.equal(planned.refreshTime, '09:00');
  assert.equal('time' in planned, false);
});

test('al dispararse actualiza todo, registra lastRun y reprograma para el dia siguiente', async () => {
  const h = harness();
  h.scheduler.start();
  await h.fireNext();
  assert.deepEqual(h.calls, ['2026-11-13T12:00:00.000Z']);
  const { lastRun, nextRunAt } = h.scheduler.status();
  assert.equal(lastRun.status, 'ok');
  assert.equal(lastRun.trigger, 'scheduled');
  assert.equal(nextRunAt, '2026-11-14T12:00:00.000Z');
  assert.equal(h.pending()[0].ms, 24 * HOUR);
  assert.ok(h.logger.lines.some((l) => l.msg === 'scheduled_refresh_done'));
});

test('un emisor caido deja la ejecucion como partial; si falla todo, error; y siempre reprograma', async () => {
  const partial = harness({ refreshAll: async () => [{ key: 'a', status: 'ok' }, { key: 'b', status: 'error' }] });
  partial.scheduler.start();
  await partial.fireNext();
  assert.deepEqual(
    [partial.scheduler.status().lastRun.status, partial.scheduler.status().lastRun.failed],
    ['partial', ['b']],
  );

  const broken = harness({
    refreshAll: async () => {
      throw new Error('sin red');
    },
  });
  broken.scheduler.start();
  await broken.fireNext();
  assert.equal(broken.scheduler.status().lastRun.status, 'error');
  assert.ok(broken.logger.lines.some((l) => l.msg === 'scheduled_refresh_failed'));
  assert.equal(broken.pending().length, 1); // reprogramado igual
});

test('un timer que despierta antes de tiempo solo reprograma, sin actualizar', async () => {
  const h = harness();
  h.scheduler.start();
  h.pending()[0].ms = HOUR; // despierta 2 h antes de las 09:00
  await h.fireNext();
  assert.deepEqual(h.calls, []);
  assert.equal(h.pending()[0].ms, 2 * HOUR);
});

test('dos actualizaciones no se solapan', async () => {
  let release;
  const h = harness({
    refreshAll: () =>
      new Promise((resolve) => {
        release = () => resolve([{ key: 'a', status: 'ok' }]);
      }),
  });
  const first = h.scheduler.runNow('manual');
  const second = h.scheduler.runNow('manual');
  release();
  assert.equal(await first, await second);
});

test('stop cancela el timer y el estado deja de informar la proxima ejecucion', () => {
  const h = harness();
  h.scheduler.start();
  h.scheduler.stop();
  assert.equal(h.pending().length, 0);
  assert.equal(h.scheduler.status().nextRunAt, null);
});
