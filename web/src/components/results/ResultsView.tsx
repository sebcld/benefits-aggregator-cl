'use client';

// Pantalla de resultados. El estado vive en la URL (?q=&banks=), asi se puede compartir y
// el boton "atras" funciona.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { SUGGESTIONS } from '@/components/home/Hero';
import { BenefitCard } from '@/components/ui/BenefitCard';
import { ChipLink } from '@/components/ui/Chip';
import { LoadingCard } from '@/components/ui/LoadingCard';
import { Notice, NoticeAction } from '@/components/ui/Notice';
import { PillButton } from '@/components/ui/PillButton';
import { SearchBox } from '@/components/ui/SearchBox';
import { userMessage } from '@/lib/api/errors';
import type { SearchError } from '@/lib/api/types';
import { parseBanksParam } from '@/lib/filters';
import { DataFreshness } from './DataFreshness';
import { IssuerFilterChips, IssuerFilterPanel } from './IssuerFilters';
import { useBanks } from './use-banks';
import { useSearch } from './use-search';

/** "BCI", "BCI y Tenpo", "BCI, Tenpo y Tapp". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export function partialMessage(errors: SearchError[]): string {
  return `No pudimos consultar ${joinNames(errors.map((e) => e.bank))} en este momento. Mostramos los demás resultados.`;
}

export function summaryText(shown: number, total: number, query: string): string {
  const noun = total === 1 ? 'beneficio' : 'beneficios';
  return `Mostrando ${shown} de ${total} ${noun} para «${query}»`;
}

function Suggestions({ label }: { label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((term) => (
          <li key={term}>
            <ChipLink href={{ pathname: '/buscar', query: { q: term } }}>{term}</ChipLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ResultsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = (params.get('q') ?? '').trim();
  const selected = parseBanksParam(params.get('banks'));

  const banks = useBanks();
  const search = useSearch(query, selected);
  const { status, data } = search;

  const setSelected = useCallback(
    (next: string[]) => {
      const nextParams = new URLSearchParams(params);
      if (next.length) nextParams.set('banks', next.join(','));
      else nextParams.delete('banks');
      router.replace(`${pathname}?${nextParams}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const filters = banks && banks.length > 0 && query ? { banks, facets: search.facets, selected, onChange: setSelected } : null;
  const shown = data?.results.length ?? 0;

  return (
    <div className="mx-auto max-w-[1440px]">
      <h1 className="sr-only">{query ? `Beneficios para «${query}»` : 'Buscar beneficios'}</h1>

      <div className="px-4 pt-4 lg:px-16 lg:pt-7">
        {/* key: al cambiar la consulta desde la URL, el input muestra el valor nuevo. */}
        <SearchBox key={query} defaultValue={query} autoFocus={!query} id="buscar-resultados" />
      </div>

      <div className="flex flex-col gap-3.5 px-4 pt-3.5 pb-10 lg:flex-row lg:items-start lg:gap-6 lg:px-16 lg:pt-6 lg:pb-14">
        {filters && (
          <>
            <aside className="hidden w-[260px] shrink-0 lg:sticky lg:top-[101px] lg:block" aria-label="Filtros">
              <IssuerFilterPanel {...filters} />
            </aside>
            <div className="lg:hidden">
              <IssuerFilterChips {...filters} />
            </div>
          </>
        )}

        <section aria-label="Resultados" aria-busy={status === 'loading'} className="flex min-w-0 flex-1 flex-col gap-3.5 lg:gap-4">
          {status === 'idle' && (
            <div className="flex flex-col gap-4 py-6">
              <p className="font-display text-20 font-semibold tracking-display text-fg">Escribe un comercio o marca para buscar.</p>
              <Suggestions label="Búsquedas sugeridas" />
            </div>
          )}

          {status === 'loading' && (
            <>
              <p role="status" className="text-13 font-medium text-fg-muted lg:text-14">
                {search.slow
                  ? 'Consultando bancos y billeteras… la primera búsqueda puede tardar hasta 20 segundos.'
                  : `Buscando beneficios para «${query}»…`}
              </p>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:gap-5">
                {Array.from({ length: 4 }, (_, i) => (
                  <LoadingCard key={i} className={i >= 2 ? 'hidden md:flex' : undefined} />
                ))}
              </div>
            </>
          )}

          {status === 'error' && (
            <Notice type="error" action={<NoticeAction onClick={search.retry}>Reintentar</NoticeAction>}>
              {userMessage(search.error)}
            </Notice>
          )}

          {status === 'success' && data && (
            <>
              <div className="flex items-center justify-between gap-4">
                <p role="status" className="text-13 font-medium text-fg-muted lg:text-14">
                  {summaryText(shown, data.pagination.total, query)}
                </p>
                <p className="hidden text-13 font-medium text-fg-muted lg:block">Ordenado por emisor</p>
              </div>

              {data.freshness && (
                <DataFreshness freshness={data.freshness} refreshing={search.refreshing} onRefresh={search.refresh} />
              )}

              {search.refreshError && (
                <Notice type="error" action={<NoticeAction onClick={search.refresh}>Reintentar</NoticeAction>}>
                  No pudimos actualizar los catálogos. Seguimos mostrando los datos anteriores.
                </Notice>
              )}

              {data.errors.length > 0 && <Notice type="partial">{partialMessage(data.errors)}</Notice>}

              {shown === 0 ? (
                <div className="flex flex-col gap-4 py-6">
                  <p className="font-display text-20 font-semibold tracking-display text-fg">No encontramos beneficios para «{query}».</p>
                  <p className="text-15 text-fg-muted">
                    {selected.length > 0 ? 'Prueba con todos los emisores o con otro comercio.' : 'Prueba con otro comercio o marca.'}
                  </p>
                  {selected.length > 0 && (
                    <div>
                      <PillButton onClick={() => setSelected([])}>Ver todos los emisores</PillButton>
                    </div>
                  )}
                  <Suggestions label="Otras búsquedas" />
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:gap-5">
                  {data.results.map((benefit) => (
                    <li key={benefit.id} className="flex">
                      <BenefitCard benefit={benefit} headingLevel="h2" className="w-full" />
                    </li>
                  ))}
                  {search.loadingMore &&
                    Array.from({ length: 2 }, (_, i) => (
                      <li key={`cargando-${i}`} className="flex">
                        <LoadingCard className="w-full" />
                      </li>
                    ))}
                </ul>
              )}

              {search.loadMoreError && (
                <Notice type="error" action={<NoticeAction onClick={search.loadMore}>Reintentar</NoticeAction>}>
                  {userMessage(search.loadMoreError)}
                </Notice>
              )}

              {data.pagination.hasMore && (
                <div>
                  <PillButton onClick={search.loadMore} disabled={search.loadingMore} aria-busy={search.loadingMore}>
                    {search.loadingMore ? 'Cargando…' : 'Cargar más'}
                  </PillButton>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
