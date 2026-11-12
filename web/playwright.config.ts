import { defineConfig } from '@playwright/test';

// e2e contra el build de produccion (next start en 3001). Las pruebas interceptan /api/* en el
// navegador, asi que no hace falta la API real.
// Localmente se usa Edge instalado (sin descargar navegadores); en CI, el Chromium de Playwright.
const PORT = 3001;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.CI || process.env.PW_CHANNEL === 'chromium' ? undefined : 'msedge',
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
  },
  projects: [
    { name: 'movil', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'escritorio', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run start',
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
