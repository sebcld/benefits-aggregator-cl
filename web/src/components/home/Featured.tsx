'use client';

// "Destacados de hoy": una lista en movil y una grilla en escritorio (2 columnas en tablet, 3 en
// escritorio). Los datos vienen de /api/destacados, que el servidor guarda 2 horas, asi que
// mostrarlos tambien en escritorio no suma consultas a las fuentes. Si fallan, la seccion no se
// muestra: el inicio sigue siendo util sin ella.
import { useEffect, useState } from 'react';
import { BenefitCard } from '@/components/ui/BenefitCard';
import { LoadingCard } from '@/components/ui/LoadingCard';
import { listFeatured } from '@/lib/api/client';
import type { Benefit } from '@/lib/api/types';
import { cn } from '@/lib/cn';

type State = { status: 'loading' } | { status: 'ok'; results: Benefit[] } | { status: 'error' };

/** En escritorio se muestran filas completas de 3: con 10 destacados, el decimo queda fuera. */
export const DESKTOP_COLUMNS = 3;

// Mismo ritmo que la grilla de resultados: 1 columna en movil, 2 en tablet, 3 en escritorio.
const GRID = 'grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3 lg:gap-5';

export function Featured() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    listFeatured({ signal: controller.signal })
      .then(({ results }) => setState(results.length ? { status: 'ok', results } : { status: 'error' }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, []);

  if (state.status === 'error') return null;

  // Cuantos caben en filas completas (10 -> 9). Con menos de una fila se muestran todos.
  const fullRows = state.status === 'ok' ? Math.floor(state.results.length / DESKTOP_COLUMNS) * DESKTOP_COLUMNS : 0;
  const hiddenOnDesktop = (i: number) => fullRows > 0 && i >= fullRows;

  return (
    <section id="destacados" aria-labelledby="destacados-titulo" aria-busy={state.status === 'loading'}>
      <div className="flex flex-col gap-3.5 px-4 pt-2 pb-10 lg:gap-5 lg:px-16 lg:pt-6">
        <h2 id="destacados-titulo" className="font-display text-20 font-semibold tracking-display text-fg lg:text-24">
          Destacados de hoy
        </h2>
        {state.status === 'loading' ? (
          <>
            <p className="sr-only" role="status">
              Cargando beneficios destacados
            </p>
            <div className={GRID}>
              {Array.from({ length: DESKTOP_COLUMNS }, (_, i) => (
                // Movil: 2 esqueletos (como antes); tablet: 2; escritorio: una fila de 3.
                <LoadingCard key={i} className={i === 2 ? 'hidden lg:flex' : undefined} />
              ))}
            </div>
          </>
        ) : (
          <ul className={GRID}>
            {state.results.map((benefit, i) => (
              // Si sobra una fila incompleta en escritorio, esos destacados se ven solo en movil y tablet.
              <li key={benefit.id} className={cn('flex', hiddenOnDesktop(i) && 'lg:hidden')}>
                <BenefitCard benefit={benefit} className="w-full" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
