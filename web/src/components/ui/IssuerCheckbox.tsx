// Fila del panel de filtros: checkbox nativo (accesible) con caja propia, circulo, nombre y conteo.
// Un emisor con 0 coincidencias queda deshabilitado y atenuado, como en el diseno.
import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import { IssuerDot } from './IssuerTag';

interface IssuerCheckboxProps {
  issuerKey: string;
  name: string;
  /** null = desconocido (aun cargando o el emisor fallo). */
  count: number | null;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function IssuerCheckbox({ issuerKey, name, count, checked, onChange }: IssuerCheckboxProps) {
  const empty = count === 0;
  const id = `filtro-${issuerKey}`;
  const countLabel = count === null ? '' : `, ${count} ${count === 1 ? 'beneficio' : 'beneficios'}`;
  return (
    <div className="flex items-center gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked && !empty}
        disabled={empty}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={`${name}${countLabel}`}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={cn(
          'flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-sm',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand',
          empty && 'cursor-not-allowed',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-[18px] shrink-0 place-items-center rounded-[6px]',
            checked && !empty ? 'bg-brand text-on-brand' : 'border-[1.5px] border-line',
          )}
        >
          {checked && !empty && <Icon name="tick" size={18} strokeWidth={2} />}
        </span>
        <IssuerDot issuerKey={issuerKey} className={cn(empty && 'opacity-40')} />
        <span aria-hidden="true" className={cn('min-w-0 flex-1 truncate text-14 font-medium', empty ? 'text-fg-muted' : 'text-fg')}>
          {name}
        </span>
        <span aria-hidden="true" className="text-12 text-fg-muted tabular-nums">
          {count ?? '–'}
        </span>
      </label>
    </div>
  );
}
