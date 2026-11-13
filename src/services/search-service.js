// Orquestador de busqueda: consulta en paralelo los emisores seleccionados, tolera fallos
// individuales y filtra con el matcher. No conoce emisores concretos (solo el registro).
const { ValidationError } = require('../domain/errors');
const { matchesQuery } = require('./matcher');

/**
 * @typedef {object} SearchResult
 * @property {import('../domain/entry').Entry[]} matches  en orden de emisor y de la fuente
 * @property {{ bank: string, key: string, code: string, message: string }[]} errors  emisores caidos
 * @property {import('./source-status').SourceReport[]} sources  estado de cada emisor consultado
 */

/**
 * @param {object} deps
 * @param {ReturnType<import('../providers').createProviderRegistry>} deps.registry
 * @param {ReturnType<import('./provider-runner').createProviderRunner>} deps.runner
 */
function createSearchService({ registry, runner }) {
  /**
   * @param {string} query
   * @param {{ banks?: string[], allowKeys?: boolean, refresh?: boolean }} [options]
   *   refresh: vuelve a descargar los catalogos en cache que ya tienen la antiguedad minima
   * @returns {Promise<SearchResult>}
   */
  async function search(query, { banks, allowKeys = false, refresh = false } = {}) {
    if (!query) {
      throw new ValidationError('Falta la palabra a buscar', { code: 'MISSING_QUERY' });
    }

    const providers = registry.select(banks, { allowKeys });
    const reports = await Promise.all(providers.map((provider) => runner.run(provider, { refresh })));

    const matches = reports.flatMap((r) => r.entries).filter((entry) => matchesQuery(entry, query));
    const errors = reports
      .filter((r) => r.status === 'error')
      .map((r) => ({ bank: r.bank, key: r.key, code: r.error.code, message: r.error.message }));
    const sources = reports.map(({ entries, ...summary }) => summary);

    return { matches, errors, sources };
  }

  // Descarga (o renueva en cache) los catalogos completos. Util al iniciar el servidor y en
  // /v1/health?probe=true.
  async function warmUp() {
    const reports = await Promise.all(registry.list().map((provider) => runner.run(provider)));
    return reports.map(({ entries, ...summary }) => summary);
  }

  return { search, warmUp };
}

module.exports = { createSearchService };
