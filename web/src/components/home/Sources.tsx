// Fila "Fuentes que consultamos".
import { SourcePill } from '@/components/ui/SourcePill';
import { FEATURED_SOURCES } from '@/lib/issuers';

export function Sources({ className }: { className?: string }) {
  return (
    <section id="fuentes" aria-labelledby="fuentes-titulo" className={className}>
      <div className="flex flex-wrap items-center justify-center gap-4 px-4 pt-2 pb-14 lg:px-16">
        <h2 id="fuentes-titulo" className="text-13 font-medium text-fg-muted">
          Fuentes que consultamos
        </h2>
        <ul className="flex flex-wrap justify-center gap-4">
          {FEATURED_SOURCES.map((s) => (
            <li key={s.key}>
              <SourcePill issuerKey={s.key} name={s.name} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
