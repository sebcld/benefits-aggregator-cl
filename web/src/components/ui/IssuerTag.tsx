// Etiqueta de emisor: circulo de 16px con el color del emisor + nombre.
import { cn } from '@/lib/cn';
import { issuerStyle } from '@/lib/issuers';

export function IssuerDot({ issuerKey, className }: { issuerKey: string; className?: string }) {
  return <span aria-hidden="true" style={issuerStyle(issuerKey)} className={cn('size-4 shrink-0 rounded-full bg-issuer', className)} />;
}

export function IssuerTag({ issuerKey, name, className }: { issuerKey: string; name: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-12 font-semibold text-fg-muted', className)}>
      <IssuerDot issuerKey={issuerKey} />
      {name}
    </span>
  );
}
