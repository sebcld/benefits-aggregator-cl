const fs = require('fs');
const path = require('path');

const ENV_PATH = path.resolve(__dirname, '..', '.env');

// Carga .env sin dependencias. Las variables ya definidas en el entorno tienen prioridad.
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(filePath); // Node 20.12+ / 21.7+
    return;
  }

  // Respaldo para Node 18: formato simple CLAVE=valor, con comentarios (#) y comillas opcionales.
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const [, key, rawValue = ''] = match;
    let value = rawValue.trim();
    const quoted = value.match(/^(['"])([\s\S]*)\1$/);
    value = quoted ? quoted[2] : value.replace(/\s+#.*$/, '');

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(ENV_PATH);

const env = (name) => (process.env[name] || '').trim();

module.exports = {
  port: Number(env('PORT')) || 3000,
  bciSubscriptionKey: env('BCI_SUBSCRIPTION_KEY'),
  mercadoPagoToken: env('MELI_ACCESS_TOKEN') || env('MERCADOPAGO_TOKEN'),
};
