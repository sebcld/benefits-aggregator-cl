// Tenpo: HTML publico (Webflow) parseado con regex, paginado con ?ca01dc3d_page=N.
// Fragil: si cambian las clases CSS, la pagina 1 devuelve 0 resultados (el runner lo alerta).
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { cleanText } = require('../shared/text');

const NAME = 'Tenpo';
const BASE_URL = 'https://www.tenpo.cl/beneficios';
const MAX_PAGES = 10;
const PAGE_DELAY_MS = 150;

const ITEM_REGEX =
  /titulo-beneficio-all">([^<]+)<\/div><\/div>[\s\S]*?p-text-beneficio-copy">([\s\S]*?)<\/div>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*class="cta-beneficio/gi;

const pageUrl = (page) => (page === 1 ? BASE_URL : `${BASE_URL}?ca01dc3d_page=${page}`);

// Extrae los beneficios de una pagina HTML de Tenpo.
function parseTenpoPage(html) {
  const results = [];
  const regex = new RegExp(ITEM_REGEX.source, ITEM_REGEX.flags);
  let match;

  while ((match = regex.exec(html)) !== null) {
    const title = cleanText(match[1]);
    const description = cleanText(match[2]);
    const href = match[3].startsWith('http') ? match[3] : `https://www.tenpo.cl${match[3]}`;

    results.push(
      createEntry(
        { bank: NAME, title, subtitle: '', description, url: href, commerceName: title },
        { sourceId: href },
      ),
    );
  }

  return results;
}

const provider = defineProvider({
  key: 'tenpo',
  name: NAME,
  async fetch({ http, sleep, signal }) {
    const results = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const html = await http.getText(pageUrl(page), { label: NAME, signal });
      const items = parseTenpoPage(html);
      if (!items.length) break;

      results.push(...items);
      await sleep(PAGE_DELAY_MS, signal);
    }

    return results;
  },
});

module.exports = { provider, parseTenpoPage };
