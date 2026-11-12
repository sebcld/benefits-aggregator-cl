// @vitest-environment node
// BFF: acceso a la API (/v1) desde el servidor y Route Handler /api/search.
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { upstreamConfig, upstreamGet } from '@/lib/server/upstream';

vi.mock('@/lib/server/benefits', () => ({
  getBanks: vi.fn(async () => [
    { key: 'bci', name: 'BCI', searchMode: 'catalog' },
    { key: 'copec', name: 'Copec Pay', searchMode: 'catalog' },
  ]),
  countByBank: vi.fn(async () => [
    { key: 'bci', bank: 'BCI', count: 3 },
    { key: 'copec', bank: 'Copec Pay', count: 0 },
  ]),
}));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe('upstreamConfig', () => {
  it('lee la URL, la API key y el timeout del entorno del servidor', () => {
    expect(upstreamConfig(env({ BENEFITS_API_URL: 'https://api.example.cl/', BENEFITS_API_KEY: ' k ' }))).toEqual({
      baseUrl: 'https://api.example.cl',
      apiKey: 'k',
      timeoutMs: 65_000,
    });
    expect(upstreamConfig(env({}))).toMatchObject({ baseUrl: 'http://localhost:3000', apiKey: null });
  });
});

describe('upstreamGet', () => {
  const config = { baseUrl: 'http://api', apiKey: null, timeoutMs: 1000 };

  it('envia x-api-key solo si esta configurada (ADR 0014), nunca al navegador', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    await upstreamGet('/v1/banks', { config: { ...config, apiKey: 'secreta' }, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('http://api/v1/banks', expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'secreta' }) }));

    await upstreamGet('/v1/banks', { config, fetchImpl });
    const headers = (fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('pasa el status y el cuerpo de la API tal cual', async () => {
    const body = { error: { code: 'MISSING_QUERY', message: 'Falta' } };
    await expect(upstreamGet('/v1/search', { config, fetchImpl: async () => jsonResponse(body, 400) })).resolves.toEqual({ status: 400, body });
  });

  it('sin conexion responde 502 UPSTREAM_UNAVAILABLE (no lanza)', async () => {
    const res = await upstreamGet('/v1/search', { config, fetchImpl: async () => Promise.reject(new TypeError('ECONNREFUSED')) });
    expect(res).toMatchObject({ status: 502, body: { error: { code: 'UPSTREAM_UNAVAILABLE' } } });
  });

  it('si la API tarda demasiado responde 504 UPSTREAM_TIMEOUT', async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
    const res = await upstreamGet('/v1/search', { config: { ...config, timeoutMs: 20 }, fetchImpl: hang });
    expect(res).toMatchObject({ status: 504, body: { error: { code: 'UPSTREAM_TIMEOUT' } } });
  });
});

describe('GET /api/search', () => {
  const searchBody = {
    query: 'rappi',
    results: [],
    pagination: { page: 1, pageSize: 12, total: 3, totalPages: 1, hasMore: false },
    sources: [],
    errors: [],
    meta: { generatedAt: '2026-11-12T15:00:00.000Z', partial: false },
  };

  beforeEach(() => {
    vi.stubEnv('BENEFITS_API_URL', 'http://api');
    vi.stubEnv('BENEFITS_API_KEY', '');
  });

  it('sin q responde 400 con el formato de error de /v1 (sin llamar a la API)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { GET } = await import('@/app/api/search/route');
    const res = await GET(new NextRequest('http://web/api/search?q=%20'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: 'MISSING_QUERY', message: expect.any(String) } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reenvia solo los parametros conocidos a /v1/search', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(searchBody));
    const { GET } = await import('@/app/api/search/route');
    const res = await GET(new NextRequest('http://web/api/search?q=rappi&banks=bci&page=2&pageSize=12&evil=1'));
    expect(res.status).toBe(200);
    expect(fetchSpy.mock.calls[0][0]).toBe('http://api/v1/search?q=rappi&banks=bci&page=2&pageSize=12');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).not.toHaveProperty('facets');
  });

  it('con facets=1 agrega el conteo por emisor', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(searchBody));
    const { GET } = await import('@/app/api/search/route');
    const res = await GET(new NextRequest('http://web/api/search?q=rappi&facets=1'));
    const body = await res.json();
    expect(body.facets).toEqual([
      { key: 'bci', bank: 'BCI', count: 3 },
      { key: 'copec', bank: 'Copec Pay', count: 0 },
    ]);
  });

  it('propaga los errores de validacion de la API con su status', async () => {
    const error = { error: { code: 'QUERY_TOO_LONG', message: 'Muy larga' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(error, 400));
    const { GET } = await import('@/app/api/search/route');
    const res = await GET(new NextRequest('http://web/api/search?q=xxx'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(error);
  });
});
