// Tenpo: HTML publico (Webflow) parseado con regex, paginado con ?ca01dc3d_page=N.
// Fragil: si cambian las clases CSS, la pagina 1 devuelve 0 resultados (el runner lo alerta).
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { cleanText, decodeHtml } = require('../shared/text');

const NAME = 'Tenpo';
const BASE_URL = 'https://www.tenpo.cl/beneficios';
const MAX_PAGES = 10;
const PAGE_DELAY_MS = 150;

const ITEM_REGEX =
  /titulo-beneficio-all">([^<]+)<\/div><\/div>[\s\S]*?p-text-beneficio-copy">([\s\S]*?)<\/div>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*class="cta-beneficio/gi;

// Cada tarjeta empieza con este item de la coleccion de Webflow.
const CARD_START = 'beneficio-collection-item';
// Logo del comercio en la tarjeta: <img ... src="..." class="brand-partner">. Si la tarjeta no
// tiene logo, Webflow deja src="" y agrega la clase w-dyn-bind-empty.
const LOGO_TAG_REGEX = /<img\b[^>]*\bclass="brand-partner(?:\s[^"]*)?"[^>]*>/i;
const SRC_REGEX = /\bsrc="([^"]*)"/i;

const pageUrl = (page) => (page === 1 ? BASE_URL : `${BASE_URL}?ca01dc3d_page=${page}`);

/** Logo de la tarjeta que termina en `titleIndex`: se busca desde el inicio de esa tarjeta. */
function cardLogo(html, titleIndex) {
  const cardStart = html.lastIndexOf(CARD_START, titleIndex);
  if (cardStart < 0) return null;
  const tag = LOGO_TAG_REGEX.exec(html.slice(cardStart, titleIndex))?.[0];
  const src = decodeHtml(tag?.match(SRC_REGEX)?.[1] || '').trim();
  return /^https?:\/\//.test(src) ? src : null;
}

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
        { sourceId: href, logo: cardLogo(html, match.index) },
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
