// Autenticacion por API key (ADR 0014). La llave viaja en "Authorization: Bearer <llave>" o en
// "x-api-key: <llave>" y se compara contra API_KEYS en tiempo constante. Sin llaves configuradas,
// la autenticacion queda desactivada (desarrollo local).
const { createHash, timingSafeEqual } = require('crypto');
const { unauthorized } = require('../http-error');

// Se comparan los hash SHA-256 (siempre 32 bytes): timingSafeEqual exige largos iguales, y asi el
// tiempo de respuesta no revela ni el largo ni el contenido de la llave.
const digest = (value) => createHash('sha256').update(value, 'utf8').digest();

/** Llave enviada por el cliente, o '' si no envio ninguna. */
function presentedKey(headers) {
  const authorization = String(headers.authorization || '');
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();
  return String(headers['x-api-key'] || '').trim();
}

/**
 * @param {{ name: string, key: string }[]} apiKeys  de config.apiKeys
 * @returns {{ enabled: boolean, authenticate: (req: import('http').IncomingMessage) => string|null }}
 *   authenticate devuelve el nombre del cliente (null si la autenticacion esta desactivada) o
 *   lanza un HttpError 401.
 */
function createAuthenticator(apiKeys = []) {
  const known = apiKeys.map(({ name, key }) => ({ name, hash: digest(key) }));

  function authenticate(req) {
    if (!known.length) return null;
    const presented = presentedKey(req.headers);
    if (!presented) throw unauthorized();
    const hash = digest(presented);
    // Se recorren todas las llaves (sin cortar en la primera) para no variar el tiempo.
    let client = null;
    for (const entry of known) if (timingSafeEqual(hash, entry.hash)) client = entry.name;
    if (!client) throw unauthorized();
    return client;
  }

  return { enabled: known.length > 0, authenticate };
}

module.exports = { createAuthenticator, presentedKey };
