// CORS configurable con CORS_ORIGINS. Vacio = desactivado (las apps moviles nativas no lo
// necesitan; solo aplica a clientes web). "*" permite cualquier origen.

const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = 'content-type, authorization, x-api-key';
const MAX_AGE_SECONDS = '600';

/**
 * Headers CORS para la peticion, o null si CORS no aplica (desactivado u origen no permitido).
 * @param {import('http').IncomingMessage} req
 * @param {string[]} origins
 */
function corsHeaders(req, origins) {
  if (!origins.length) return null;

  if (origins.includes('*')) {
    return { 'access-control-allow-origin': '*' };
  }

  const origin = req.headers.origin;
  if (origin && origins.includes(origin)) {
    return { 'access-control-allow-origin': origin, vary: 'origin' };
  }
  return null;
}

// Respuesta a una peticion preflight (OPTIONS) de un origen permitido.
const preflightResponse = () => ({
  status: 204,
  body: null,
  headers: {
    'access-control-allow-methods': ALLOWED_METHODS,
    'access-control-allow-headers': ALLOWED_HEADERS,
    'access-control-max-age': MAX_AGE_SECONDS,
  },
});

module.exports = { corsHeaders, preflightResponse };
