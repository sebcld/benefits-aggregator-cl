// API_KEYS: llaves de los clientes que pueden usar la API (ADR 0014), separadas por coma.
// Cada una puede llevar un nombre: "web:<llave>,movil:<llave>". El nombre sirve para revocar un
// cliente sin tocar a los demas y para el log de acceso (la llave nunca se registra).
// Sin llaves, la API no exige autenticacion (desarrollo local); el servidor lo avisa al iniciar.

const MIN_KEY_LENGTH = 32;
const NAME = /^[a-z0-9_-]{1,40}$/i;

/**
 * @param {string[]} items  valores de API_KEYS ya separados por coma
 * @param {string[]} problems  se agregan aqui los errores (no lanza)
 * @returns {{ name: string, key: string }[]}
 */
function parseApiKeys(items, problems) {
  const keys = [];
  items.forEach((item, index) => {
    const separator = item.indexOf(':');
    const hasName = separator > 0 && NAME.test(item.slice(0, separator));
    const name = hasName ? item.slice(0, separator) : `cliente-${index + 1}`;
    const key = hasName ? item.slice(separator + 1).trim() : item;

    // Nunca se incluye la llave en el mensaje: los errores de config se imprimen en consola.
    if (key.length < MIN_KEY_LENGTH) {
      problems.push(`API_KEYS: la llave de "${name}" debe tener al menos ${MIN_KEY_LENGTH} caracteres`);
    } else if (keys.some((k) => k.key === key)) {
      problems.push(`API_KEYS: la llave de "${name}" esta repetida`);
    } else if (keys.some((k) => k.name === name)) {
      problems.push(`API_KEYS: el nombre "${name}" esta repetido`);
    } else {
      keys.push({ name, key });
    }
  });
  return keys;
}

module.exports = { parseApiKeys, MIN_KEY_LENGTH };
