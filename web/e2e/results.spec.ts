// Flujos y estados de la web contra el BFF simulado: busqueda, parcial, cargar mas, filtros,
// carga lenta, error con reintento, sin resultados y tema.
import { expect, test, type Page } from '@playwright/test';
import { mockApi, RAPPI_PAGE_1, searchResponse } from './fixtures';

// Next 16 conserva oculta la pagina anterior (para preservar su estado) y su anunciador de rutas
// tiene role="alert": las consultas se acotan a la region de resultados visible.
const results = (page: Page) => page.getByRole('region', { name: 'Resultados' });

const desktopOnly = (name: string) => test.skip(name !== 'escritorio', 'Solo escritorio');
const mobileOnly = (name: string) => test.skip(name !== 'movil', 'Solo móvil');

test('buscar desde el inicio lleva a los resultados', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByLabel('Busca un comercio o marca').fill('rappi');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(/\/buscar\?q=rappi$/);
  await expect(results(page).getByTestId('benefit-card')).toHaveCount(6);
});

test('un chip de sugerencia busca ese comercio', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Búsquedas sugeridas' }).getByRole('link', { name: 'Rappi' }).click();
  await expect(page).toHaveURL(/\/buscar\?q=Rappi$/);
});

test('resultado parcial: aviso ambar y resumen', async ({ page }) => {
  await mockApi(page);
  await page.goto('/buscar?q=rappi');
  await expect(page.getByText('Mostrando 6 de 12 beneficios para «rappi»')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'No pudimos consultar BCI en este momento' })).toBeVisible();
  await expect(page.getByTestId('benefit-hero').first()).toHaveText('20% DCTO');
});

test('"Cargar más" trae la pagina siguiente y desaparece al final', async ({ page }) => {
  await mockApi(page);
  await page.goto('/buscar?q=rappi');
  await page.getByRole('button', { name: 'Cargar más' }).click();
  await expect(results(page).getByTestId('benefit-card')).toHaveCount(12);
  await expect(page.getByText('Mostrando 12 de 12 beneficios para «rappi»')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cargar más' })).toHaveCount(0);
});

test('filtros de escritorio: conteo por emisor, deshabilitado con 0 y filtro en la URL', async ({ page }, info) => {
  desktopOnly(info.project.name);
  const requests: string[] = [];
  await mockApi(page);
  page.on('request', (r) => r.url().includes('/api/search') && requests.push(r.url()));
  await page.goto('/buscar?q=rappi');

  const panel = page.getByRole('group', { name: 'Emisores' });
  await expect(panel.getByRole('checkbox', { name: 'Copec Pay, 2 beneficios' })).toBeChecked();
  await expect(panel.getByRole('checkbox', { name: 'Tapp, 0 beneficios' })).toBeDisabled();

  await panel.getByText('Santander').click();
  await expect(page).toHaveURL(/banks=bci%2Ctenpo%2Ctapp%2Ccopec%2Cbancochile/);
  await expect(panel.getByRole('checkbox', { name: /^Santander/ })).not.toBeChecked();
  // Al filtrar no se vuelven a pedir los conteos de la misma consulta.
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[0]).toContain('facets=1');
  expect(requests[1]).not.toContain('facets=1');

  await panel.getByRole('button', { name: 'Limpiar filtros de emisor' }).click();
  await expect(page).toHaveURL(/\/buscar\?q=rappi$/);
});

test('filtros moviles: chips "Todos" y por emisor', async ({ page }, info) => {
  mobileOnly(info.project.name);
  await mockApi(page);
  await page.goto('/buscar?q=rappi');
  const chips = page.getByRole('group', { name: 'Filtrar por emisor' });
  await expect(chips.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
  // Tapp no tiene coincidencias: no aparece.
  await expect(chips.getByRole('button', { name: 'Tapp' })).toHaveCount(0);
  await chips.getByRole('button', { name: 'Copec Pay' }).click();
  await expect(page).toHaveURL(/banks=copec$/);
  await expect(chips.getByRole('button', { name: 'Copec Pay' })).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
});

test('cargando: skeletons y aviso de que la primera busqueda puede tardar', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await mockApi(page, {
    search: async () => {
      await gate;
      return { body: searchResponse(RAPPI_PAGE_1, 1) };
    },
  });
  await page.goto('/buscar?q=rappi');
  await expect(page.getByTestId('loading-card').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resultados' })).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByText(/la primera búsqueda puede tardar hasta 20 segundos/)).toBeVisible({ timeout: 6000 });
  release();
  await expect(results(page).getByTestId('benefit-card')).toHaveCount(6);
});

test('error de red: aviso con "Reintentar" que vuelve a buscar', async ({ page }) => {
  let calls = 0;
  await mockApi(page, {
    search: () => {
      calls += 1;
      return calls === 1
        ? { status: 502, body: { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'No se pudo contactar la API' } } }
        : { body: searchResponse(RAPPI_PAGE_1, 1) };
    },
  });
  await page.goto('/buscar?q=rappi');
  const alert = results(page).getByRole('alert');
  await expect(alert).toContainText('no está disponible');
  await alert.getByRole('button', { name: 'Reintentar' }).click();
  await expect(results(page).getByTestId('benefit-card')).toHaveCount(6);
});

test('sin resultados: mensaje y sugerencias', async ({ page }) => {
  await mockApi(page, {
    search: () => ({
      body: searchResponse([], 1, {
        query: 'xyz',
        pagination: { page: 1, pageSize: 12, total: 0, totalPages: 1, hasMore: false },
        errors: [],
        meta: { generatedAt: '2026-11-12T15:00:00.000Z', partial: false },
      }),
    }),
  });
  await page.goto('/buscar?q=xyz');
  await expect(page.getByText('No encontramos beneficios para «xyz».')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Otras búsquedas' }).getByRole('link')).not.toHaveCount(0);
});

test('el tema elegido se guarda y se aplica antes de pintar al recargar', async ({ page }) => {
  await mockApi(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Activar tema oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(11, 14, 12)');
});

test('sin preferencia guardada respeta prefers-color-scheme', async ({ page }) => {
  await mockApi(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(11, 14, 12)');
  await expect(page.getByRole('button', { name: 'Activar tema claro' })).toBeVisible();
});

test('prefers-reduced-motion desactiva el shimmer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/sistema');
  const display = await page
    .getByTestId('loading-card')
    .first()
    .evaluate((el) => getComputedStyle(el, '::after').display);
  expect(display).toBe('none');
});
