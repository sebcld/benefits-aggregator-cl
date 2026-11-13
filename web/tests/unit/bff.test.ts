// @vitest-environment node
// BFF: acceso a la API (/v1) desde el servidor y Route Handler /api/search.
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertNoPublicSecrets, publicSecretNames, upstreamConfig, upstreamGet } from '@/lib/server/upstream';

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

  it('rechaza una llave con prefijo NEXT_PUBLIC_ (Next la incrustaria en el navegador)', () => {
    const leaked = env({ BENEFITS_API_URL: 'http://api', NEXT_PUBLIC_BENEFITS_API_KEY: 'k' });
    expect(publicSecretNames(leaked)).toEqual(['NEXT_PUBLIC_BENEFITS_API_KEY']);
    expect(() => upstreamConfig(leaked)).toThrow(/NEXT_PUBLIC_BENEFITS_API_KEY.*BENEFITS_API_KEY \(sin NEXT_PUBLIC_\)/);
    expect(() => assertNoPublicSecrets(env({ NEXT_PUBLIC_API_TOKEN: 't' }))).toThrow();
    // Las variables publicas legitimas (y las vacias) no molestan.
    expect(() => assertNoPublicSecrets(env({ NEXT_PUBLIC_CONTACT_URL: 'https://x.cl', NEXT_PUBLIC_API_KEY: '' }))).not.toThrow();
  });
});

describe('upstreamGet', () => {
  const config = { baseUrl: 'http://api', apiKey: null, timeoutMs: 1000 };

  it('envia Authorization: Bearer <BENEFITS_API_KEY> en cada peticion si esta configurada (ADR 0014)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    await upstreamGet('/v1/banks', { config: { ...config, apiKey: 'secreta' }, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('http://api/v1/banks', expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer secreta' }) }));

    await upstreamGet('/v1/banks', { config, fetchImpl });
    const headers = (fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it('un 401 de la API llega al navegador como 502 UPSTREAM_UNAUTHORIZED (sin mostrar la llave)', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unauthorized = { error: { code: 'UNAUTHORIZED', message: 'Falta una API key valida' } };
    const res = await upstreamGet('/v1/search?q=x', { config: { ...config, apiKey: 'secreta' }, fetchImpl: async () => jsonResponse(unauthorized, 401) });
    expect(res).toMatchObject({ status: 502, body: { error: { code: 'UPSTREAM_UNAUTHORIZED' } } });
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('BENEFITS_API_KEY'));
    expect(logged.mock.calls.flat().join(' ')).not.toContain('secreta');
    logged.mockRestore();
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

  it('reenvia refresh=true y, con facets, cuenta DESPUES de actualizar (no lee catalogos viejos)', async () => {
    const { countByBank } = await import('@/lib/server/benefits');
    const order: string[] = [];
    vi.mocked(countByBank).mockImplementationOnce(async () => {
      order.push('facets');
      return [];
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      order.push('search');
      return jsonResponse(searchBody);
    });
    const { GET } = await import('@/app/api/search/route');
    await GET(new NextRequest('http://web/api/search?q=flixbus&facets=1&refresh=true'));
    expect(fetchSpy.mock.calls[0][0]).toBe('http://api/v1/search?q=flixbus&refresh=true');
    expect(order).toEqual(['search', 'facets']);
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

describe('GET /api/beneficios (todos, sin consulta)', () => {
  const sources = [
    { key: 'bci', bank: 'BCI', status: 'ok', count: 326, cached: true, durationMs: 1, fetchedAt: null },
    { key: 'tapp', bank: 'Tapp', status: 'error', count: 0, cached: false, durationMs: 1, fetchedAt: null },
  ];
  const listBody = {
    results: [],
    pagination: { page: 1, pageSize: 12, total: 326, totalPages: 28, hasMore: true },
    sources,
    errors: [],
    meta: { generatedAt: '2026-11-13T15:00:00.000Z', partial: true, refreshableAt: null },
  };

  beforeEach(() => {
    vi.stubEnv('BENEFITS_API_URL', 'http://api');
    vi.stubEnv('BENEFITS_API_KEY', '');
  });

  it('reenvia a /v1/benefits solo los parametros conocidos (no hay q)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(listBody));
    const { GET } = await import('@/app/api/beneficios/route');
    const res = await GET(new NextRequest('http://web/api/beneficios?banks=bci&page=2&pageSize=12&q=x&refresh=true'));
    expect(res.status).toBe(200);
    expect(fetchSpy.mock.calls[0][0]).toBe('http://api/v1/benefits?banks=bci&page=2&pageSize=12&refresh=true');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('sin filtro, los conteos salen de la misma respuesta (tamano de cada catalogo)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(listBody));
    const { GET } = await import('@/app/api/beneficios/route');
    const body = await (await GET(new NextRequest('http://web/api/beneficios?facets=1'))).json();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(body.facets).toEqual([
      { key: 'bci', bank: 'BCI', count: 326 },
      { key: 'tapp', bank: 'Tapp', count: null }, // fallo: sin conteo
    ]);
  });

  it('con filtro de emisores, los conteos de todos salen de una peticion extra sin filtro', async () => {
    // Una Response nueva por llamada: el cuerpo de una Response solo se puede leer una vez.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse(listBody));
    const { GET } = await import('@/app/api/beneficios/route');
    const body = await (await GET(new NextRequest('http://web/api/beneficios?banks=bci&facets=1'))).json();
    expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual(['http://api/v1/benefits?banks=bci', 'http://api/v1/benefits?pageSize=1']);
    expect(body.facets).toHaveLength(2);
  });
});
