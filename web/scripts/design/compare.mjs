// Comparacion visual diseno vs. web: pone lado a lado el render del diseno (design-ref/, de
// npm run design:render) y la captura de la web (e2e/__screenshots__/, de screens.spec.ts).
// Uso: npm run design:compare   ->   design-ref/compare/<vista>-<pantalla>-<tema>.png
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'design-ref', 'compare');
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { project: 'movil', designDir: 'movil', prefix: 'movil' },
  { project: 'escritorio', designDir: 'escritorio', prefix: 'escritorio' },
];
const SCREENS = ['inicio', 'resultados'];
const THEMES = ['light', 'dark'];

const dataUrl = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;

const browser = await chromium.launch(process.env.PW_CHANNEL === 'chromium' ? {} : { channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ deviceScaleFactor: 1 });
let count = 0;
for (const view of VIEWS) {
  for (const screen of SCREENS) {
    for (const theme of THEMES) {
      const design = path.join(ROOT, 'design-ref', view.designDir, `${view.prefix}-${screen}-${theme}.png`);
      const web = path.join(ROOT, 'e2e', '__screenshots__', view.project, `${screen}-${theme}.png`);
      if (!existsSync(design) || !existsSync(web)) {
        console.log(`(falta) ${path.relative(ROOT, existsSync(design) ? web : design)}`);
        continue;
      }
      const html = `<!doctype html><html><body style="margin:0;background:#888;font:600 14px system-ui">
<div style="display:flex;gap:16px;padding:16px;align-items:flex-start">
<figure style="margin:0"><figcaption style="color:#fff;margin-bottom:6px">DISEÑO</figcaption><img src="${dataUrl(design)}"></figure>
<figure style="margin:0"><figcaption style="color:#fff;margin-bottom:6px">WEB</figcaption><img src="${dataUrl(web)}"></figure>
</div></body></html>`;
      await page.setViewportSize({ width: 800, height: 600 });
      await page.setContent(html, { waitUntil: 'load' });
      const file = path.join(OUT, `${view.project}-${screen}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      count += 1;
      console.log(path.relative(ROOT, file));
    }
  }
}
await browser.close();
console.log(`${count} comparaciones en ${path.relative(ROOT, OUT)}`);
