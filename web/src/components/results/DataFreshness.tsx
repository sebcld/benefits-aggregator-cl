'use client';

// "Datos actualizados hace 1 h 30 min · Actualizar": antiguedad de los catalogos de la busqueda y
// boton para volver a descargarlos (refresh=true). El boton queda deshabilitado mientras los
// catalogos son mas nuevos que la antiguedad minima del servidor (CACHE_REFRESH_MIN_AGE_SECONDS).
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { ageMs, canRefresh, formatAge, minutesUntilRefresh, type Freshness } from '@/lib/freshness';
import { useNow } from '@/lib/use-now';

interface DataFreshnessProps {
  freshness: Freshness;
  refreshing: boolean;
  onRefresh: () => void;
  className?: string;
}

const HINT_ID = 'actualizar-catalogos-ayuda';

export function DataFreshness({ freshness, refreshing, onRefresh, className }: DataFreshnessProps) {
  // Antes de hidratar se usa la hora de llegada de la respuesta.
  const now = useNow() ?? freshness.receivedAt;
  const enabled = canRefresh(freshness, now) && !refreshing;
  const waiting = !refreshing && !canRefresh(freshness, now);

  return (
    <div
      data-testid="data-freshness"
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 text-13 text-fg-muted', className)}
    >
      <p aria-live="polite">
        {refreshing
          ? 'Actualizando los catálogos… puede tardar hasta 20 segundos.'
          : `Datos actualizados ${formatAge(ageMs(freshness, now))}`}
      </p>
      <button
        type="button"
        onClick={onRefresh}
        disabled={!enabled}
        aria-busy={refreshing}
        aria-describedby={waiting ? HINT_ID : undefined}
        className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1 font-semibold text-fg transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name="refresh" size={14} className={refreshing ? 'motion-safe:animate-spin' : undefined} />
        {refreshing ? 'Actualizando…' : 'Actualizar'}
      </button>
      {waiting && (
        <span id={HINT_ID} className="text-12">
          Podrás volver a actualizar en {minutesUntilRefresh(freshness, now)} min
        </span>
      )}
    </div>
  );
}
