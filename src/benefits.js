const config = require('./config');

const SANTANDER_URL =
  'https://banco.santander.cl/beneficios/promociones.json?per_page=9999&custom_fields=true';
const BCI_BASE_URL = 'https://api.bciplus.cl/bff-loyalty-beneficios/v1/offers';
const BANCHILE_BASE = 'https://sitiospublicos.bancochile.cl/personas/beneficios';
const JINA_PROXY = 'https://r.jina.ai/http://';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeHtml = (text) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

const cleanText = (text) =>
  decodeHtml((text || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalize = (text) =>
  cleanText(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9\s]/g, ' ') // elimina puntuacion como apostrofes/guiones
    .replace(/\s+/g, ' ')
    .trim();

const matchesQuery = (entry, query) => {
  const target = normalize(query);
  const haystack = [
    entry.title,
    entry.subtitle,
    entry.description,
    entry.slug,
    entry.keywords,
    entry.commerceName,
    entry.tagsText,
  ]
    .filter(Boolean)
    .map((field) => normalize(field))
    .join(' ');

  const targetCompact = target.replace(/\s+/g, '');
  const haystackCompact = haystack.replace(/\s+/g, '');

  const boundaryMatch = target ? new RegExp(`\\b${escapeRegex(target)}\\b`).test(haystack) : false;

  const isSingleWord = !target.includes(' ');

  if (isSingleWord) {
    if (target.length <= 4) {
      return boundaryMatch;
    }
    return boundaryMatch || haystackCompact.includes(targetCompact);
  }

  return haystack.includes(target) || haystackCompact.includes(targetCompact) || boundaryMatch;
};

const truncate = (text, limit = 180) =>
  text.length > limit ? `${text.slice(0, limit - 3).trimEnd()}...` : text;

const toTitleCase = (text) =>
  (text || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

async function fetchSantander() {
  const response = await fetch(SANTANDER_URL, {
    headers: { 'user-agent': 'beneficios-finder/1.0' },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Santander respondio ${response.status}: ${body.slice(0, 120)}`);
  }

  const data = await response.json();
  const promos = data?.promociones || [];

  return promos.map((item) => {
    const subtitle =
      item?.custom_fields?.['Bajada externa']?.value ||
      item?.custom_fields?.['Bajada interna']?.value ||
      '';

    return {
      bank: 'Santander',
      title: item?.title?.trim() || '',
      subtitle: cleanText(subtitle),
      description: cleanText(item?.description),
      commerceName: cleanText(item?.title),
      slug: item?.slug || '',
      tagsText: (item?.tags || []).join(' '),
      url: item?.url || '',
    };
  });
}

async function fetchBci() {
  const subscriptionKey = config.bciSubscriptionKey;

  if (!subscriptionKey) {
    throw new Error('Falta la llave de subscripcion de BCI (define BCI_SUBSCRIPTION_KEY en .env)');
  }

  let page = 1;
  let totalPages = 1;
  const offers = [];

  while (page <= totalPages) {
    const url = `${BCI_BASE_URL}?itemsPorPagina=100&pagina=${page}`;
    const response = await fetch(url, {
      headers: {
        'ocp-apim-subscription-key': subscriptionKey,
        'user-agent': 'beneficios-finder/1.0',
        referer: 'https://www.bci.cl/',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`BCI respondio ${response.status}: ${body.slice(0, 120)}`);
    }

    const data = await response.json();
    totalPages = data?.paginado?.totalPaginas || 1;
    offers.push(...(data?.ofertas || []));
    page += 1;

    await sleep(150);
  }

  return offers.map((offer) => {
    const tagsText = (offer?.tags || []).map((t) => t?.nombre || '').join(' ');
    const fallbackUrl = offer?.slug
      ? `https://www.bci.cl/beneficios/beneficios-bci#${offer.slug}`
      : 'https://www.bci.cl/beneficios/beneficios-bci';

    return {
      bank: 'BCI',
      title: offer?.titulo?.trim() || '',
      subtitle: cleanText(offer?.subtitulo),
      description: cleanText(offer?.descripcion),
      url: offer?.link?.trim() || fallbackUrl,
      slug: offer?.slug || '',
      commerceName: cleanText(offer?.comercio?.nombre),
      keywords: cleanText(offer?.keywords),
      tagsText,
    };
  });
}

async function fetchTenpo() {
  const base = 'https://www.tenpo.cl/beneficios';
  const results = [];
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    const url = page === 1 ? base : `${base}?ca01dc3d_page=${page}`;
    const response = await fetch(url, {
      headers: { 'user-agent': 'beneficios-finder/1.0' },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Tenpo respondio ${response.status}: ${body.slice(0, 120)}`);
    }

    const html = await response.text();
    const itemRegex =
      /titulo-beneficio-all">([^<]+)<\/div><\/div>[\s\S]*?p-text-beneficio-copy">([\s\S]*?)<\/div>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*class="cta-beneficio/gi;
    let match;
    let foundOnPage = 0;

    while ((match = itemRegex.exec(html)) !== null) {
      const title = cleanText(match[1]);
      const description = cleanText(match[2]);
      const href = match[3].startsWith('http')
        ? match[3]
        : `https://www.tenpo.cl${match[3]}`;

      results.push({
        bank: 'Tenpo',
        title,
        subtitle: '',
        description,
        url: href,
        commerceName: title,
      });
      foundOnPage += 1;
    }

    if (!foundOnPage) {
      break;
    }

    page += 1;
    await sleep(150);
  }

  return results;
}

async function fetchTapp() {
  const base = 'https://web.cajalosandes.cl/api/content/spaces/wp-tapp-beneficios-copia';
  const perPage = 100;
  let page = 1;
  let totalPages = 1;
  const results = [];

  while (page <= totalPages) {
    const url = `${base}/types/beneficios/entries?per_page=${perPage}&page=${page}`;
    const response = await fetch(url, {
      headers: { 'user-agent': 'beneficios-finder/1.0' },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Tapp respondio ${response.status}: ${body.slice(0, 120)}`);
    }

    const data = await response.json();
    totalPages = data?.meta?.total_pages || 1;
    const entries = data?.entries || [];

    for (const item of entries) {
      const title = item?.meta?.name || '';
      const description = cleanText(item?.fields?.['Cuerpo'] || item?.fields?.['Bajada'] || '');
      const subtitle = cleanText(item?.fields?.['Bajada'] || '');
      const slug = item?.meta?.slug || '';
      const category = item?.meta?.category || 'beneficios';

      if (category.includes('finalizados')) {
        continue;
      }

      const url = slug
        ? `https://www.tapp.cl/beneficios/${category}/${slug}`
        : 'https://www.tapp.cl/beneficios';

      results.push({
        bank: 'Tapp',
        title: cleanText(title),
        subtitle,
        description,
        url,
        slug,
        commerceName: cleanText(item?.fields?.['Logo anunciante']?.title || title),
        keywords: cleanText(item?.fields?.['Tipo de beneficio'] || ''),
        tagsText: cleanText(item?.meta?.tags?.join(' ') || ''),
      });
    }

    page += 1;
    await sleep(100);
  }

  return results;
}

// Fecha de hoy (YYYY-MM-DD) en horario de Chile, para comparar vigencias sin desfases UTC.
const todayInChile = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

// Convierte "dd/mm/yyyy" (formato ACF de Copec Pay) a "yyyy-mm-dd". Devuelve '' si no es valida.
const parseDmyDate = (value) => {
  const match = (value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

const termNames = (terms) => (terms || []).map((t) => cleanText(t?.name)).filter(Boolean);

async function fetchCopec({ includeInactive = false } = {}) {
  // copecpay.cl/beneficios/ se renderiza en el cliente (js/beneficios-new.js), que pide
  // todos los beneficios de una vez a este endpoint REST propio del tema (sin paginacion).
  const url = 'https://copecpay.cl/wp-json/custom/v1/beneficios/';
  const response = await fetch(url, {
    headers: { 'user-agent': 'beneficios-finder/1.0', accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Copec Pay respondio ${response.status}: ${body.slice(0, 120)}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    const body = await response.text();
    throw new Error(`Copec Pay no devolvio JSON (${contentType}): ${body.slice(0, 120)}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Copec Pay devolvio un formato inesperado (se esperaba un arreglo)');
  }

  const today = todayInChile();
  const results = [];

  for (const item of data) {
    const acf = item?.acf || {};
    const tax = item?.taxonomies || {};
    const validFrom = parseDmyDate(acf.fecha_de_inicio);
    const validUntil = parseDmyDate(acf.fecha_de_termino);

    // Igual que el sitio: solo se publican beneficios con fechas y vigentes hoy.
    const isActive = Boolean(validFrom && validUntil && validFrom <= today && today <= validUntil);
    if (!includeInactive && !isActive) {
      continue;
    }

    const title = cleanText(item?.title);
    const mainDescription = cleanText(
      acf.descripcion_beneficio_principal || item?.descripcion_beneficio_principal,
    );
    const shortDescription = cleanText(
      acf.descripcion_corta_int_bene || item?.descripcion_corta_int_bene,
    );
    const commerceNames = termNames(tax.comercio);
    const categories = termNames(tax['categorias-beneficios']);
    const discounts = termNames(tax.descuento);
    const days = termNames(tax.dias);
    const channel =
      acf.tipo_de_descuento === 'personalizado' ? acf.etiqueta_personalizada : acf.tipo_de_descuento;

    results.push({
      bank: 'Copec Pay',
      title,
      subtitle: mainDescription,
      description: shortDescription || mainDescription,
      url: item?.link || 'https://copecpay.cl/beneficios/',
      slug: (item?.link || '').split('/').filter(Boolean).pop() || '',
      commerceName: commerceNames.join(', ') || title,
      category: categories.join(', '),
      validFrom,
      validUntil,
      keywords: cleanText([...categories, cleanText(channel)].join(' ')),
      tagsText: cleanText([...discounts, ...days].join(' ')),
    });
  }

  return results;
}

async function fetchBancoChile() {
  const seeds = [
    BANCHILE_BASE,
    `${BANCHILE_BASE}/panoramas`,
    `${BANCHILE_BASE}/panoramas/cine`,
    `${BANCHILE_BASE}/sabores`,
    `${BANCHILE_BASE}/delivery`,
    `${BANCHILE_BASE}/marcas`,
    `${BANCHILE_BASE}/promociones`,
    `${BANCHILE_BASE}/beneficios-del-dia`,
    `${BANCHILE_BASE}/campanas/big5-dto`,
  ];

  const visited = new Set();
  const queue = [...seeds];
  const detailMap = new Map();
  const maxPages = seeds.length;

  const fetchMarkdown = async (url, attempt = 1) => {
    const proxied = `${JINA_PROXY}${url.replace(/^https?:\/\//, '')}`;
    const response = await fetch(proxied, {
      headers: { 'user-agent': 'beneficios-finder/1.0' },
    });

    if (response.status === 429 && attempt < 5) {
      const retryAfter = Number(response.headers.get('retry-after')) || 8;
      await sleep(retryAfter * 1000);
      return fetchMarkdown(url, attempt + 1);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Banco de Chile respondio ${response.status}: ${body.slice(0, 120)}`);
    }

    return response.text();
  };

  const commerceFromSlug = (slug) => {
    const name = slug
      .split(/[-_]+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(' ')
      .trim();
    return toTitleCase(name) || slug;
  };

  let successfulPages = 0;
  let lastError = null;

  while (queue.length && visited.size < maxPages) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    let markdown = '';
    try {
      markdown = await fetchMarkdown(url);
      successfulPages += 1;
    } catch (err) {
      lastError = `Fallo ${url}: ${err.message}`;
      const slug = url.split('/').filter(Boolean).pop() || 'beneficios';
      const fallback = {
        bank: 'Banco de Chile',
        title: commerceFromSlug(slug),
        subtitle: '',
        description: commerceFromSlug(slug),
        url,
        slug,
        commerceName: commerceFromSlug(slug),
        keywords: commerceFromSlug(slug),
      };
      if (slug === 'big5-dto') {
        fallback.keywords = `${fallback.keywords} la fete dunkin mamut juan maestro tommy beans doggis kfc wendys dominos mcdonalds`;
        fallback.commerceName = 'Big5 Dto';
        fallback.description = `${fallback.description} La Fete, Dunkin, Mamut, Juan Maestro, Tommy Beans, Doggis, KFC, Wendy's, Domino's, McDonald's`.trim();
      }
      detailMap.set(url, fallback);
      continue;
    }

    const linkRegex =
      /\[([\s\S]*?)\]\((https?:\/\/sitiospublicos\.bancochile\.cl\/personas\/beneficios[^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(markdown)) !== null) {
      const rawText = match[1]
        .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
        .replace(/Conoce M.s/gi, ' ')
        .replace(/VER TODOS/gi, ' ');
      const text = cleanText(rawText);
      const link = match[2].split('#')[0];
      const textIsNav = /hazte cliente|banco en linea|ingresar|men[uú]/i.test(text);
      const normalizedText = textIsNav ? '' : text;

      if (!link.startsWith(BANCHILE_BASE)) {
        continue;
      }

      if (link.includes('/detalle/') || link.includes('/campanas/')) {
        const slug = link.split('/').filter(Boolean).pop() || '';

        if (!detailMap.has(link)) {
          const desc = normalizedText || commerceFromSlug(slug);
          const entry = {
            bank: 'Banco de Chile',
            title:
              normalizedText && normalizedText.length <= 140 ? normalizedText : commerceFromSlug(slug),
            subtitle: normalizedText && normalizedText.length > 140 ? truncate(desc, 180) : '',
            description: desc,
            url: link,
            slug,
            commerceName: commerceFromSlug(slug),
            keywords: normalizedText,
          };

          if (slug === 'big5-dto') {
            const extras =
              'la fete dunkin mamut juan maestro tommy beans doggis kfc wendys dominos mcdonalds';
            entry.keywords = `${entry.keywords || ''} ${extras}`.trim();
            entry.description = `${entry.description || ''} La Fete, Dunkin, Mamut, Juan Maestro, Tommy Beans, Doggis, KFC, Wendy's, Domino's, McDonald's`.trim();
          }

          detailMap.set(link, entry);
        }
      }
    }

    if (!detailMap.has(url)) {
      const slug = url.split('/').filter(Boolean).pop() || 'beneficios';
      const titleFromPage = (markdown.match(/^Title:\s*(.+)$/m) || [])[1];
      const title = cleanText(titleFromPage) || commerceFromSlug(slug);
      const descriptionStart = markdown.indexOf('Markdown Content:');
      const body =
        descriptionStart >= 0 ? markdown.slice(descriptionStart + 'Markdown Content:'.length) : markdown;
      const description = cleanText(body) || title;

      const baseEntry = {
        bank: 'Banco de Chile',
        title: title && title.length <= 140 ? title : commerceFromSlug(slug),
        subtitle: '',
        description,
        url,
        slug,
        commerceName: commerceFromSlug(slug),
        keywords: title,
      };

      if (slug === 'big5-dto') {
        const extras =
          'la fete dunkin mamut juan maestro tommy beans doggis kfc wendys dominos mcdonalds';
        baseEntry.keywords = `${baseEntry.keywords || ''} ${extras}`.trim();
        baseEntry.commerceName = 'Big5 Dto';
        baseEntry.description = `${baseEntry.description} La Fete, Dunkin, Mamut, Juan Maestro, Tommy Beans, Doggis, KFC, Wendy's, Domino's, McDonald's`.trim();
      }

      detailMap.set(url, baseEntry);
    }

    await sleep(800);
  }

  if (!detailMap.size && lastError && !successfulPages) {
    throw new Error(lastError);
  }

  return Array.from(detailMap.values());
}

async function fetchMercadoPago(query) {
  if (!query) return [];

  const encoded = encodeURIComponent(query);
  const url = `https://api.mercadolibre.com/sites/MLC/search?q=${encoded}&limit=50`;

  const extraHeaders = config.mercadoPagoToken
    ? { Authorization: `Bearer ${config.mercadoPagoToken}` }
    : {};

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'beneficios-finder/1.0',
      ...extraHeaders,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mercado Pago respondio ${response.status}: ${body.slice(0, 120)}`);
  }

  const data = await response.json();
  const items = data?.results || [];

  return items.map((item) => ({
    bank: 'Mercado Pago',
    title: item?.title || '',
    subtitle: item?.price ? `CLP ${item.price}` : '',
    description: cleanText(item?.subtitle || item?.title),
    url: item?.permalink || '',
    commerceName: cleanText(item?.seller?.nickname || ''),
    slug: item?.id || '',
    keywords: cleanText(item?.category_id || ''),
  }));
}

async function searchBenefits(query, { banks } = {}) {
  if (!query) {
    throw new Error('Falta la palabra a buscar');
  }

  const include = banks && banks.length ? new Set(banks.map((b) => b.toLowerCase())) : null;
  const shouldInclude = (name) => !include || include.has(name.toLowerCase());

  const jobs = [];

  if (shouldInclude('Santander')) jobs.push({ name: 'Santander', promise: fetchSantander() });
  if (shouldInclude('BCI')) jobs.push({ name: 'BCI', promise: fetchBci() });
  if (shouldInclude('Tenpo')) jobs.push({ name: 'Tenpo', promise: fetchTenpo() });
  if (shouldInclude('Tapp')) jobs.push({ name: 'Tapp', promise: fetchTapp() });
  if (shouldInclude('Copec Pay')) jobs.push({ name: 'Copec Pay', promise: fetchCopec() });
  if (shouldInclude('Banco de Chile'))
    jobs.push({ name: 'Banco de Chile', promise: fetchBancoChile() });
  if (shouldInclude('Mercado Pago'))
    jobs.push({ name: 'Mercado Pago', promise: fetchMercadoPago(query) });

  const settled = await Promise.allSettled(jobs.map((j) => j.promise));

  const datasets = [];
  const errors = [];

  settled.forEach((res, idx) => {
    const name = jobs[idx].name;
    if (res.status === 'fulfilled') {
      datasets.push(...res.value);
    } else {
      errors.push({ bank: name, message: res.reason?.message || 'Error desconocido' });
    }
  });

  const matches = datasets.filter((entry) => matchesQuery(entry, query));
  return { matches, errors };
}

module.exports = {
  searchBenefits,
  truncate,
  matchesQuery,
  fetchSantander,
  fetchBci,
  fetchTenpo,
  fetchTapp,
  fetchCopec,
  fetchBancoChile,
  fetchMercadoPago,
};
