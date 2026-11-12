// Contexto de provider para tests en proceso: fetch simulado, reloj fijo y pausas instantaneas.
const { createHttpClient } = require('../../src/shared/http-client');
const { silentLogger } = require('../../src/shared/logger');
const { loadConfig } = require('../../src/config');
const { createReplayFetch } = require('./replay-fetch');
const { FIXED_NOW, TEST_ENV } = require('./constants');

const testConfig = (env = {}) => loadConfig({ env: { ...TEST_ENV, ...env }, envFilePath: null });

function createTestContext({ fetchImpl = createReplayFetch(), env, ...extra } = {}) {
  const pauses = [];
  return {
    http: createHttpClient({ fetchImpl, sleep: async (ms) => pauses.push(ms) }),
    config: testConfig(env),
    now: () => new Date(FIXED_NOW),
    sleep: async (ms) => pauses.push(ms),
    logger: silentLogger,
    pauses,
    fetchImpl,
    ...extra,
  };
}

module.exports = { createTestContext, testConfig };
