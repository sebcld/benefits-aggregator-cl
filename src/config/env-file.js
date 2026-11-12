// Lectura de archivos .env sin dependencias. No modifica process.env.
const fs = require('fs');

// Formato: CLAVE=valor, lineas "# comentario", "export CLAVE=valor" y comillas opcionales.
function parseEnvContent(content) {
  const vars = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const [, key, rawValue = ''] = match;
    const value = rawValue.trim();
    const quoted = value.match(/^(['"])([\s\S]*)\1$/);
    vars[key] = quoted ? quoted[2] : value.replace(/\s+#.*$/, '');
  }
  return vars;
}

// Devuelve las variables del archivo, o {} si no existe.
function readEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  return parseEnvContent(fs.readFileSync(filePath, 'utf8'));
}

module.exports = { parseEnvContent, readEnvFile };
