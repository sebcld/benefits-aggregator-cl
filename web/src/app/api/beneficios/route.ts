// BFF de "todos los beneficios": GET /api/beneficios?banks=&page=&pageSize=&facets=1&refresh=true
// Reenvia a GET /v1/benefits (mismo contrato y mismos errores). Con facets=1 agrega el conteo por
// emisor, que aqui es simplemente el tamano de cada catalogo (sources[].count): sin filtro de
// emisores sale de la misma respuesta; con filtro, de una peticion extra sin filtro (pageSize=1).
import type { NextRequest } from 'next/server';
import type { BenefitsResponse, Facet, WebBenefitsResponse } from '@/lib/api/types';
import { facetsFromSources } from '@/lib/facets';
import { upstreamGet } from '@/lib/server/upstream';

const FORWARDED = ['banks', 'page', 'pageSize', 'refresh'] as const;
const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const name of FORWARDED) {
    const value = input.get(name);
    if (value) params.set(name, value);
  }

  const main = await upstreamGet<BenefitsResponse>(`/v1/benefits?${params}`, { signal: request.signal });
  if (main.status !== 200 || !('results' in main.body)) {
    return Response.json(main.body, { status: main.status === 200 ? 502 : main.status, headers: NO_STORE });
  }

  let facets: Facet[] | undefined;
  if (input.get('facets') === '1') {
    if (!params.get('banks')) {
      facets = facetsFromSources(main.body.sources);
    } else {
      // Despues de la principal: con refresh, asi se cuentan los catalogos recien descargados.
      const all = await upstreamGet<BenefitsResponse>('/v1/benefits?pageSize=1', { signal: request.signal });
      if (all.status === 200 && 'sources' in all.body) facets = facetsFromSources(all.body.sources);
    }
  }

  const body: WebBenefitsResponse = facets ? { ...main.body, facets } : main.body;
  return Response.json(body, { headers: NO_STORE });
}
