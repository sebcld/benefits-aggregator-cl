// Pagina de pruebas del sistema de diseno: tokens y todos los componentes, en Light y Dark.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { BenefitCard } from '@/components/ui/BenefitCard';
import { BetaBadge } from '@/components/ui/BetaBadge';
import { FilterDemo } from '@/components/sistema/FilterDemo';
import { ChipButton } from '@/components/ui/Chip';
import { LoadingCard } from '@/components/ui/LoadingCard';
import { Notice, NoticeAction } from '@/components/ui/Notice';
import { PillButton } from '@/components/ui/PillButton';
import { SearchBox } from '@/components/ui/SearchBox';
import { SourcePill } from '@/components/ui/SourcePill';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { FEATURED_SOURCES } from '@/lib/issuers';
import { SAMPLE_BENEFITS } from '@/lib/sample-benefits';
import { colorTokens, type ColorToken } from '@/styles/tokens';

export const metadata: Metadata = { title: 'Sistema de diseño', robots: { index: false } };

const COLOR_NAMES = Object.keys(colorTokens.light) as ColorToken[];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-13 font-semibold text-fg-muted">{title}</h3>
      {children}
    </section>
  );
}

function Swatches({ mode }: { mode: 'light' | 'dark' }) {
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
      {COLOR_NAMES.map((name) => (
        <li key={name} className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="size-8 shrink-0 rounded-sm border border-line"
            style={{ background: `var(--${name.replace('/', '-')})` }}
          />
          <span className="min-w-0">
            <span className="block truncate text-13 font-semibold text-fg">{name}</span>
            <span className="block text-12 text-fg-muted">{colorTokens[mode][name]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ThemePanel({ mode }: { mode: 'light' | 'dark' }) {
  const id = `sistema-${mode}`;
  return (
    <div data-theme={mode} className="flex min-w-0 flex-col gap-8 rounded-lg bg-page p-5 text-fg lg:p-8" aria-labelledby={id}>
      <h2 id={id} className="font-display text-24 font-bold tracking-display">
        {mode === 'light' ? 'Light' : 'Dark'}
      </h2>

      <Section title="Buscador · Escritorio 60px / Móvil 52px">
        <SearchBox size="desktop" id={`buscar-d-${mode}`} />
        <SearchBox size="mobile" id={`buscar-m-${mode}`} className="max-w-[358px]" />
      </Section>

      <Section title="Chips · Normal / Activo · Toggle de tema · Badge Beta">
        <div className="flex flex-wrap items-center gap-3">
          <ChipButton>Rappi</ChipButton>
          <ChipButton active>Rappi</ChipButton>
          <ThemeToggle />
          <BetaBadge />
        </div>
      </Section>

      <Section title="Avisos · Resultado parcial / Error">
        <Notice type="partial">No pudimos consultar BCI en este momento. Mostramos los demás resultados.</Notice>
        <Notice type="error" action={<NoticeAction>Reintentar</NoticeAction>}>
          No pudimos cargar los beneficios. Revisa tu conexión e inténtalo de nuevo.
        </Notice>
      </Section>

      <Section title="Filtros por emisor · Escritorio (checkbox + conteo) / Móvil (chips) · interactivo">
        <FilterDemo />
      </Section>

      <Section title="Fuentes · Cargar más">
        <div className="flex flex-wrap gap-3">
          {FEATURED_SOURCES.map((s) => (
            <SourcePill key={s.key} issuerKey={s.key} name={s.name} />
          ))}
        </div>
        <div>
          <PillButton>Cargar más</PillButton>
        </div>
      </Section>

      <Section title="Tarjeta de beneficio · una variante por emisor · Tarjeta cargando">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
          {SAMPLE_BENEFITS.map((b) => (
            <BenefitCard key={b.id} benefit={b} />
          ))}
          <BenefitCard
            benefit={{ ...SAMPLE_BENEFITS[0], bank: 'Mercado Pago', bankKey: 'mercadopago', title: 'Emisor sin token de color' }}
          />
          <LoadingCard />
        </div>
      </Section>

      <Section title="Tokens de color">
        <Swatches mode={mode} />
      </Section>
    </div>
  );
}

export default function SistemaPage() {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 lg:px-16">
      <div>
        <h1 className="font-display text-34 font-bold tracking-display">Sistema de diseño</h1>
        <p className="text-15 text-fg-muted">
          Tokens exportados de <code>design/beneficios_CL.figcraft</code> y la biblioteca de componentes, en ambos temas.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ThemePanel mode="light" />
        <ThemePanel mode="dark" />
      </div>
    </div>
  );
}
