// Aviso (Parcial / Error). Parcial = status (no interrumpe); Error = alert, con accion opcional.
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

export type NoticeType = 'partial' | 'error';

const styles: Record<NoticeType, string> = {
  partial: 'bg-warn-bg text-warn-fg',
  error: 'bg-danger-bg text-danger',
};

interface NoticeProps {
  type: NoticeType;
  children: ReactNode;
  /** Por ejemplo, el boton "Reintentar". */
  action?: ReactNode;
  className?: string;
}

export function Notice({ type, children, action, className }: NoticeProps) {
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-start gap-3 rounded-md px-4 py-3', styles[type], className)}
    >
      <Icon name="alert" className="shrink-0" />
      <p className="min-w-0 flex-1 pt-px text-13 leading-[18px]">{children}</p>
      {action}
    </div>
  );
}

/** Boton de accion dentro de un aviso (hereda el color del aviso). */
export function NoticeAction({ children, ...rest }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className="ml-auto shrink-0 rounded-pill border border-current px-3 py-1 text-13 font-semibold"
      {...rest}
    >
      {children}
    </button>
  );
}
