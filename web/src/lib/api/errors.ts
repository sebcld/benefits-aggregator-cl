// Error uniforme del cliente: el mismo formato { code, message } que la API /v1, mas el status HTTP.

/** Codigos propios del cliente (sin respuesta del servidor). */
export type ClientErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'ABORTED' | 'INVALID_RESPONSE';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number | null = null, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Errores que vale la pena reintentar (red, timeout o falla del servidor). */
  get retryable(): boolean {
    return this.status === null || this.status >= 500;
  }
}

/** Mensaje para la persona usuaria segun el error (los textos del diseno). */
export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'TIMEOUT') {
      return 'Los emisores están tardando más de lo normal. Inténtalo de nuevo en unos segundos.';
    }
    if (error.code === 'QUERY_TOO_LONG') return 'La búsqueda es demasiado larga. Usa menos de 100 caracteres.';
    if (error.code === 'UNKNOWN_BANK') return 'Uno de los emisores seleccionados no existe. Limpia los filtros.';
    if (error.status !== null && error.status >= 500) {
      return 'El servicio de beneficios no está disponible en este momento. Inténtalo de nuevo.';
    }
  }
  return 'No pudimos cargar los beneficios. Revisa tu conexión e inténtalo de nuevo.';
}
