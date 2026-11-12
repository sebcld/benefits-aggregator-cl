// Errores de dominio. Cada error tiene un "code" estable que las interfaces traducen
// a su formato (mensaje en el CLI, status + { error: { code, message } } en la API).

class AppError extends Error {
  constructor(message, { code = 'INTERNAL_ERROR', details, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

// Datos de entrada invalidos (consulta vacia, parametros fuera de rango, etc.).
class ValidationError extends AppError {
  constructor(message, { code = 'VALIDATION_ERROR', details } = {}) {
    super(message, { code, details });
  }
}

// Configuracion invalida al iniciar (.env mal formado, valores fuera de rango).
class ConfigError extends AppError {
  constructor(message, { details } = {}) {
    super(message, { code: 'CONFIG_ERROR', details });
  }
}

// Falla de una fuente externa (HTTP no-OK, formato inesperado, sin red).
class ProviderError extends AppError {
  constructor(message, { code = 'PROVIDER_ERROR', status, cause } = {}) {
    super(message, { code, cause });
    if (status !== undefined) this.status = status;
  }
}

// Una operacion excedio su tiempo limite.
class TimeoutError extends AppError {
  constructor(message, { timeoutMs } = {}) {
    super(message, { code: 'TIMEOUT' });
    this.timeoutMs = timeoutMs;
  }
}

// Codigo estable para cualquier error (incluidos los nativos, como "fetch failed").
function errorCode(err) {
  if (err instanceof AppError) return err.code;
  if (err?.name === 'SyntaxError') return 'INVALID_RESPONSE';
  if (err?.name === 'AbortError') return 'ABORTED';
  if (err instanceof TypeError && /fetch failed/i.test(err.message)) return 'NETWORK_ERROR';
  return 'PROVIDER_ERROR';
}

module.exports = { AppError, ValidationError, ConfigError, ProviderError, TimeoutError, errorCode };
