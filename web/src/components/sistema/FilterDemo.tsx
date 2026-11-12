'use client';

// Demo interactiva del panel de filtros para /sistema (estado local, sin API).
import { useState } from 'react';
import { IssuerFilterChips, IssuerFilterPanel } from '@/components/results/IssuerFilters';
import type { Bank, Facet } from '@/lib/api/types';

const BANKS: Bank[] = [
  { key: 'santander', name: 'Santander', searchMode: 'catalog' },
  { key: 'bci', name: 'BCI', searchMode: 'catalog' },
  { key: 'tenpo', name: 'Tenpo', searchMode: 'catalog' },
  { key: 'tapp', name: 'Tapp', searchMode: 'catalog' },
  { key: 'copec', name: 'Copec Pay', searchMode: 'catalog' },
  { key: 'bancochile', name: 'Banco de Chile', searchMode: 'catalog' },
];
const FACETS: Facet[] = [
  { key: 'santander', bank: 'Santander', count: 1 },
  { key: 'bci', bank: 'BCI', count: 1 },
  { key: 'tenpo', bank: 'Tenpo', count: 1 },
  { key: 'tapp', bank: 'Tapp', count: 0 },
  { key: 'copec', bank: 'Copec Pay', count: 2 },
  { key: 'bancochile', bank: 'Banco de Chile', count: 1 },
];

export function FilterDemo() {
  const [selected, setSelected] = useState<string[]>([]);
  const props = { banks: BANKS, facets: FACETS, selected, onChange: setSelected };
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-[260px]">
        <IssuerFilterPanel {...props} />
      </div>
      <IssuerFilterChips {...props} />
    </div>
  );
}
