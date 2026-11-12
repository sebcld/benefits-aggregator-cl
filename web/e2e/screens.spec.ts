// Capturas de cada pantalla (Inicio, Resultados, Sistema) en Light y Dark, para compararlas con el
// diseno (npm run design:compare). No son pruebas de regresion por pixel: el contenido de la web
// no es identico al del diseno.
import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

const THEMES = ['light', 'dark'] as const;
const SCREENS = [
  { name: 'inicio', path: '/', ready: 'h1' },
  { name: 'resultados', path: '/buscar?q=rappi', ready: '[data-testid="benefit-card"]' },
  { name: 'sistema', path: '/sistema', ready: 'h1' },
];

for (const theme of THEMES) {
  for (const screen of SCREENS) {
    test(`captura ${screen.name} ${theme}`, async ({ page }, info) => {
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('theme', t);
        } catch {}
      }, theme);
      await mockApi(page);
      await page.goto(screen.path);
      await expect(page.locator(screen.ready).first()).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      if (screen.name === 'inicio' && info.project.name === 'movil') {
        await expect(page.getByTestId('benefit-card').first()).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      // Sin animaciones (shimmer) para que la captura sea estable.
      await page.addStyleTag({ content: '*,*::after{animation:none!important;transition:none!important}' });
      await page.screenshot({ path: `e2e/__screenshots__/${info.project.name}/${screen.name}-${theme}.png`, fullPage: true });
    });
  }
}
