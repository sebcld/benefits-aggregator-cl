// Chip (Normal / Activo). Como enlace (sugerencias) o como boton de alternar (filtros moviles).
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const base =
  'inline-flex h-9 shrink-0 items-center rounded-pill border px-3.5 text-14 font-semibold whitespace-nowrap transition-colors';
const variants = {
  normal: 'border-line bg-surface text-fg hover:bg-subtle',
  active: 'border-brand bg-brand text-on-brand',
};

export function chipClass(active = false, className?: string) {
  return cn(base, active ? variants.active : variants.normal, className);
}

interface ChipButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  active?: boolean;
  children: ReactNode;
}

/** Chip que alterna un filtro: expone su estado con aria-pressed. */
export function ChipButton({ active = false, className, children, ...rest }: ChipButtonProps) {
  return (
    <button type="button" aria-pressed={active} className={chipClass(active, className)} {...rest}>
      {children}
    </button>
  );
}

interface ChipLinkProps extends Omit<ComponentProps<typeof Link>, 'children'> {
  active?: boolean;
  children: ReactNode;
}

export function ChipLink({ active = false, className, children, ...rest }: ChipLinkProps) {
  return (
    <Link className={chipClass(active, className)} {...rest}>
      {children}
    </Link>
  );
}
