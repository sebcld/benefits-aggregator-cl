// Fachada de compatibilidad: misma API publica que la version original (1.0.0).
// Codigo nuevo: usar createApp() de ./bootstrap y searchService. Ver docs/ARQUITECTURA.md.
//
// Semantica conservada: sin cache (cada llamada consulta las fuentes), sin timeouts, errores con
// el mensaje historico y Entries en su forma historica (sin "id" ni "logo").
const { createApp } = require('./bootstrap');
const { toLegacyEntry } = require('./domain/entry');
const { truncate } = require('./shared/text');
const { matchesQuery } = require('./services/matcher');

let app = null;
// Se crea en la primera llamada (importar este modulo no lee .env ni hace nada mas).
const getApp = () => {
  app = app || createApp({ defaultLogLevel: 'silent', cache: null, timeouts: false });
  return app;
};

const legacy = (entries) => entries.map(toLegacyEntry);

async function fetchByKey(key, extra) {
  const { registry, runner } = getApp();
  const { entries } = await runner.fetchEntries(registry.get(key), extra);
  return legacy(entries);
}

const fetchSantander = () => fetchByKey('santander');
const fetchBci = () => fetchByKey('bci');
const fetchTenpo = () => fetchByKey('tenpo');
const fetchTapp = () => fetchByKey('tapp');
const fetchCopec = ({ includeInactive = false } = {}) =>
  fetchByKey('copec', { options: { includeInactive } });
const fetchBancoChile = () => fetchByKey('bancochile');
const fetchMercadoPago = (query) => fetchByKey('mercadopago', { query });

// Devuelve { matches, errors } con errors = [{ bank, message }], como la version original.
async function searchBenefits(query, { banks } = {}) {
  if (!query) {
    throw new Error('Falta la palabra a buscar');
  }
  const { matches, errors } = await getApp().searchService.search(query, { banks });
  return {
    matches: legacy(matches),
    errors: errors.map(({ bank, message }) => ({ bank, message })),
  };
}

module.exports = {
  searchBenefits,
  truncate,
  matchesQuery,
  fetchSantander,
  fetchBci,
  fetchTenpo,
  fetchTapp,
  fetchCopec,
  fetchBancoChile,
  fetchMercadoPago,
};
