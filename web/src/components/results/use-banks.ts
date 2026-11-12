'use client';

// Lista de emisores para los filtros (GET /api/banks -> /v1/banks). Se pide una vez por visita.
import { useEffect, useState } from 'react';
import { listBanks } from '@/lib/api/client';
import type { Bank } from '@/lib/api/types';

let cached: Promise<Bank[]> | null = null;

function loadBanks(): Promise<Bank[]> {
  cached ??= listBanks().then(
    (res) => res.banks,
    (err) => {
      cached = null; // permite reintentar en el proximo montaje
      throw err;
    },
  );
  return cached;
}

export function useBanks(): Bank[] | null {
  const [banks, setBanks] = useState<Bank[] | null>(null);
  useEffect(() => {
    let active = true;
    loadBanks()
      .then((list) => active && setBanks(list))
      .catch(() => active && setBanks([]));
    return () => {
      active = false;
    };
  }, []);
  return banks;
}
