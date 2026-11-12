// Logger estructurado: una linea JSON por evento en stderr (stdout queda para la salida real).
// Niveles: debug < info < warn < error < silent.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const serializeError = (err) =>
  err instanceof Error ? { name: err.name, message: err.message, code: err.code } : err;

/**
 * @param {object} [options]
 * @param {keyof LEVELS} [options.level]
 * @param {{ write: (line: string) => void }} [options.stream]
 * @param {object} [options.base] campos fijos que se agregan a cada linea
 * @param {() => Date} [options.clock]
 */
function createLogger({ level = 'info', stream = process.stderr, base = {}, clock = () => new Date() } = {}) {
  if (!(level in LEVELS)) {
    throw new Error(`Nivel de log invalido: ${level}`);
  }
  const threshold = LEVELS[level];

  const log = (lvl, msg, fields = {}) => {
    if (LEVELS[lvl] < threshold) return;
    const entry = { time: clock().toISOString(), level: lvl, msg, ...base };
    for (const [key, value] of Object.entries(fields)) entry[key] = serializeError(value);
    stream.write(`${JSON.stringify(entry)}\n`);
  };

  return {
    level,
    debug: (msg, fields) => log('debug', msg, fields),
    info: (msg, fields) => log('info', msg, fields),
    warn: (msg, fields) => log('warn', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
    child: (bindings) => createLogger({ level, stream, base: { ...base, ...bindings }, clock }),
  };
}

const silentLogger = createLogger({ level: 'silent' });

module.exports = { createLogger, silentLogger, LEVELS };
