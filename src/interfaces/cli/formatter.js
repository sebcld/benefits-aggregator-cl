// Formato de texto del CLI (puro). Debe producir exactamente la salida historica.
const { truncate } = require('../../shared/text');

// "2026-08-01 al 2026-11-30" (formato historico), "hasta 2027-02-28" o "desde 2026-01-01".
function formatValidity({ validFrom, validUntil }) {
  if (validFrom && validUntil) return `${validFrom} al ${validUntil}`;
  if (validUntil) return `hasta ${validUntil}`;
  if (validFrom) return `desde ${validFrom}`;
  return '';
}

// Lineas de stdout para los resultados de una busqueda.
function formatResults(query, results) {
  if (!results.length) {
    return [`No se encontraron beneficios que contengan "${query}".`];
  }

  const lines = [`Coincidencias para "${query}":`];
  const banks = Array.from(new Set(results.map((r) => r.bank)));

  for (const bank of banks) {
    const items = results.filter((r) => r.bank === bank);
    lines.push('', `${bank} (${items.length})`);

    for (const item of items) {
      if (item.commerceName) {
        const header = `COMERCIO: ${item.commerceName}`;
        lines.push(header, '-'.repeat(header.length));
      }

      lines.push(`- ${item.subtitle ? `${item.title} - ${item.subtitle}` : item.title}`);
      if (item.description) lines.push(`  ${truncate(item.description)}`);
      const validity = formatValidity(item);
      if (validity) lines.push(`  Vigencia: ${validity}`);
      if (item.url) lines.push(`  ${item.url}`);
      if (item.bank === 'BCI' && item.slug) lines.push(`  slug: ${item.slug}`);
    }
  }

  return lines;
}

// Lineas de stderr para los emisores no disponibles.
const formatErrors = (errors) => errors.map((err) => `${err.bank} no disponible: ${err.message}`);

module.exports = { formatResults, formatErrors };
