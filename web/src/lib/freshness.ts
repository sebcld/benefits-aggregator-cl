// Antiguedad de los catalogos de una busqueda y si ya se pueden actualizar (refresh=true).
// Se calcula con la hora del SERVIDOR (meta.generatedAt) mas el tiempo transcurrido en el
// navegador desde que llego la respuesta: asi un reloj del cliente desfasado no muestra
// "hace -3 min" ni habilita el boton antes de tiempo.
import type { SourceStatus } from './api/types';

export interface Freshness {
  /** Descarga mas antigua entre los emisores que respondieron (la que mas importa). */
  oldestFetchedAt: string;
  /** Hora del servidor al generar la respuesta. */
  generatedAt: string;
  /** Desde cuando refresh=true vuelve a descargar algo (hora del servidor). */
  refreshableAt: string;
  /** Date.now() del navegador cuando llego la respuesta. */
  receivedAt: number;
}

/**
 * null si no hay nada que mostrar: cache desactivada (refreshableAt null, los datos siempre son
 * de recien) o ningun emisor respondio.
 */
export function freshnessOf(
  sources: SourceStatus[],
  meta: { generatedAt: string; refreshableAt?: string | null },
  receivedAt: number,
): Freshness | null {
  const fetched = sources.map((s) => s.fetchedAt).filter((d): d is string => Boolean(d));
  if (!meta.refreshableAt || fetched.length === 0) return null;
  const oldestFetchedAt = fetched.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
  return { oldestFetchedAt, generatedAt: meta.generatedAt, refreshableAt: meta.refreshableAt, receivedAt };
}

/** Hora estimada del servidor en este momento. */
export function serverNow(f: Freshness, clientNow: number): number {
  return Date.parse(f.generatedAt) + Math.max(0, clientNow - f.receivedAt);
}

export const ageMs = (f: Freshness, clientNow: number) => Math.max(0, serverNow(f, clientNow) - Date.parse(f.oldestFetchedAt));

export const canRefresh = (f: Freshness, clientNow: number) => serverNow(f, clientNow) >= Date.parse(f.refreshableAt);

/** Minutos que faltan para poder actualizar (al menos 1 mientras no se pueda). */
export const minutesUntilRefresh = (f: Freshness, clientNow: number) =>
  Math.max(1, Math.ceil((Date.parse(f.refreshableAt) - serverNow(f, clientNow)) / 60_000));

/** "hace menos de 1 min", "hace 5 min", "hace 1 h", "hace 1 h 30 min". */
export function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'hace menos de 1 min';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `hace ${hours} h ${rest} min` : `hace ${hours} h`;
}
