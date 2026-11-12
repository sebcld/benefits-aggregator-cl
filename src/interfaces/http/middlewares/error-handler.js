// Traduce cualquier error a una respuesta HTTP.
//   API v1:     { error: { code, message, details? } } con el status correcto.
//   API legada: { error: "<mensaje>" } (formato historico).
const { AppError } = require('../../../domain/errors');

const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  MISSING_QUERY: 400,
  QUERY_TOO_LONG: 400,
  UNKNOWN_BANK: 400,
  INVALID_PAGINATION: 400,
  INVALID_JSON: 400,
  INVALID_BODY: 400,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  PAYLOAD_TOO_LARGE: 413,
};

function statusFor(err) {
  if (err instanceof AppError) return err.status || STATUS_BY_CODE[err.code] || 500;
  return 500;
}

/**
 * @param {unknown} err
 * @param {'legacy'|'v1'} api
 * @returns {{ status: number, body: object, headers?: object }}
 */
function toErrorResponse(err, api) {
  const status = statusFor(err);
  const headers = err?.headers;

  if (api === 'legacy') {
    return { status, headers, body: { error: err?.message || 'Error interno' } };
  }

  // En v1 los errores 5xx no exponen detalles internos.
  const error =
    status >= 500
      ? { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' }
      : { code: err.code, message: err.message };
  if (status < 500 && err.details !== undefined) error.details = err.details;

  return { status, headers, body: { error } };
}

module.exports = { toErrorResponse, STATUS_BY_CODE };
