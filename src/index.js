const { searchBenefits, truncate } = require('./benefits');

function printResults(query, results) {
  if (!results.length) {
    console.log(`No se encontraron beneficios que contengan "${query}".`);
    return;
  }

  console.log(`Coincidencias para "${query}":`);
  const banks = Array.from(new Set(results.map((r) => r.bank)));

  for (const bank of banks) {
    const items = results.filter((r) => r.bank === bank);
    console.log(`\n${bank} (${items.length})`);

    for (const item of items) {
      if (item.commerceName) {
        const header = `COMERCIO: ${item.commerceName}`;
        console.log(header);
        console.log('-'.repeat(header.length));
      }

      const line = item.subtitle ? `${item.title} - ${item.subtitle}` : item.title;
      console.log(`- ${line}`);
      if (item.description) {
        console.log(`  ${truncate(item.description)}`);
      }
      if (item.validFrom || item.validUntil) {
        console.log(`  Vigencia: ${item.validFrom || '?'} al ${item.validUntil || '?'}`);
      }
      if (item.url) {
        console.log(`  ${item.url}`);
      }
      if (item.bank === 'BCI' && item.slug) {
        console.log(`  slug: ${item.slug}`);
      }
    }
  }
}

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Uso: node src/index.js "burger king"');
    process.exit(1);
  }

  try {
    const { matches, errors } = await searchBenefits(query);
    errors.forEach((err) => console.error(`${err.bank} no disponible: ${err.message}`));
    printResults(query, matches);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
