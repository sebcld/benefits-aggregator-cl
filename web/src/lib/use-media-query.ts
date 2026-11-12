'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** true si la media query coincide. En el servidor (y en la hidratacion) devuelve `serverValue`. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Mismo corte que el breakpoint lg de Tailwind (64rem). */
export const MOBILE_QUERY = '(max-width: 63.999rem)';
