// Lectura del body con limite de tamano y parseo JSON con errores 4xx (no 500).
const { ValidationError } = require('../../../domain/errors');
const { payloadTooLarge } = require('../http-error');

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on('data', (chunk) => {
      if (tooLarge) return; // se sigue drenando para poder responder 413
      size += chunk.length;
      if (size > limitBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () =>
      tooLarge ? reject(payloadTooLarge(limitBytes)) : resolve(Buffer.concat(chunks).toString('utf8')),
    );
    req.on('error', reject);
  });
}

// Body vacio => {}. JSON invalido => 400 INVALID_JSON. JSON que no es objeto => 400 INVALID_BODY,
// salvo con { lenient: true } (API legada), donde se trata como {} igual que la version 1.x.
function parseJsonObject(text, { lenient = false } = {}) {
  if (!text) return {};

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError('JSON invalido', { code: 'INVALID_JSON' });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    if (lenient) return {};
    throw new ValidationError('El body debe ser un objeto JSON', { code: 'INVALID_BODY' });
  }
  return parsed;
}

const readJsonBody = async (req, limitBytes, options) =>
  parseJsonObject(await readBody(req, limitBytes), options);

module.exports = { readBody, parseJsonObject, readJsonBody };
