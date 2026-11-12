// Copec Pay: copecpay.cl/beneficios/ se renderiza en el cliente (js/beneficios-new.js), que pide
// todos los beneficios de una vez a este endpoint REST propio del tema (sin paginacion).
const { defineProvider } = require('./provider.interface');
const { createEntry } = require('../domain/entry');
const { ProviderError } = require('../domain/errors');
const { cleanText } = require('../shared/text');
const { todayInChile, parseDmyDate, isWithinRange } = require('../shared/dates');

const NAME = 'Copec Pay';
const URL = 'https://copecpay.cl/wp-json/custom/v1/beneficios/';

const termNames = (terms) => (terms || []).map((t) => cleanText(t?.name)).filter(Boolean);

// Convierte un registro del endpoint en Entry. No filtra por vigencia.
function parseCopecItem(item) {
  const acf = item?.acf || {};
  const tax = item?.taxonomies || {};
  const title = cleanText(item?.title);
  const mainDescription = cleanText(
    acf.descripcion_beneficio_principal || item?.descripcion_beneficio_principal,
  );
  const shortDescription = cleanText(acf.descripcion_corta_int_bene || item?.descripcion_corta_int_bene);
  const commerceNames = termNames(tax.comercio);
  const categories = termNames(tax['categorias-beneficios']);
  const discounts = termNames(tax.descuento);
  const days = termNames(tax.dias);
  const channel =
    acf.tipo_de_descuento === 'personalizado' ? acf.etiqueta_personalizada : acf.tipo_de_descuento;

  return createEntry(
    {
      bank: NAME,
      title,
      subtitle: mainDescription,
      description: shortDescription || mainDescription,
      url: item?.link || 'https://copecpay.cl/beneficios/',
      slug: (item?.link || '').split('/').filter(Boolean).pop() || '',
      commerceName: commerceNames.join(', ') || title,
      category: categories.join(', '),
      validFrom: parseDmyDate(acf.fecha_de_inicio),
      validUntil: parseDmyDate(acf.fecha_de_termino),
      keywords: cleanText([...categories, cleanText(channel)].join(' ')),
      tagsText: cleanText([...discounts, ...days].join(' ')),
    },
    { sourceId: item?.id, logo: tax.comercio?.[0]?.image || item?.featured_image },
  );
}

// Igual que el sitio: solo se publican beneficios con fechas y vigentes hoy (hora de Chile).
function parseCopec(data, { today, includeInactive = false }) {
  if (!Array.isArray(data)) {
    throw new ProviderError('Copec Pay devolvio un formato inesperado (se esperaba un arreglo)', {
      code: 'INVALID_RESPONSE',
    });
  }

  return data
    .map(parseCopecItem)
    .filter((entry) => includeInactive || isWithinRange(today, entry.validFrom, entry.validUntil));
}

const provider = defineProvider({
  key: 'copec',
  name: NAME,
  async fetch({ http, now, signal, options = {} }) {
    const response = await http.ensureOk(
      await http.request(URL, { label: NAME, signal, headers: { accept: 'application/json' } }),
      NAME,
    );

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      const body = await response.text();
      throw new ProviderError(`Copec Pay no devolvio JSON (${contentType}): ${body.slice(0, 120)}`, {
        code: 'INVALID_RESPONSE',
      });
    }

    const data = await response.json();
    return parseCopec(data, { today: todayInChile(now()), includeInactive: options.includeInactive });
  },
});

module.exports = { provider, parseCopec, parseCopecItem };
