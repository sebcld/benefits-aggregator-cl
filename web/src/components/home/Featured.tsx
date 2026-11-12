'use client';

// "Destacados de hoy" (inicio movil). Solo se pide /api/destacados cuando la pantalla es movil;
// si falla, la seccion no se muestra (el inicio sigue siendo util sin ella).
import { useEffect, useState } from 'react';
import { BenefitCard } from '@/components/ui/BenefitCard';
import { LoadingCard } from '@/components/ui/LoadingCard';
import { listFeatured } from '@/lib/api/client';
import type { Benefit } from '@/lib/api/types';
import { MOBILE_QUERY, useMediaQuery } from '@/lib/use-media-query';

type State = { status: 'loading' } | { status: 'ok'; results: Benefit[] } | { status: 'error' };

export function Featured() {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!isMobile) return;
    const controller = new AbortController();
    listFeatured({ signal: controller.signal })
      .then(({ results }) => setState(results.length ? { status: 'ok', results } : { status: 'error' }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [isMobile]);

  if (!isMobile || state.status === 'error') return null;

  return (
    <section aria-labelledby="destacados-titulo" aria-busy={state.status === 'loading'} className="lg:hidden">
      <div className="flex flex-col gap-3.5 px-4 pt-2 pb-10">
        <h2 id="destacados-titulo" className="font-display text-20 font-semibold tracking-display text-fg">
          Destacados de hoy
        </h2>
        {state.status === 'loading' ? (
          <>
            <p className="sr-only" role="status">
              Cargando beneficios destacados
            </p>
            <LoadingCard />
            <LoadingCard />
          </>
        ) : (
          <ul className="flex flex-col gap-3.5">
            {state.results.map((benefit) => (
              <li key={benefit.id}>
                <BenefitCard benefit={benefit} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
