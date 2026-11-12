// Ejecuta la API publica de src/benefits.js contra los fixtures e imprime el resultado en JSON.
// Se corre en un proceso hijo con preload.js: node -r tests/helpers/preload.js tests/helpers/facade-dump.js
const { SEARCH_CASES } = require('./cases');
const benefits = require('../../src/benefits');

async function main() {
  const providers = {
    santander: await benefits.fetchSantander(),
    bci: await benefits.fetchBci(),
    tenpo: await benefits.fetchTenpo(),
    tapp: await benefits.fetchTapp(),
    copec: await benefits.fetchCopec(),
    copecIncludeInactive: await benefits.fetchCopec({ includeInactive: true }),
    bancochile: await benefits.fetchBancoChile(),
  };

  const search = {};
  for (const [name, query, options] of SEARCH_CASES) {
    search[name] = await benefits.searchBenefits(query, options);
  }

  process.stdout.write(JSON.stringify({ providers, search }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
