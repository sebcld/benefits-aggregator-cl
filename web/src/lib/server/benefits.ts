// Casos de uso del BFF sobre la API /v1: emisores (con cache), conteo por emisor y destacados.
import 'server-only';
import { cacheLife } from 'next/cache';
import { extractHero } from '@/lib/benefit-format';
import type { Bank, BanksResponse, Benefit, Facet, SearchResponse } from '@/lib/api/types';
import { upstreamGet } from './upstream';

/** Emisores disponibles. Cambian solo con un deploy de la API: se guardan una hora. */
export async function getBanks(): Promise<Bank[]> {
  'use cache';
  cacheLife('hours');
  const { status, body } = await upstreamGet<BanksResponse>('/v1/banks');
  // Lanzar evita que un error quede guardado en la cache.
  if (status !== 200 || !('banks' in body)) throw new Error(`GET /v1/banks respondio ${status}`);
  return body.banks;
}

/**
 * Coincidencias por emisor para una consulta: una busqueda por emisor con pageSize=1, leyendo
 * pagination.total. La API guarda cada catalogo en cache y deduplica las descargas en curso, asi
 * que estas consultas no vuelven a pedir nada a las fuentes. Un emisor que falla queda en null.
 */
export async function countByBank(query: string, banks: Bank[], signal?: AbortSignal): Promise<Facet[]> {
  return Promise.all(
    banks.map(async (bank): Promise<Facet> => {
      const params = new URLSearchParams({ q: query, banks: bank.key, pageSize: '1' });
      const { status, body } = await upstreamGet<SearchResponse>(`/v1/search?${params}`, { signal });
      const ok = status === 200 && 'pagination' in body && body.errors.length === 0;
      return { key: bank.key, bank: bank.name, count: ok ? body.pagination.total : null };
    }),
  );
}

/** Consultas de "Destacados de hoy" (inicio movil): una tarjeta por consulta, de emisores distintos. */
export const FEATURED_QUERIES = ['burger king', 'rappi', 'dunkin', 'mcdonalds', 'temu', 'uber eats', 'aliexpress', 'starbucks', 'donas', 'pedidos ya'];
const FEATURED_LIMIT = 10;

export async function getFeatured(): Promise<Benefit[]> {
  'use cache';
  // Se recalcula cada 2 horas, igual que la cache de catalogos de la API (CACHE_TTL_SECONDS=7200).
  // Si nadie la pide en 4 horas, se descarta.
  cacheLife({ stale: 300, revalidate: 7200, expire: 14_400 });

  const responses = await Promise.all(
    FEATURED_QUERIES.map((q) => upstreamGet<SearchResponse>(`/v1/search?${new URLSearchParams({ q, pageSize: '10' })}`)),
  );
  const picked: Benefit[] = [];
  const usedBanks = new Set<string>();
  for (const { status, body } of responses) {
    if (status !== 200 || !('results' in body)) continue;
    const candidates = body.results.filter((b) => !usedBanks.has(b.bankKey));
    const best = candidates.find((b) => extractHero(b.title, b.subtitle)) ?? candidates[0];
    if (best) {
      picked.push(best);
      usedBanks.add(best.bankKey);
    }
    if (picked.length >= FEATURED_LIMIT) break;
  }
  if (picked.length === 0) throw new Error('Ninguna consulta de destacados respondio');
  return picked;
}
