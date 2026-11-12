// Tipos del contrato HTTP. schema.d.ts se genera desde docs/openapi.yaml (npm run api:types):
// si la API cambia, se regenera y TypeScript marca todo lo que hay que ajustar.
import type { components } from './schema';

type Schemas = components['schemas'];

export type Benefit = Schemas['Benefit'];
export type Pagination = Schemas['Pagination'];
export type SourceStatus = Schemas['SourceStatus'];
export type SearchError = Schemas['SearchError'];
export type SearchResponse = Schemas['SearchResponse'];
export type Bank = Schemas['BanksResponse']['banks'][number];
export type BanksResponse = Schemas['BanksResponse'];
export type ApiErrorBody = Schemas['ErrorResponse'];

/** Conteo de coincidencias por emisor para la consulta (lo agrega el BFF, no la API /v1). */
export interface Facet {
  key: string;
  bank: string;
  /** null si no se pudo contar (el emisor fallo). */
  count: number | null;
}

/** Respuesta de GET /api/search: la de /v1/search mas los conteos por emisor, si se pidieron. */
export interface WebSearchResponse extends SearchResponse {
  facets?: Facet[];
}

export interface FeaturedResponse {
  results: Benefit[];
}
