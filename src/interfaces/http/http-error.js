// Errores propios del transporte HTTP (ruta inexistente, metodo no permitido, body invalido).
const { AppError } = require('../../domain/errors');

class HttpError extends AppError {
  constructor(status, code, message, { headers, details } = {}) {
    super(message, { code, details });
    this.status = status;
    if (headers) this.headers = headers;
  }
}

const notFound = () => new HttpError(404, 'NOT_FOUND', 'No encontrado');

const methodNotAllowed = (allowed) =>
  new HttpError(405, 'METHOD_NOT_ALLOWED', `Metodo no permitido. Usa: ${allowed.join(', ')}`, {
    headers: { allow: allowed.join(', ') },
  });

const payloadTooLarge = (limit) =>
  new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Body demasiado grande', {
    details: { limitBytes: limit },
  });

module.exports = { HttpError, notFound, methodNotAllowed, payloadTooLarge };
