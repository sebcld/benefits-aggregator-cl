'use client';

// Reloj que se actualiza cada 15 s, para textos como "hace 5 min". Usa useSyncExternalStore:
// leer Date.now() al renderizar no es puro, y el valor redondeado es estable entre lecturas.
// En el servidor (y en la primera hidratacion) vale null.
import { useSyncExternalStore } from 'react';

export const NOW_TICK_MS = 15_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, NOW_TICK_MS);
  return () => clearInterval(id);
}

const snapshot = () => Math.floor(Date.now() / NOW_TICK_MS) * NOW_TICK_MS;
const serverSnapshot = () => null;

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
