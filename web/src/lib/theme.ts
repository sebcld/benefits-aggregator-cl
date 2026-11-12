// Tema Light/Dark. La preferencia elegida se guarda en localStorage; si no hay, manda el sistema
// (prefers-color-scheme). El atributo data-theme en <html> lo pone un script inline antes de pintar
// (ver THEME_SCRIPT), asi no hay parpadeo.

export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'theme';

/** Script inline para <head>: aplica la preferencia guardada antes del primer pintado. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Modo privado, almacenamiento bloqueado o cuota llena: se usa la preferencia del sistema.
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Igual se aplica el tema en esta visita.
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Tema efectivo: el atributo (preferencia elegida) o, si no hay, el del sistema. */
export function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' || attr === 'dark' ? attr : systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  storeTheme(theme);
}

/** Suscripcion para useSyncExternalStore: cambios del atributo o de la preferencia del sistema. */
export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    media?.removeEventListener('change', onChange);
  };
}
