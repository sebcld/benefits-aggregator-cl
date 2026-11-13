// Datos de prueba para e2e: reproducen el contenido de las pantallas del diseno (consulta "rappi",
// 6 de 12 resultados, BCI caido, Tapp sin coincidencias).
import type { Page, Route } from '@playwright/test';
import type { Bank, Benefit, Facet, WebSearchResponse } from '../src/lib/api/types';

const base = {
  commerceName: null,
  category: null,
  validFrom: null,
  validUntil: '2026-12-31',
  url: 'https://example.com/beneficio',
  logo: null,
};

export const BANKS: Bank[] = [
  { key: 'santander', name: 'Santander', searchMode: 'catalog' },
  { key: 'bci', name: 'BCI', searchMode: 'catalog' },
  { key: 'tenpo', name: 'Tenpo', searchMode: 'catalog' },
  { key: 'tapp', name: 'Tapp', searchMode: 'catalog' },
  { key: 'copec', name: 'Copec Pay', searchMode: 'catalog' },
  { key: 'bancochile', name: 'Banco de Chile', searchMode: 'catalog' },
];

const b = (id: string, bankKey: string, bank: string, title: string, subtitle: string, description: string): Benefit => ({
  ...base,
  id,
  bankKey,
  bank,
  title,
  subtitle,
  description,
});

export const RAPPI_PAGE_1: Benefit[] = [
  // Como en las fuentes reales (Santander, Copec, Banco de Chile), el valor va en la bajada.
  b('copec-1', 'copec', 'Copec Pay', 'Rappi', '20% dcto en tus pedidos', 'Obtén descuento en tus pedidos pagando con tu tarjeta. Aplica desde el monto mínimo indicado en las condiciones.'),
  b('tapp-1', 'tapp', 'Tapp', 'Rappi Regiones', '15% dcto fuera de la RM', 'Beneficio disponible en regiones seleccionadas. Revisa las tiendas y el tope de descuento antes de pagar.'),
  b('bci-1', 'bci', 'BCI', 'Rappi Prime gratis', 'Envío gratis con tu tarjeta', 'Disfruta de envíos sin costo en tus pedidos durante el período de la promoción.'),
  b('santander-1', 'santander', 'Santander', 'Envío en Rappi', '2x1 sobre el mínimo', 'Envío sin costo en pedidos que superen el monto mínimo, pagando con tu tarjeta de crédito.'),
  b('tenpo-1', 'tenpo', 'Tenpo', 'Rappi Antojos', '30% dcto en tiendas seleccionadas', 'Descuento en tu primera compra de Antojos. Revisa las tiendas adheridas y el tope por usuario.'),
  b('bancochile-1', 'bancochile', 'Banco de Chile', 'Rappi Turbo', '15% dcto en entrega rápida', 'Pide en Rappi Turbo y obtén descuento con tu tarjeta. Aplica lunes a domingo.'),
];

export const RAPPI_PAGE_2: Benefit[] = RAPPI_PAGE_1.map((x) => ({ ...x, id: `${x.id}-p2`, title: `${x.title} (2)` }));

export const FACETS: Facet[] = [
  { key: 'santander', bank: 'Santander', count: 1 },
  { key: 'bci', bank: 'BCI', count: 1 },
  { key: 'tenpo', bank: 'Tenpo', count: 1 },
  { key: 'tapp', bank: 'Tapp', count: 0 },
  { key: 'copec', bank: 'Copec Pay', count: 2 },
  { key: 'bancochile', bank: 'Banco de Chile', count: 1 },
];

export function searchResponse(results: Benefit[], page: number, overrides: Partial<WebSearchResponse> = {}): WebSearchResponse {
  return {
    query: 'rappi',
    results,
    pagination: { page, pageSize: 6, total: 12, totalPages: 2, hasMore: page < 2 },
    sources: [],
    errors: [{ bank: 'BCI', key: 'bci', code: 'TIMEOUT', message: 'BCI excedio el tiempo limite' }],
    meta: { generatedAt: '2026-11-12T15:00:00.000Z', partial: true, refreshableAt: null },
    ...overrides,
  };
}

// 4 destacados: en escritorio (3 columnas) se ve una fila completa de 3; en movil, los 4.
export const FEATURED: Benefit[] = [
  b('santander-bk', 'santander', 'Santander', 'Burger King', '2x1 en combos y ofertas', 'Descuento en locales seleccionados pagando con tu tarjeta. Revisa los días y condiciones.'),
  b('copec-rappi', 'copec', 'Copec Pay', 'Rappi', '20% dcto en tus pedidos', 'Obtén descuento en tus pedidos pagando con tu tarjeta. Aplica desde el monto mínimo.'),
  b('bci-dunkin', 'bci', 'BCI', 'Dunkin', '30% dcto los jueves', 'Descuento en el total de la boleta pagando con tus tarjetas BCI.'),
  b('tenpo-temu', 'tenpo', 'Tenpo', 'Temu', 'Hasta 50% dcto', 'Descuento para nuevos usuarios de la App Temu.'),
];

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export interface MockOptions {
  /** Respuesta de /api/search segun la URL (por defecto, las dos paginas de "rappi"). */
  search?: (url: URL) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;
}

/** Intercepta el BFF (/api/*) en el navegador: las pruebas no dependen de la API real. */
export async function mockApi(page: Page, options: MockOptions = {}) {
  await page.route('**/api/banks', (route) => json(route, { banks: BANKS }));
  await page.route('**/api/destacados', (route) => json(route, { results: FEATURED }));
  await page.route('**/api/search?**', async (route) => {
    const url = new URL(route.request().url());
    if (options.search) {
      const { status = 200, body } = await options.search(url);
      return json(route, body, status);
    }
    const pageNumber = Number(url.searchParams.get('page') ?? 1);
    const body = searchResponse(pageNumber === 1 ? RAPPI_PAGE_1 : RAPPI_PAGE_2, pageNumber);
    return json(route, url.searchParams.get('facets') === '1' ? { ...body, facets: FACETS } : body);
  });
}
