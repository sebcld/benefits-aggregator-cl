// Tarjeta de beneficio (variante por emisor: el color sale de --issuer).
// Mapeo de datos: bank/bankKey -> emisor y color; title/subtitle -> titulo y bajada;
// description -> descripcion; logo -> logo o iniciales; validUntil -> pastilla de vigencia
// (se oculta si es null); cardType -> pastilla de tarjeta (se oculta si es null); url -> "Ver
// beneficio"; hero -> extraido del titulo o, si no, de la bajada (si no hay valor claro, no se muestra).
import type { Benefit } from '@/lib/api/types';
import { extractHero, formatValidUntil } from '@/lib/benefit-format';
import { cn } from '@/lib/cn';
import { issuerStyle } from '@/lib/issuers';
import { CommerceLogo } from './CommerceLogo';
import { Icon } from './Icon';
import { IssuerTag } from './IssuerTag';

type CardBenefit = Pick<Benefit, 'bank' | 'bankKey' | 'title' | 'subtitle' | 'description' | 'validUntil' | 'url' | 'logo'> & {
  commerceName?: string | null;
  /** Tarjeta con la que aplica (pildora "medio de pago" del diseno). Hoy solo Mercado Pago. */
  cardType?: string | null;
};

interface BenefitCardProps {
  benefit: CardBenefit;
  /** Nivel del titulo segun la pagina (h2 en una lista sin encabezado, h3 bajo una seccion). */
  headingLevel?: 'h2' | 'h3';
  className?: string;
}

export function BenefitCard({ benefit, headingLevel: Heading = 'h3', className }: BenefitCardProps) {
  const hero = extractHero(benefit.title, benefit.subtitle);
  const validUntil = formatValidUntil(benefit.validUntil);

  return (
    <article
      style={issuerStyle(benefit.bankKey)}
      data-testid="benefit-card"
      className={cn('flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card', className)}
    >
      <div className="issuer-tint flex min-h-[84px] items-center gap-3 p-4">
        <CommerceLogo logo={benefit.logo} name={benefit.commerceName || benefit.title} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Heading className="font-display text-17 font-semibold tracking-display text-fg">{benefit.title}</Heading>
          {benefit.subtitle && <p className="line-clamp-2 text-13 text-fg-muted">{benefit.subtitle}</p>}
        </div>
        {hero && (
          // El valor ya esta en el titulo: la pildora es un resumen visual.
          <p
            aria-hidden="true"
            data-testid="benefit-hero"
            className="shrink-0 rounded-pill border border-brand-soft-line bg-brand-soft px-3 py-1.5 font-display text-18 font-bold tracking-display whitespace-nowrap text-brand-soft-fg"
          >
            {hero}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        {benefit.description && <p className="line-clamp-3 text-14 leading-5 text-fg">{benefit.description}</p>}
        {(validUntil || benefit.cardType) && (
          <ul className="flex flex-wrap gap-2">
            {validUntil && (
              <li className="inline-flex items-center gap-1.5 rounded-pill bg-amber-bg py-1 pr-2.5 pl-2 text-12 font-semibold text-on-amber">
                <Icon name="calendar" className="text-amber" />
                <time dateTime={benefit.validUntil ?? undefined}>{validUntil}</time>
              </li>
            )}
            {benefit.cardType && (
              <li
                data-testid="benefit-card-type"
                className="inline-flex items-center gap-1.5 rounded-pill bg-subtle py-1 pr-2.5 pl-2 text-12 font-semibold text-fg-muted"
              >
                <Icon name="card" />
                {benefit.cardType}
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 px-4 pb-4">
        <IssuerTag issuerKey={benefit.bankKey} name={benefit.bank} className="whitespace-nowrap" />
        {benefit.url && (
          <a
            href={benefit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-3.5 py-2 text-13 font-semibold whitespace-nowrap text-brand-soft-fg transition-opacity hover:opacity-85"
          >
            Ver beneficio
            <span className="sr-only">
              : {benefit.title} con {benefit.bank} (se abre en una pestaña nueva)
            </span>
            <Icon name="arrow-sm" />
          </a>
        )}
      </div>
    </article>
  );
}
