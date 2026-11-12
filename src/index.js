// Entrypoint del CLI: node src/index.js "burger king"  (o npm run search -- "burger king")
const { createApp } = require('./bootstrap');
const { runCli } = require('./interfaces/cli/main');

if (require.main === module) {
  // Igual que la version original: sin cache (cada ejecucion es un proceso nuevo) y sin
  // timeouts (espera a todos los emisores). Logs silenciados salvo que se defina LOG_LEVEL.
  runCli(process.argv.slice(2), {
    createApp: () => createApp({ defaultLogLevel: 'silent', cache: null, timeouts: false }),
  }).then((code) => {
    process.exitCode = code;
  });
}

module.exports = { runCli };
