// Entrypoint de la API HTTP: node src/server.js  (o npm start)
const { createApp } = require('./bootstrap');
const { createHttpServer } = require('./interfaces/http/server');
const { version } = require('../package.json');

function start() {
  const app = createApp({ defaultLogLevel: 'info' });
  const { config, logger, searchService, refreshScheduler } = app;
  const server = createHttpServer({ app, version });

  server.listen(config.port, () => {
    console.log(`API de beneficios escuchando en http://localhost:${config.port}`);
    logger.info('server_started', {
      port: config.port,
      version,
      cacheEnabled: Boolean(app.cache),
      refreshTime: config.refreshTime,
      corsOrigins: config.corsOrigins,
      // Solo los nombres de los clientes, nunca las llaves.
      apiKeyClients: config.apiKeys.map((k) => k.name),
    });
    for (const warning of config.warnings) logger.warn('config_warning', { message: warning });
    if (!config.apiKeys.length) {
      console.warn('AVISO: API_KEYS no esta configurada: la API responde a cualquiera (solo para desarrollo).');
      logger.warn('auth_disabled', { hint: 'Configura API_KEYS antes de exponer la API a internet' });
    }

    // Carga inicial (ADR 0024): la cache vive en memoria, asi que tras un inicio o reinicio (por
    // ejemplo, PM2) esta vacia. Se llena ahora para no esperar a la proxima hora programada. Las
    // busquedas que lleguen mientras tanto esperan esa misma descarga (no se duplica).
    if (config.cacheWarmup && app.cache) {
      searchService
        .warmUp()
        .then((sources) => logger.info('cache_warmup_done', { sources: sources.map((s) => s.status) }))
        .catch((err) => logger.error('cache_warmup_failed', { error: err }));
    }
    refreshScheduler?.start();
  });

  const shutdown = (signal) => {
    logger.info('server_stopping', { signal });
    refreshScheduler?.stop();
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
