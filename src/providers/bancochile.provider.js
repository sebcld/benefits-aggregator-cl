// Banco de Chile: API de contenido (Modyo) de la pagina "Todos los beneficios", paginada de 100
// en 100. El sitio esta detras de Incapsula (responde 302/403 a clientes automatizados), por eso
// se consulta a traves del proxy de solo lectura r.jina.ai, pidiendo la respuesta como texto.
const { defineProvider } = require('./provider.interface');
const parser = require('./bancochile.parser');

const JINA_PROXY = 'https://r.jina.ai/http://';
const PAGE_SIZE = 100;
const MAX_PAGES = 50; // tope de seguridad (hoy son ~10 paginas)
const PAGE_DELAY_MS = 500;
const RETRY_429 = { maxAttempts: 5, defaultDelaySeconds: 8 };

const proxied = (url) => `${JINA_PROXY}${url.replace(/^https?:\/\//, '')}`;
const pageUrl = (page) => `${parser.API_URL}?per_page=${PAGE_SIZE}&page=${page}`;

const provider = defineProvider({
  key: 'bancochile',
  name: parser.NAME,
  async fetch({ http, config, sleep, signal }) {
    const headers = { 'x-return-format': 'text' };
    if (config.jinaApiKey) headers.authorization = `Bearer ${config.jinaApiKey}`;

    const results = [];
    let totalPages = 1;

    for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page += 1) {
      const text = await http.getText(proxied(pageUrl(page)), {
        label: parser.NAME,
        headers,
        signal,
        retry: RETRY_429,
      });
      const parsed = parser.parseBancoChilePage(text);
      results.push(...parsed.entries);
      totalPages = parsed.totalPages;

      if (page < totalPages) await sleep(PAGE_DELAY_MS, signal);
    }

    return results;
  },
});

module.exports = { provider };
