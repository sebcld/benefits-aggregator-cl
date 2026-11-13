// Seleccion de emisores. Una lista vacia significa "todos" (igual que la API cuando no recibe banks).

export function parseBanksParam(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean))];
}

export function isSelected(selected: string[], key: string): boolean {
  return selected.length === 0 || selected.includes(key);
}

/** Si la seleccion cubre todos los emisores, se normaliza a [] ("todos"). */
function normalize(selected: string[], allKeys: string[]): string[] {
  const set = new Set(selected);
  return allKeys.length > 0 && allKeys.every((k) => set.has(k)) ? [] : allKeys.filter((k) => set.has(k));
}

/** Checkbox del panel de escritorio: con "todos", desmarcar uno deja seleccionados los demas. */
export function setChecked(selected: string[], key: string, checked: boolean, allKeys: string[]): string[] {
  const current = selected.length === 0 ? allKeys : selected;
  const next = checked ? [...current, key] : current.filter((k) => k !== key);
  // Desmarcar el ultimo no deja la busqueda vacia: vuelve a "todos".
  return next.length === 0 ? [] : normalize(next, allKeys);
}

/**
 * Boton "Solo" del panel de escritorio: deja seleccionado solo ese emisor y descarta los demas.
 * Para elegir 2 o 3 emisores rapido: "Solo" en el primero y luego marcar los otros.
 */
export function onlyThis(key: string, allKeys: string[]): string[] {
  return normalize([key], allKeys);
}

/** Chip movil: con "Todos", tocar un emisor filtra solo por el; si no, lo agrega o lo quita. */
export function toggleChip(selected: string[], key: string, allKeys: string[]): string[] {
  if (selected.length === 0) return normalize([key], allKeys);
  const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
  return next.length === 0 ? [] : normalize(next, allKeys);
}

/** URL de resultados para una consulta y seleccion. */
export function resultsHref(query: string, banks: string[]): string {
  const params = new URLSearchParams({ q: query });
  if (banks.length) params.set('banks', banks.join(','));
  return `/buscar?${params}`;
}
