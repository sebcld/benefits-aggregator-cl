// Boton pildora secundario ("Cargar más").
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function PillButton({ className, type = 'button', ...rest }: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-pill border border-line bg-surface px-[22px] py-3 text-14 font-semibold text-fg transition-colors hover:bg-subtle disabled:cursor-progress disabled:opacity-60',
        className,
      )}
      {...rest}
    />
  );
}
