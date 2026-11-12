// Ultimo estado conocido de cada emisor, para GET /v1/health. Vive en memoria del proceso.

/**
 * @typedef {object} SourceReport
 * @property {string} key
 * @property {string} bank
 * @property {'ok'|'empty'|'error'} status  empty = respondio 0 registros (posible parser roto)
 * @property {number} count
 * @property {boolean} cached
 * @property {number} durationMs
 * @property {{ code: string, message: string }} [error]
 */

function createSourceStatusTracker({ clock = () => new Date() } = {}) {
  const last = new Map();

  const record = ({ key, bank, status, count, cached, durationMs, error }) => {
    const summary = { key, bank, status, count, cached, durationMs };
    if (error) summary.error = error;
    last.set(key, { ...summary, checkedAt: clock().toISOString() });
  };

  // Estado por emisor registrado; "unknown" si todavia no se consulto en este proceso.
  const snapshot = (providers) =>
    providers.map(
      (p) => last.get(p.key) || { key: p.key, bank: p.name, status: 'unknown', checkedAt: null },
    );

  return { record, snapshot };
}

module.exports = { createSourceStatusTracker };
