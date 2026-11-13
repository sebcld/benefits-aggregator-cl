import { describe, expect, it, vi } from 'vitest';
import { buildSearchPath, listBanks, searchBenefits } from '@/lib/api/client';
import { ApiError, userMessage } from '@/lib/api/errors';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const OK_BODY = {
  query: 'rappi',
  results: [],
  pagination: { page: 1, pageSize: 12, total: 0, totalPages: 1, hasMore: false },
  sources: [],
  errors: [],
  meta: { generatedAt: '2026-11-12T15:00:00.000Z', partial: false },
};

describe('buildSearchPath', () => {
  it('va al BFF de la propia web, nunca a la API directa', () => {
    expect(buildSearchPath({ query: 'rappi' })).toBe('/api/search?q=rappi');
  });

  it('incluye emisores, pagina, tamano y facets solo si hacen falta', () => {
    expect(buildSearchPath({ query: 'el café', banks: ['bci', 'copec'], page: 2, pageSize: 12, facets: true })).toBe(
      '/api/search?q=el+caf%C3%A9&banks=bci%2Ccopec&page=2&pageSize=12&facets=1',
    );
    expect(buildSearchPath({ query: 'x', page: 1, banks: [] })).toBe('/api/search?q=x');
  });

  it('refresh agrega refresh=true (boton "Actualizar")', () => {
    expect(buildSearchPath({ query: 'flixbus', refresh: true })).toBe('/api/search?q=flixbus&refresh=true');
    expect(buildSearchPath({ query: 'flixbus', refresh: false })).toBe('/api/search?q=flixbus');
  });
});

describe('searchBenefits', () => {
  it('devuelve el cuerpo de /api/search', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(OK_BODY));
    const res = await searchBenefits({ query: 'rappi' }, { fetch: fetchMock });
    expect(res.query).toBe('rappi');
    expect(fetchMock).toHaveBeenCalledWith('/api/search?q=rappi', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('convierte el error uniforme de la API en ApiError con code y status', async () => {
    const body = { error: { code: 'UNKNOWN_BANK', message: 'Emisor desconocido: nope', details: { unknown: ['nope'] } } };
    const error = await searchBenefits({ query: 'x', banks: ['nope'] }, { fetch: async () => jsonResponse(body, 400) }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'UNKNOWN_BANK', status: 400, details: { unknown: ['nope'] } });
    expect(error.retryable).toBe(false);
    expect(userMessage(error)).toMatch(/emisores seleccionados/);
  });

  it('un 5xx sin cuerpo JSON es INVALID_RESPONSE y se puede reintentar', async () => {
    const error = await searchBenefits({ query: 'x' }, { fetch: async () => new Response('<html>', { status: 502 }) }).catch((e) => e);
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
    expect(error.retryable).toBe(true);
  });

  it('una falla de red es NETWORK_ERROR', async () => {
    const error = await searchBenefits({ query: 'x' }, { fetch: async () => Promise.reject(new TypeError('Failed to fetch')) }).catch((e) => e);
    expect(error).toMatchObject({ code: 'NETWORK_ERROR', status: null });
    expect(userMessage(error)).toMatch(/Revisa tu conexión/);
  });

  it('corta por timeout con TIMEOUT', async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
    const error = await searchBenefits({ query: 'x' }, { fetch: hang, timeoutMs: 20 }).catch((e) => e);
    expect(error).toMatchObject({ code: 'TIMEOUT' });
  });

  it('una cancelacion del llamador es ABORTED (no se muestra como error)', async () => {
    const controller = new AbortController();
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
    const promise = searchBenefits({ query: 'x' }, { fetch: hang, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'ABORTED' });
  });
});

describe('listBanks', () => {
  it('pide /api/banks', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ banks: [{ key: 'bci', name: 'BCI', searchMode: 'catalog' }] }));
    const res = await listBanks({ fetch: fetchMock });
    expect(res.banks[0].key).toBe('bci');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/banks');
  });
});
