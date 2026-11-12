'use client';

// Toggle de tema (sol/luna). Muestra la luna en Light (pasar a oscuro) y el sol en Dark.
// El icono se elige con CSS (variante dark:), asi coincide con el tema desde el primer pintado;
// el estado de React solo alimenta la etiqueta accesible.
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { applyTheme, currentTheme, readStoredTheme, subscribeTheme, type Theme } from '@/lib/theme';
import { Icon } from './Icon';

const getServerTheme = (): Theme => 'light';

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, getServerTheme);

  // En desarrollo, el remontaje de Strict Mode borra el atributo que puso el script inline.
  useLayoutEffect(() => {
    const stored = readStoredTheme();
    if (stored) document.documentElement.setAttribute('data-theme', stored);
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={next === 'dark' ? 'Activar tema oscuro' : 'Activar tema claro'}
      title={next === 'dark' ? 'Tema oscuro' : 'Tema claro'}
      className="grid size-10 shrink-0 place-items-center rounded-pill border border-line bg-surface text-fg transition-colors hover:bg-subtle"
    >
      <Icon name="moon" className="dark:hidden" />
      <Icon name="sun" className="hidden dark:block" />
    </button>
  );
}
