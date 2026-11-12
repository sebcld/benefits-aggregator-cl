// Smoke test EN VIVO (requiere internet y .env): cada caso de aceptacion contra la fuente real.
// Uso: npm run smoke    Sale con codigo 1 si algun caso falla.
const { createApp } = require('../../src/bootstrap');
const { ACCEPTANCE_CASES } = require('../helpers/constants');

async function main() {
  const app = createApp({ defaultLogLevel: 'silent', cache: undefined });
  let failures = 0;

  for (const [bank, query, expected] of ACCEPTANCE_CASES) {
    const started = Date.now();
    const { matches, errors, sources } = await app.searchService.search(query, { banks: [bank] });
    const hit = matches.find((m) => m.bank === bank && expected.test(m.title));
    const source = sources[0] || {};
    const ms = Date.now() - started;

    if (hit) {
      console.log(`OK    ${bank} "${query}" -> "${hit.title}" (${source.count} registros, ${ms} ms${source.cached ? ', cache' : ''})`);
    } else {
      failures += 1;
      const why = errors.length ? errors.map((e) => `${e.code}: ${e.message}`).join('; ') : `${matches.length} coincidencias sin el esperado`;
      console.log(`FALLA ${bank} "${query}" -> ${why}`);
    }
  }

  console.log(failures ? `\n${failures} caso(s) fallaron` : '\nTodos los casos pasaron');
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
