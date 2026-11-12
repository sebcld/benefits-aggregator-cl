// Buscador (Escritorio 60px / Movil 52px). Formulario GET a /buscar: funciona sin JavaScript y,
// con JavaScript, next/form navega del lado del cliente.
import Form from 'next/form';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

export type SearchBoxSize = 'desktop' | 'mobile' | 'responsive';

const sizes: Record<SearchBoxSize, { box: string; input: string; button: string }> = {
  desktop: { box: 'h-[60px] pl-[22px] pr-2', input: 'text-17', button: 'size-11' },
  mobile: { box: 'h-[52px] pl-[18px] pr-1.5', input: 'text-15', button: 'size-10' },
  responsive: {
    box: 'h-[52px] pl-[18px] pr-1.5 lg:h-[60px] lg:pl-[22px] lg:pr-2',
    input: 'text-15 lg:text-17',
    button: 'size-10 lg:size-11',
  },
};

interface SearchBoxProps {
  size?: SearchBoxSize;
  defaultValue?: string;
  autoFocus?: boolean;
  className?: string;
  /** id del input (para que el label sea unico si hay mas de un buscador en la pagina). */
  id?: string;
}

export function SearchBox({ size = 'responsive', defaultValue, autoFocus, className, id = 'buscar' }: SearchBoxProps) {
  const s = sizes[size];
  return (
    <Form action="/buscar" role="search" className={cn('w-full', className)}>
      <div
        className={cn(
          'flex w-full items-center gap-3 rounded-pill border border-line bg-surface shadow-card',
          'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand',
          s.box,
        )}
      >
        <Icon name="search" className="shrink-0 text-fg-muted" />
        <label htmlFor={id} className="sr-only">
          Busca un comercio o marca
        </label>
        <input
          id={id}
          name="q"
          type="search"
          required
          maxLength={100}
          autoComplete="off"
          enterKeyHint="search"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          placeholder="Busca un comercio o marca"
          className={cn(
            'min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-muted focus-visible:outline-none',
            '[&::-webkit-search-cancel-button]:hidden',
            s.input,
          )}
        />
        <button
          type="submit"
          aria-label="Buscar"
          className={cn(
            'grid shrink-0 place-items-center rounded-pill bg-brand text-on-brand transition-opacity hover:opacity-90',
            s.button,
          )}
        >
          <Icon name="arrow" />
        </button>
      </div>
    </Form>
  );
}
