// Header fijo con efecto vidrio (glass/bg + blur 12px). Navegacion solo en escritorio.
import Link from 'next/link';
import { BetaBadge } from '@/components/ui/BetaBadge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const NAV = [
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/#fuentes', label: 'Emisores' },
  { href: process.env.NEXT_PUBLIC_CONTACT_URL || 'https://github.com/sebcld/benefits-aggregator-cl/issues', label: 'Contacto' },
];

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-40 border-b border-line">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3.5 lg:px-16 lg:py-[18px]">
        <Link href="/" className="flex items-center gap-2 rounded-sm lg:gap-2.5" aria-label="Beneficios CL, inicio">
          <span
            aria-hidden="true"
            className="grid size-[30px] place-items-center rounded-[9px] bg-brand font-display text-16 font-bold text-on-brand lg:size-[34px] lg:rounded-[10px] lg:text-18"
          >
            %
          </span>
          <span className="font-display text-18 font-bold tracking-display text-fg lg:text-20">Beneficios CL</span>
        </Link>

        <div className="flex items-center gap-2.5 lg:gap-7">
          <nav aria-label="Principal" className="hidden lg:block">
            <ul className="flex items-center gap-7">
              {NAV.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="rounded-sm text-14 font-medium text-fg-muted transition-colors hover:text-fg">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <BetaBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
