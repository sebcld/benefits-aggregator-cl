// Entrypoint de la API HTTP: node src/server.js  (o npm start)
const { createApp } = require('./bootstrap');
const { createHttpServer } = require('./interfaces/http/server');
const { version } = require('../package.json');

function start() {
  const app = createApp({ defaultLogLevel: 'info' });
  const { config, logger, searchService } = app;
  const server = createHttpServer({ app, version });

  server.listen(config.port, () => {
    console.log(`API de beneficios escuchando en http://localhost:${config.port}`);
    logger.info('server_started', {
      port: config.port,
      version,
      cacheTtlSeconds: config.cacheTtlSeconds,
      corsOrigins: config.corsOrigins,
    });

    if (config.cacheWarmup) {
      searchService
        .warmUp()
        .then((sources) => logger.info('cache_warmup_done', { sources: sources.map((s) => s.status) }))
        .catch((err) => logger.error('cache_warmup_failed', { error: err }));
    }
  });

  const shutdown = (signal) => {
    logger.info('server_stopping', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return server;
}

if (require.main === module) {
  try {
    start();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { start };
