// Cliente del navegador. Habla solo con el BFF de la propia web (/api/*): la URL de la API y la
// API key (ADR 0014) viven en el servidor de Next y nunca llegan al navegador.
import { ApiError } from './errors';
import type { BanksResponse, FeaturedResponse, WebBenefitsResponse, WebSearchResponse } from './types';

/** La primera busqueda con la cache fria tarda 10-20 s; el BFF corta a los 65 s. */
export const CLIENT_TIMEOUT_MS = 70_000;

export interface SearchParams {
  query: string;
  banks?: string[];
  page?: number;
  pageSize?: number;
  /** Pide al BFF el conteo de coincidencias por emisor (para los filtros). */
  facets?: boolean;
  /** Vuelve a descargar los catalogos que ya tienen la antiguedad minima (boton "Actualizar"). */
  refresh?: boolean;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetch?: typeof fetch;
  baseUrl?: string;
}

/** AbortSignal.any no existe en todos los navegadores que soporta Next 16 (Chrome 111+). */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { signal, timeoutMs = CLIENT_TIMEOUT_MS, baseUrl = '' } = options;
  const doFetch = options.fetch ?? fetch;
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? anySignal([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await doFetch(`${baseUrl}${path}`, { signal: combined, headers: { accept: 'application/json' } });
  } catch (err) {
    if (signal?.aborted) throw new ApiError('ABORTED', 'La solicitud se canceló');
    if (timeout.aborted) throw new ApiError('TIMEOUT', 'La solicitud tardó demasiado');
    throw new ApiError('NETWORK_ERROR', err instanceof Error ? err.message : 'Error de red');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError('INVALID_RESPONSE', `Respuesta no JSON (HTTP ${response.status})`, response.status);
  }

  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string; details?: Record<string, unknown> } })?.error;
    throw new ApiError(
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `HTTP ${response.status}`,
      response.status,
      error?.details,
    );
  }
  return body as T;
}

export function buildSearchPath({ query, banks = [], page = 1, pageSize, facets, refresh }: SearchParams): string {
  const params = new URLSearchParams({ q: query });
  if (banks.length) params.set('banks', banks.join(','));
  if (page > 1) params.set('page', String(page));
  if (pageSize) params.set('pageSize', String(pageSize));
  if (facets) params.set('facets', '1');
  if (refresh) params.set('refresh', 'true');
  return `/api/search?${params}`;
}

export function searchBenefits(params: SearchParams, options?: RequestOptions): Promise<WebSearchResponse> {
  return request<WebSearchResponse>(buildSearchPath(params), options);
}

export type ListParams = Omit<SearchParams, 'query'>;

/** /api/beneficios: todos los beneficios, sin consulta. Mismos parametros que la busqueda, sin q. */
export function buildListPath({ banks = [], page = 1, pageSize, facets, refresh }: ListParams): string {
  const params = new URLSearchParams();
  if (banks.length) params.set('banks', banks.join(','));
  if (page > 1) params.set('page', String(page));
  if (pageSize) params.set('pageSize', String(pageSize));
  if (facets) params.set('facets', '1');
  if (refresh) params.set('refresh', 'true');
  const query = params.toString();
  return query ? `/api/beneficios?${query}` : '/api/beneficios';
}

export function listAllBenefits(params: ListParams, options?: RequestOptions): Promise<WebBenefitsResponse> {
  return request<WebBenefitsResponse>(buildListPath(params), options);
}

export function listBanks(options?: RequestOptions): Promise<BanksResponse> {
  return request<BanksResponse>('/api/banks', options);
}

export function listFeatured(options?: RequestOptions): Promise<FeaturedResponse> {
  return request<FeaturedResponse>('/api/destacados', options);
}
