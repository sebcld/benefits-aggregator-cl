// Pildora de "Fuentes que consultamos": circulo del emisor + nombre.
import { IssuerTag } from './IssuerTag';

export function SourcePill({ issuerKey, name }: { issuerKey: string; name: string }) {
  return (
    <span className="inline-flex h-7 items-center rounded-pill border border-line bg-surface py-[5px] pr-3 pl-2">
      <IssuerTag issuerKey={issuerKey} name={name} />
    </span>
  );
}
