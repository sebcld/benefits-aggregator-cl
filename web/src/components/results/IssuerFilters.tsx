'use client';

// Filtros por emisor. Escritorio: panel de vidrio con checkbox + conteo. Movil: chips.
import { ChipButton } from '@/components/ui/Chip';
import { IssuerCheckbox } from '@/components/ui/IssuerCheckbox';
import type { Bank, Facet } from '@/lib/api/types';
import { isSelected, onlyThis, setChecked, toggleChip } from '@/lib/filters';

interface FiltersProps {
  banks: Bank[];
  facets: Facet[] | null;
  selected: string[];
  onChange: (next: string[]) => void;
}

const countFor = (facets: Facet[] | null, key: string) => facets?.find((f) => f.key === key)?.count ?? null;

export function IssuerFilterPanel({ banks, facets, selected, onChange }: FiltersProps) {
  const allKeys = banks.map((b) => b.key);
  return (
    // El legend debe ser hijo directo del fieldset para nombrar el grupo ("Emisores").
    <fieldset className="glass relative flex w-full flex-col gap-3.5 rounded-lg border border-line p-5">
      <legend className="float-left font-display text-17 leading-5 font-semibold tracking-display text-fg">Emisores</legend>
      <button
        type="button"
        onClick={() => onChange([])}
        disabled={selected.length === 0}
        aria-label="Limpiar filtros de emisor"
        className="absolute top-[22px] right-5 rounded-sm text-13 font-semibold text-brand enabled:hover:underline disabled:cursor-default"
      >
        Limpiar
      </button>
      {banks.map((bank) => (
        <IssuerCheckbox
          key={bank.key}
          issuerKey={bank.key}
          name={bank.name}
          count={countFor(facets, bank.key)}
          checked={isSelected(selected, bank.key)}
          onChange={(checked) => onChange(setChecked(selected, bank.key, checked, allKeys))}
          onOnly={() => onChange(onlyThis(bank.key, allKeys))}
        />
      ))}
      <p className="text-12 leading-4 text-fg-muted">Usa «Solo» para quedarte con un emisor y luego marca los que quieras sumar.</p>
    </fieldset>
  );
}

export function IssuerFilterChips({ banks, facets, selected, onChange }: FiltersProps) {
  const allKeys = banks.map((b) => b.key);
  // Se ocultan los emisores sin coincidencias (si ya se conocen los conteos).
  const visible = banks.filter((b) => countFor(facets, b.key) !== 0 || selected.includes(b.key));
  return (
    <div role="group" aria-label="Filtrar por emisor" className="flex flex-wrap gap-2">
      <ChipButton active={selected.length === 0} onClick={() => onChange([])}>
        Todos
      </ChipButton>
      {visible.map((bank) => (
        <ChipButton
          key={bank.key}
          active={selected.includes(bank.key)}
          onClick={() => onChange(toggleChip(selected, bank.key, allKeys))}
        >
          {bank.name}
        </ChipButton>
      ))}
    </div>
  );
}
