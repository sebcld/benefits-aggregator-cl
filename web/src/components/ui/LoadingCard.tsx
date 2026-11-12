// Tarjeta cargando: skeleton con barrido (shimmer). Decorativa: el estado de carga se anuncia
// en el contenedor (aria-busy + texto para lectores de pantalla), no en cada tarjeta.
import { cn } from '@/lib/cn';

const bar = 'bg-subtle';

export function LoadingCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-testid="loading-card"
      className={cn('shimmer flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-4', className)}
    >
      <div className="flex items-center gap-3">
        <div className={cn(bar, 'size-12 shrink-0 rounded-[12px]')} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className={cn(bar, 'h-3.5 w-[140px] max-w-full rounded-[7px]')} />
          <div className={cn(bar, 'h-2.5 w-[90px] max-w-full rounded-[5px]')} />
        </div>
        <div className={cn(bar, 'h-[30px] w-20 shrink-0 rounded-pill')} />
      </div>
      <div className={cn(bar, 'h-3 w-full rounded-[6px]')} />
      <div className={cn(bar, 'h-3 w-[220px] max-w-[68%] rounded-[6px]')} />
      <div className={cn(bar, 'h-6 w-[150px] rounded-pill')} />
    </div>
  );
}
