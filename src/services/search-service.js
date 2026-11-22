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
 * Intercala los catalogos: el 1.o de cada emisor, luego el 2.o de cada uno, etc. Asi cada pagina
 * de "todos los beneficios" mezcla emisores (en orden de emisor, las primeras ~26 paginas de 12
 * serian solo Santander). Es determinista: la paginacion es estable entre peticiones.
 * @param {import('../domain/entry').Entry[][]} lists
 */
function interleave(lists) {
  const out = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i += 1) {
    for (const list of lists) if (i < list.length) out.push(list[i]);
  }
  return out;
}

/**
 * @param {object} deps
 * @param {ReturnType<import('../providers').createProviderRegistry>} deps.registry
 * @param {ReturnType<import('./provider-runner').createProviderRunner>} deps.runner
 */
function createSearchService({ registry, runner }) {
  // Corre los emisores elegidos y separa entradas, errores y estado por fuente.
  async function collect({ banks, allowKeys, refresh }) {
    const providers = registry.select(banks, { allowKeys });
    const reports = await Promise.all(providers.map((provider) => runner.run(provider, { refresh })));
    const errors = reports
      .filter((r) => r.status === 'error')
      .map((r) => ({ bank: r.bank, key: r.key, code: r.error.code, message: r.error.message }));
    const sources = reports.map(({ entries, ...summary }) => summary);
    return { reports, errors, sources };
  }

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
    const { reports, errors, sources } = await collect({ banks, allowKeys, refresh });
    const matches = reports.flatMap((r) => r.entries).filter((entry) => matchesQuery(entry, query));
    return { matches, errors, sources };
  }

  /**
   * Todos los beneficios de los emisores elegidos, sin filtrar por texto, intercalados por emisor.
   * @param {{ banks?: string[], allowKeys?: boolean, refresh?: boolean }} [options]
   * @returns {Promise<SearchResult>}
   */
  async function listAll({ banks, allowKeys = false, refresh = false } = {}) {
    const { reports, errors, sources } = await collect({ banks, allowKeys, refresh });
    return { matches: interleave(reports.map((r) => r.entries)), errors, sources };
  }

  // Descarga los catalogos que no estan en cache (los que estan se reutilizan). Util al iniciar el
  // servidor (carga inicial) y en /v1/health?probe=true.
  async function warmUp() {
    const reports = await Promise.all(registry.list().map((provider) => runner.run(provider)));
    return reports.map(({ entries, ...summary }) => summary);
  }

  // Actualizacion programada (ADR 0024): vuelve a descargar TODOS los catalogos, aunque esten en
  // cache y sean recientes (force: sin la antiguedad minima del refresh manual). Si un emisor
  // falla, conserva su catalogo anterior.
  async function refreshAll() {
    const reports = await Promise.all(registry.list().map((provider) => runner.run(provider, { refresh: true, force: true })));
    return reports.map(({ entries, ...summary }) => summary);
  }

  return { search, listAll, warmUp, refreshAll };
}

module.exports = { createSearchService, interleave };
