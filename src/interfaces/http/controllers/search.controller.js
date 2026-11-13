// Controladores de busqueda: validan entrada, llaman al servicio y serializan la salida.
const { parseLegacySearch, parseV1Search, parseV1Listing, v1InputFromQueryString } = require('../validation');
const { toLegacySearchResponse, toV1SearchResponse, toV1BenefitsResponse } = require('../serializers');

/**
 * @param {object} deps
 * @param {{ search: Function }} deps.searchService
 * @param {ReturnType<import('../../../providers').createProviderRegistry>} deps.registry
 * @param {() => Date} deps.clock
 */
function createSearchController({ searchService, registry, clock }) {
  const keyForBank = (bankName) => registry.find(bankName)?.key || null;

  async function runLegacy({ query, banks }) {
    const result = await searchService.search(query, { banks });
    return { status: 200, body: toLegacySearchResponse(result) };
  }

  async function runV1(input) {
    const { query, banks, page, pageSize, refresh } = parseV1Search(input, registry);
    const result = await searchService.search(query, { banks, allowKeys: true, refresh });
    return {
      status: 200,
      body: toV1SearchResponse({ query, result, page, pageSize, keyForBank, now: clock() }),
    };
  }

  return {
    // GET /v1/benefits?banks=&page=&pageSize=&refresh=true: todos, sin consulta.
    v1ListAll: async ({ url }) => {
      const input = v1InputFromQueryString(url.searchParams);
      const { banks, page, pageSize, refresh } = parseV1Listing(input, registry);
      const result = await searchService.listAll({ banks, allowKeys: true, refresh });
      const body = toV1BenefitsResponse({ result, page, pageSize, keyForBank, now: clock() });
      return { status: 200, body };
    },

    // GET /search?q=&banks=
    legacyGet: ({ url }) =>
      runLegacy(
        parseLegacySearch(
          { query: url.searchParams.get('q'), banks: url.searchParams.get('banks') },
          { missingMessage: 'Falta el parametro q' },
        ),
      ),

    // POST /search { query, banks }
    legacyPost: async ({ readJson }) => {
      const body = await readJson();
      return runLegacy(parseLegacySearch(body, { missingMessage: 'Falta el campo query' }));
    },

    // GET /v1/search?q=&banks=&page=&pageSize=&refresh=true
    v1Get: ({ url }) => runV1(v1InputFromQueryString(url.searchParams)),

    // POST /v1/search { query, banks, page, pageSize, refresh }
    v1Post: async ({ readJson }) => runV1(await readJson()),
  };
}

module.exports = { createSearchController };
