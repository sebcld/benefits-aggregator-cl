// Todos los beneficios, sin buscar (?banks= para filtrar por emisor). Reutiliza la pantalla de
// resultados en modo "all": mismos filtros, "Cargar más" y "Actualizar".
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingCard } from '@/components/ui/LoadingCard';
import { ResultsView } from '@/components/results/ResultsView';

export const metadata: Metadata = {
  title: 'Todos los beneficios',
  description: 'Todos los descuentos de bancos, tarjetas y billeteras de Chile en un solo lugar.',
};

function AllFallback() {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pt-6 lg:px-16 lg:pt-9" aria-busy="true">
      <div className="h-9 w-64 max-w-full rounded-md bg-subtle" />
      <div className="h-[52px] rounded-pill border border-line bg-surface lg:h-[60px]" />
      <LoadingCard />
    </div>
  );
}

export default function BeneficiosPage() {
  return (
    <Suspense fallback={<AllFallback />}>
      <ResultsView mode="all" />
    </Suspense>
  );
}
