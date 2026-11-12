// GET /v1/banks: emisores disponibles, para poblar filtros en la app.

function createBanksController({ registry }) {
  return {
    list: async () => ({
      status: 200,
      body: {
        banks: registry.list().map((p) => ({
          key: p.key,
          name: p.name,
          searchMode: p.queryDependent ? 'query' : 'catalog',
        })),
      },
    }),
  };
}

module.exports = { createBanksController };
