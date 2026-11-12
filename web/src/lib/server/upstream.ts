// Acceso del BFF a la API de beneficios (/v1). Solo corre en el servidor de Next.
// Aqui viven la URL de la API y la API key (ADR 0014): el navegador y la futura app movil
// llaman a /api/* y nunca ven ninguna de las dos.
import 'server-only';

export interface UpstreamConfig {
  baseUrl: string;
  apiKey: string | null;
  timeoutMs: number;
}

export function upstreamConfig(env: NodeJS.ProcessEnv = process.env): UpstreamConfig {
  const timeout = Number(env.BENEFITS_API_TIMEOUT_MS ?? 65_000);
  return {
    baseUrl: (env.BENEFITS_API_URL || 'http://localhost:3000').replace(/\/+$/, ''),
    apiKey: env.BENEFITS_API_KEY?.trim() || null,
    // La API corta cada emisor a los 60 s (PROVIDER_TIMEOUT_MS) y responde parcial: se espera un poco mas.
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 65_000,
  };
}

export interface UpstreamResult<T> {
  status: number;
  body: T;
}

/** Error con el mismo formato que la API: { error: { code, message } }. */
export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

/**
 * GET a la API. Nunca lanza: los errores de red y timeout se devuelven como 502/504 con el
 * formato de error de /v1, para que el cliente los trate igual que cualquier otro error.
 */
export async function upstreamGet<T>(
  path: string,
  { signal, config = upstreamConfig(), fetchImpl = fetch }: { signal?: AbortSignal; config?: UpstreamConfig; fetchImpl?: typeof fetch } = {},
): Promise<UpstreamResult<T | ReturnType<typeof errorBody>>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (config.apiKey) headers['x-api-key'] = config.apiKey;

  const timeout = AbortSignal.timeout(config.timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const response = await fetchImpl(`${config.baseUrl}${path}`, { headers, signal: combined, cache: 'no-store' });
    const body = (await response.json().catch(() => null)) as T | null;
    if (body === null) {
      return { status: 502, body: errorBody('UPSTREAM_INVALID_RESPONSE', `La API respondió ${response.status} sin JSON`) };
    }
    return { status: response.status, body };
  } catch {
    if (timeout.aborted) return { status: 504, body: errorBody('UPSTREAM_TIMEOUT', 'La API de beneficios tardó demasiado') };
    return { status: 502, body: errorBody('UPSTREAM_UNAVAILABLE', 'No se pudo contactar la API de beneficios') };
  }
}
