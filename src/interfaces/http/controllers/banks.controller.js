// GET /v1/banks: emisores disponibles, para poblar filtros en la app.

function createBanksController({ registry }) {
  return {
    list: async () => ({
      status: 200,
      body: {
        banks: registry.list().map((p) => ({
          key: p.key,
          name: p.name,
          // Todos los emisores descargan su catalogo. El campo se mantiene por compatibilidad de la API.
          searchMode: 'catalog',
        })),
      },
    }),
  };
}

module.exports = { createBanksController };
