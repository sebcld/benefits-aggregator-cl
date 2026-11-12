// Servidor HTTP (modulo nativo). Une router, CORS, body parser, manejo de errores y log de acceso.
const http = require('http');
const { randomUUID } = require('crypto');
const { performance } = require('perf_hooks');
const { createRouter } = require('./router');
const { createRoutes } = require('./routes');
const { corsHeaders, preflightResponse } = require('./middlewares/cors');
const { readJsonBody } = require('./middlewares/body-parser');
const { toErrorResponse } = require('./middlewares/error-handler');

function sendJson(res, status, body, headers = {}) {
  const extra = Object.fromEntries(Object.entries(headers).filter(([, v]) => v !== undefined));
  if (body === null) {
    res.writeHead(status, extra);
    return res.end();
  }
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json),
    ...extra,
  });
  return res.end(json);
}

/**
 * @param {object} deps
 * @param {ReturnType<import('../../bootstrap').createApp>} deps.app
 * @param {string} deps.version
 */
function createHttpServer({ app, version }) {
  const { config, logger } = app;
  const router = createRouter(createRoutes({ app, version }));

  async function handle(req, url, requestId, cors) {
    if (req.method === 'OPTIONS' && cors) return { api: 'legacy', response: preflightResponse() };

    const match = router.match(req.method, url.pathname);
    if (match.error) return { api: match.api, error: match.error };

    const lenient = match.route.api === 'legacy';
    const readJson = () => readJsonBody(req, config.bodyLimitBytes, { lenient });
    const ctx = { req, url, requestId, readJson };
    return { api: match.route.api, response: await match.route.handler(ctx) };
  }

  return http.createServer(async (req, res) => {
    const started = performance.now();
    const requestId = randomUUID();
    const cors = corsHeaders(req, config.corsOrigins);
    let url = null;
    let api = String(req.url).startsWith('/v1/') ? 'v1' : 'legacy';
    let response;

    try {
      url = new URL(req.url, 'http://localhost');
      const outcome = await handle(req, url, requestId, cors);
      api = outcome.api;
      response = outcome.error ? toErrorResponse(outcome.error, api) : outcome.response;
    } catch (err) {
      response = toErrorResponse(err, api);
      if (response.status >= 500) logger.error('http_unhandled_error', { requestId, error: err });
    }

    sendJson(res, response.status, response.body, {
      ...cors,
      ...response.headers,
      'x-request-id': requestId,
    });

    logger.info('http_request', {
      requestId,
      method: req.method,
      path: url ? url.pathname : req.url,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
    });
  });
}

module.exports = { createHttpServer, sendJson };
