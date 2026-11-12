const fs = require('fs');
const path = require('path');
const { HTTP_FIXTURES_DIR } = require('./constants');

// Lee todos los fixtures HTTP grabados (un archivo por emisor).
function loadHttpFixtures(dir = HTTP_FIXTURES_DIR) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).records);
}

function toResponse(record) {
  const body = record.json !== undefined ? JSON.stringify(record.json) : record.text || '';
  return new Response(body, { status: record.status, headers: record.headers || {} });
}

// fetch simulado: responde por URL exacta. Una URL desconocida se comporta como sin red.
function createReplayFetch(records = loadHttpFixtures()) {
  const byUrl = new Map(records.map((record) => [record.url, record]));
  const calls = [];

  const replayFetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, headers: init.headers || {} });

    if (init.signal?.aborted) {
      throw init.signal.reason || new DOMException('This operation was aborted', 'AbortError');
    }

    const record = byUrl.get(url);
    if (!record) {
      throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND', url } });
    }
    return toResponse(record);
  };

  replayFetch.calls = calls;
  return replayFetch;
}

module.exports = { loadHttpFixtures, createReplayFetch };
