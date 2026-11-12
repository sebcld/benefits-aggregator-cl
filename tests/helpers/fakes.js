// Dobles de prueba: providers falsos, logger que registra y app armada con fixtures.
const { defineProvider } = require('../../src/providers/provider.interface');
const { createEntry } = require('../../src/domain/entry');
const { createApp } = require('../../src/bootstrap');
const { createReplayFetch } = require('./replay-fetch');
const { FIXED_NOW, TEST_ENV } = require('./constants');

function fakeProvider({ key = 'fake', name = 'Fake', titles = ['Rappi'], fail, delayMs, queryDependent }) {
  let calls = 0;
  const provider = defineProvider({
    key,
    name,
    queryDependent: Boolean(queryDependent),
    async fetch({ signal }) {
      calls += 1;
      if (delayMs) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(signal.reason);
          });
        });
      }
      if (fail) throw fail;
      return titles.map((title) => createEntry({ bank: name, title, url: `https://${key}/${title}` }));
    },
  });
  return { provider, calls: () => calls };
}

function recordingLogger() {
  const lines = [];
  const make = () => ({
    lines,
    debug: (msg, fields) => lines.push({ level: 'debug', msg, ...fields }),
    info: (msg, fields) => lines.push({ level: 'info', msg, ...fields }),
    warn: (msg, fields) => lines.push({ level: 'warn', msg, ...fields }),
    error: (msg, fields) => lines.push({ level: 'error', msg, ...fields }),
    child: () => make(),
  });
  return make();
}

// App completa con fixtures reales, reloj fijo y pausas instantaneas.
function createFixtureApp({ env = {}, ...options } = {}) {
  return createApp({
    env: { ...TEST_ENV, ...env },
    envFilePath: null,
    fetchImpl: createReplayFetch(),
    clock: () => new Date(FIXED_NOW),
    sleep: async () => {},
    ...options,
  });
}

module.exports = { fakeProvider, recordingLogger, createFixtureApp };
