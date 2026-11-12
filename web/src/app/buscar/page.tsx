// Resultados. La vista lee la URL en el cliente (useSearchParams), dentro de un Suspense para que
// el resto de la pagina se pueda prerenderizar.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingCard } from '@/components/ui/LoadingCard';
import { ResultsView } from '@/components/results/ResultsView';

export const metadata: Metadata = { title: 'Buscar beneficios' };

function ResultsFallback() {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pt-4 lg:px-16 lg:pt-7" aria-busy="true">
      <div className="h-[52px] rounded-pill border border-line bg-surface lg:h-[60px]" />
      <LoadingCard />
    </div>
  );
}

export default function BuscarPage() {
  return (
    <Suspense fallback={<ResultsFallback />}>
      <ResultsView />
    </Suspense>
  );
}
