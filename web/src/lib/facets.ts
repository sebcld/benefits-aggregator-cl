// Conteo por emisor (filtros) a partir del estado de cada fuente. En "todos los beneficios" el
// conteo de un emisor es su catalogo completo: sources[].count. Un emisor que fallo queda en null,
// igual que en los conteos de una busqueda.
import type { Facet, SourceStatus } from './api/types';

export function facetsFromSources(sources: SourceStatus[]): Facet[] {
  return sources.map((s) => ({ key: s.key, bank: s.bank, count: s.status === 'error' ? null : (s.count ?? null) }));
}
