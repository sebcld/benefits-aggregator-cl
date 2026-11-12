// BFF de busqueda: GET /api/search?q=&banks=&page=&pageSize=&facets=1
// Reenvia a GET /v1/search (mismo contrato y mismos errores) y, si se pide facets=1, agrega el
// conteo de coincidencias por emisor para los filtros.
import type { NextRequest } from 'next/server';
import type { SearchResponse, WebSearchResponse } from '@/lib/api/types';
import { countByBank, getBanks } from '@/lib/server/benefits';
import { errorBody, upstreamGet } from '@/lib/server/upstream';

const FORWARDED = ['q', 'banks', 'page', 'pageSize'] as const;
const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams;
  const query = input.get('q')?.trim() ?? '';
  if (!query) {
    return Response.json(errorBody('MISSING_QUERY', 'Falta la consulta de búsqueda ("q")'), { status: 400, headers: NO_STORE });
  }

  const params = new URLSearchParams();
  for (const name of FORWARDED) {
    const value = input.get(name);
    if (value) params.set(name, value);
  }

  const wantsFacets = input.get('facets') === '1';
  const [main, facets] = await Promise.all([
    upstreamGet<SearchResponse>(`/v1/search?${params}`, { signal: request.signal }),
    wantsFacets
      ? getBanks()
          .then((banks) => countByBank(query, banks, request.signal))
          .catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  if (main.status !== 200 || !('results' in main.body)) {
    return Response.json(main.body, { status: main.status === 200 ? 502 : main.status, headers: NO_STORE });
  }

  const body: WebSearchResponse = facets ? { ...main.body, facets } : main.body;
  return Response.json(body, { headers: NO_STORE });
}
