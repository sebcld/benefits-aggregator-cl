'use client';

// Estado de una busqueda: primera pagina, "Cargar más", reintento y conteo por emisor (facets).
// La carga se deriva de la clave de la peticion (sin setState sincrono dentro del efecto).
import { useCallback, useEffect, useRef, useState } from 'react';
import { searchBenefits } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { Benefit, Facet, Pagination, SearchError, WebSearchResponse } from '@/lib/api/types';

export const PAGE_SIZE = 12;
/** Desde cuanto se avisa que la primera busqueda (cache fria) puede tardar. */
export const SLOW_AFTER_MS = 4000;

interface Data {
  results: Benefit[];
  pagination: Pagination;
  errors: SearchError[];
  partial: boolean;
}

interface Settled {
  key: string;
  data: Data | null;
  error: ApiError | null;
}

export interface SearchState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: Data | null;
  error: ApiError | null;
  /** Conteo por emisor de la consulta actual (no cambia al filtrar). */
  facets: Facet[] | null;
  slow: boolean;
  loadingMore: boolean;
  loadMoreError: ApiError | null;
  loadMore: () => void;
  retry: () => void;
}

const toApiError = (err: unknown) =>
  err instanceof ApiError ? err : new ApiError('NETWORK_ERROR', err instanceof Error ? err.message : 'Error desconocido');

function mergeErrors(a: SearchError[], b: SearchError[]): SearchError[] {
  const seen = new Set(a.map((e) => e.key));
  return [...a, ...b.filter((e) => !seen.has(e.key))];
}

function toData(res: WebSearchResponse): Data {
  return { results: res.results, pagination: res.pagination, errors: res.errors, partial: res.meta.partial };
}

export function useSearch(query: string, banks: string[]): SearchState {
  const banksKey = banks.join(',');
  const [attempt, setAttempt] = useState(0);
  const key = `${query}|${banksKey}|${attempt}`;

  const [settled, setSettled] = useState<Settled | null>(null);
  const [facets, setFacets] = useState<{ query: string; items: Facet[] } | null>(null);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const [more, setMore] = useState<{ key: string; loading: boolean; error: ApiError | null }>({ key: '', loading: false, error: null });

  // Consulta para la que ya hay conteos: al filtrar no se vuelven a pedir.
  const facetsQuery = useRef<string | null>(null);
  const moreController = useRef<AbortController | null>(null);

  useEffect(() => {
    facetsQuery.current = facets?.query ?? null;
  }, [facets]);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const wantsFacets = facetsQuery.current !== query;
    const slowTimer = setTimeout(() => setSlowKey(key), SLOW_AFTER_MS);

    searchBenefits(
      { query, banks: banksKey ? banksKey.split(',') : [], pageSize: PAGE_SIZE, facets: wantsFacets },
      { signal: controller.signal },
    )
      .then((res) => {
        setSettled({ key, data: toData(res), error: null });
        if (res.facets) setFacets({ query, items: res.facets });
      })
      .catch((err) => {
        if (!controller.signal.aborted) setSettled({ key, data: null, error: toApiError(err) });
      })
      .finally(() => clearTimeout(slowTimer));

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
      moreController.current?.abort();
    };
  }, [query, banksKey, key]);

  const current = settled?.key === key ? settled : null;
  const data = current?.data ?? null;

  const loadMore = useCallback(() => {
    if (!data || !data.pagination.hasMore || (more.key === key && more.loading)) return;
    const controller = new AbortController();
    moreController.current = controller;
    setMore({ key, loading: true, error: null });
    searchBenefits(
      { query, banks: banksKey ? banksKey.split(',') : [], page: data.pagination.page + 1, pageSize: PAGE_SIZE },
      { signal: controller.signal },
    )
      .then((res) => {
        setSettled((prev) => {
          if (!prev || prev.key !== key || !prev.data) return prev;
          const ids = new Set(prev.data.results.map((r) => r.id));
          return {
            ...prev,
            data: {
              results: [...prev.data.results, ...res.results.filter((r) => !ids.has(r.id))],
              pagination: res.pagination,
              errors: mergeErrors(prev.data.errors, res.errors),
              partial: prev.data.partial || res.meta.partial,
            },
          };
        });
        setMore({ key, loading: false, error: null });
      })
      .catch((err) => {
        if (!controller.signal.aborted) setMore({ key, loading: false, error: toApiError(err) });
      });
  }, [data, more, key, query, banksKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const status: SearchState['status'] = !query ? 'idle' : !current ? 'loading' : current.error ? 'error' : 'success';
  const moreState = more.key === key ? more : { loading: false, error: null };

  return {
    status,
    data,
    error: current?.error ?? null,
    facets: facets?.query === query ? facets.items : null,
    slow: status === 'loading' && slowKey === key,
    loadingMore: moreState.loading,
    loadMoreError: moreState.error,
    loadMore,
    retry,
  };
}
