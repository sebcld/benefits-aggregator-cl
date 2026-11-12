// Router minimo con coincidencia EXACTA de metodo + ruta (sin prefijos ni comodines).
const { notFound, methodNotAllowed } = require('./http-error');

/**
 * @typedef {object} Route
 * @property {string} method
 * @property {string} path            ruta exacta, sin query string
 * @property {'legacy'|'v1'} api      formato de errores a usar
 * @property {(ctx: object) => Promise<{ status: number, body: any, headers?: object }>} handler
 */

/** @param {Route[]} routes */
function createRouter(routes) {
  const byPath = new Map();
  for (const route of routes) {
    const methods = byPath.get(route.path) || new Map();
    if (methods.has(route.method)) throw new Error(`Ruta duplicada: ${route.method} ${route.path}`);
    methods.set(route.method, route);
    byPath.set(route.path, methods);
  }

  // Formato de error para rutas desconocidas: v1 si el prefijo lo indica, si no el legado.
  const apiFor = (pathname) => (pathname === '/v1' || pathname.startsWith('/v1/') ? 'v1' : 'legacy');

  // Devuelve { route } o { error, api }. Las rutas legadas responden 404 a metodos no
  // soportados (comportamiento historico); las v1 responden 405 con header Allow.
  function match(method, pathname) {
    const methods = byPath.get(pathname);
    if (!methods) return { error: notFound(), api: apiFor(pathname) };

    const route = methods.get(method);
    if (route) return { route };

    const api = [...methods.values()][0].api;
    return { error: api === 'v1' ? methodNotAllowed([...methods.keys()]) : notFound(), api };
  }

  return { match };
}

module.exports = { createRouter };
