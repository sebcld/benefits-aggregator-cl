// Genera las salidas de referencia (golden) a partir de los fixtures HTTP, sin internet.
// Volver a ejecutarlo solo si se cambian los fixtures o el comportamiento A PROPOSITO:
//   npm run fixtures:golden
// tests/fixtures/golden-original/ se genero con este mismo script sobre el codigo original
// (commit f8352c7) y NO se regenera: es la referencia de equivalencia del refactor.
const fs = require('fs');
const path = require('path');
const { GOLDEN_DIR, ALL_QUERIES: QUERIES } = require('../helpers/constants');
const { LEGACY_HTTP_CASES } = require('../helpers/cases');
const { runCli, dumpFacade, startServer, request } = require('../helpers/processes');

const write = (name, data) => {
  fs.writeFileSync(path.join(GOLDEN_DIR, name), `${JSON.stringify(data, null, 1)}\n`);
  console.log(`golden/${name}`);
};

async function main() {
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });

  const { providers, search } = await dumpFacade();
  write('providers.json', providers);
  write('search.json', search);

  const cli = {};
  for (const query of QUERIES) cli[query] = await runCli([query]);
  cli['(sin argumentos)'] = await runCli([]);
  write('cli.json', cli);

  const server = await startServer();
  const httpLegacy = {};
  try {
    for (const [name, req] of LEGACY_HTTP_CASES) {
      const res = await request(server.port, req);
      httpLegacy[name] = {
        status: res.status,
        contentType: res.headers['content-type'],
        body: res.body,
      };
    }
  } finally {
    await server.stop();
  }
  write('http-legacy.json', httpLegacy);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
