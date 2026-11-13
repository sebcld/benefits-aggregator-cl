// Acceso del BFF a la API de beneficios (/v1). Solo corre en el servidor de Next.
// Aqui viven la URL de la API y la API key (ADR 0014): el navegador y la futura app movil
// llaman a /api/* y nunca ven ninguna de las dos. La llave se envia como
// "Authorization: Bearer <BENEFITS_API_KEY>" en cada peticion.
import 'server-only';

export interface UpstreamConfig {
  baseUrl: string;
  apiKey: string | null;
  timeoutMs: number;
}

// Next incrusta en el JavaScript del navegador toda variable NEXT_PUBLIC_*: una llave con ese
// prefijo quedaria a la vista de cualquiera. Estos nombres delatan un secreto mal configurado.
const SECRET_NAME = /(API_?KEY|TOKEN|SECRET|PASSWORD)/i;

/** Variables NEXT_PUBLIC_* con valor que parecen secretos (deberian ir sin el prefijo). */
export function publicSecretNames(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.keys(env).filter((name) => name.startsWith('NEXT_PUBLIC_') && SECRET_NAME.test(name) && Boolean(env[name]));
}

/**
 * Lanza si hay un secreto con prefijo NEXT_PUBLIC_. Se llama al iniciar el servidor
 * (instrumentation.ts, deja el error en el log) y en cada peticion a la API (upstreamConfig): el
 * BFF no llega a llamar a la API con una llave mal configurada.
 */
export function assertNoPublicSecrets(env: NodeJS.ProcessEnv = process.env): void {
  const names = publicSecretNames(env);
  if (names.length) {
    throw new Error(
      `${names.join(', ')}: un secreto con prefijo NEXT_PUBLIC_ llega al navegador. ` +
        'Usa BENEFITS_API_KEY (sin NEXT_PUBLIC_) y vuelve a compilar.',
    );
  }
}

export function upstreamConfig(env: NodeJS.ProcessEnv = process.env): UpstreamConfig {
  assertNoPublicSecrets(env);
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
 * Un 401 de la API tampoco llega como 401 al navegador: quien no esta autorizado es este
 * servidor (BENEFITS_API_KEY mal configurada), no la persona que busca. Se responde 502.
 */
export async function upstreamGet<T>(
  path: string,
  { signal, config = upstreamConfig(), fetchImpl = fetch }: { signal?: AbortSignal; config?: UpstreamConfig; fetchImpl?: typeof fetch } = {},
): Promise<UpstreamResult<T | ReturnType<typeof errorBody>>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;

  const timeout = AbortSignal.timeout(config.timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const response = await fetchImpl(`${config.baseUrl}${path}`, { headers, signal: combined, cache: 'no-store' });
    if (response.status === 401) {
      // Solo el nombre de la variable, nunca su valor.
      console.error(`[bff] La API respondio 401 a ${path}: revisa que BENEFITS_API_KEY coincida con una llave de API_KEYS.`);
      return { status: 502, body: errorBody('UPSTREAM_UNAUTHORIZED', 'La web no esta autorizada en la API de beneficios') };
    }
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
