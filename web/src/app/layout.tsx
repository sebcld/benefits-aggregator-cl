import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { THEME_SCRIPT } from '@/lib/theme';
import { readTokens } from '@/styles/read-tokens';
import './globals.css';

const tokens = readTokens();

// Google Fonts servidas por next/font (se descargan en el build y se sirven desde el propio
// dominio), con font-display: swap.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], display: 'swap', variable: '--font-bricolage' });
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans' });

export const metadata: Metadata = {
  title: { default: 'Beneficios CL', template: '%s · Beneficios CL' },
  description:
    'Busca un comercio y te mostramos los beneficios de tus bancos, tarjetas y billeteras de Chile, todo en un solo lugar.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: tokens.light['--bg-page'] },
    { media: '(prefers-color-scheme: dark)', color: tokens.dark['--bg-page'] },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-CL" className={`${bricolage.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes del primer pintado (sin parpadeo). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-pill focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand"
        >
          Saltar al contenido
        </a>
        <SiteHeader />
        <main id="contenido">{children}</main>
      </body>
    </html>
  );
}
