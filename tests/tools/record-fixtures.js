// Graba respuestas REALES de cada emisor en tests/fixtures/http/<emisor>.json. Requiere internet.
//   npm run fixtures:record                       (todos)
//   npm run fixtures:record -- bancochile tenpo   (solo esos)
// No guarda headers de la peticion (la llave de BCI viaja en un header), solo URL y respuesta.
// Despues de grabar, regenerar los golden: npm run fixtures:golden
const fs = require('fs');
const path = require('path');
const { HTTP_FIXTURES_DIR } = require('../helpers/constants');

const KEPT_HEADERS = ['content-type', 'retry-after'];

// Banco de Chile entrega ~4.6 MB; se guardan solo los campos que usa el parser.
const BCH_META = ['name', 'slug', 'uuid', 'tags', 'category_name', 'unpublish_at'];
const BCH_FIELDS = ['Titulo', 'Extracto', 'Descripcion', 'Keywords', 'Tipo Beneficio'];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in (obj || {})).map((k) => [k, obj[k]]));
// Tapp finalizados (solo para tests de busqueda): los campos que usa el parser de Tapp.
const TAPP_META = ['name', 'slug', 'uuid', 'category', 'tags'];
const TAPP_FIELDS = ['Bajada', 'Cuerpo', 'Tipo de beneficio', 'Tipo de cliente', 'Regiones'];
const TRIMMERS = {
  'tapp-finalizados': (json) => ({
    meta: json.meta,
    entries: json.entries.map((e) => {
      const logo = e.fields?.['Logo anunciante'];
      return {
        meta: pick(e.meta, TAPP_META),
        fields: { ...pick(e.fields, TAPP_FIELDS), 'Logo anunciante': logo ? { url: logo.url, title: logo.title } : null },
      };
    }),
  }),
  bancochile: (json) => ({
    meta: json.meta,
    entries: json.entries.map((e) => ({
      meta: pick(e.meta, BCH_META),
      fields: { ...pick(e.fields, BCH_FIELDS), Logo: e.fields?.Logo ? { url: e.fields.Logo.url } : null },
    })),
  }),
};

// Respuestas de texto (HTML) que se recortan a lo que usa el parser.
// Mercado Pago: de cada landing (~150 KB) solo el script con el estado incrustado; de los
// terminos (~40 KB), solo el texto visible.
// Entel: de la lista (~860 KB) solo las tarjetas (con su <swiper-slide>, que trae los dias); de
// cada ficha (~260 KB) solo el modal de condiciones.
const ENTEL_CARD = /(?:<swiper-slide\b[^>]*>\s*)?<ads-card-general\b[^>]*>[\s\S]*?<\/ads-card-general>/g;
const ENTEL_TERMS = /<andino-modal-passive\b[^>]*eds-title=(["'])Información del beneficio\1[^>]*>[\s\S]*?<\/andino-modal-passive>/;
const TEXT_TRIMMERS = {
  mercadopago: (url, text) =>
    /\/terms\/html$/.test(url)
      ? `<html><body>${require('../../src/shared/text').cleanText(text)}</body></html>`
      : (text.match(/<script\b[^>]*>\s*_n\.ctx\.s\["nr"\]\.q\([\s\S]*?<\/script>/g) || []).join('\n'),
  entel: (url, text) =>
    url === require('../../src/providers/entel.provider').LIST_URL
      ? (text.match(ENTEL_CARD) || []).join('\n')
      : (text.match(ENTEL_TERMS) || [''])[0],
};

const realFetch = globalThis.fetch;
const recorded = new Map(); // emisor -> Map(url -> record)
let current = null;

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const response = await realFetch(input, init);
  const text = await response.clone().text();

  // Los 429 (rate limit) no se guardan: se reintenta y se guarda la respuesta final.
  if (response.status !== 429) {
    const headers = {};
    for (const name of KEPT_HEADERS) {
      const value = response.headers.get(name);
      if (value) headers[name] = value;
    }

    const record = { url, status: response.status, headers };
    try {
      const json = JSON.parse(text);
      record.json = TRIMMERS[current] ? TRIMMERS[current](json) : json;
    } catch {
      record.text = TEXT_TRIMMERS[current] ? TEXT_TRIMMERS[current](url, text) : text;
    }
    recorded.get(current).set(url, record);
  }

  return response;
};

const benefits = require('../../src/benefits');
const tapp = require('../../src/providers/tapp.provider');

// Beneficios finalizados de Tapp, SOLO para probar la busqueda en tests con datos reales.
// La API nunca los pide (tapp.provider.js descarga solo las categorias vigentes).
async function recordTappFinished() {
  for (const category of ['beneficios-finalizados', 'convenios-finalizados']) {
    for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
      const json = await (await fetch(tapp.entriesUrl(category, page))).json();
      totalPages = json?.meta?.total_pages || 1;
    }
  }
}

const JOBS = {
  santander: () => benefits.fetchSantander(),
  bci: () => benefits.fetchBci(),
  tenpo: () => benefits.fetchTenpo(),
  tapp: () => benefits.fetchTapp(),
  'tapp-finalizados': recordTappFinished,
  copec: () => benefits.fetchCopec(),
  bancochile: () => benefits.fetchBancoChile(),
  mercadopago: () => benefits.fetchMercadoPago(),
  entel: () => benefits.fetchEntel(),
};

async function main() {
  const selected = process.argv.slice(2);
  const unknown = selected.filter((key) => !JOBS[key]);
  if (unknown.length) throw new Error(`Emisores desconocidos: ${unknown.join(', ')}`);

  fs.mkdirSync(HTTP_FIXTURES_DIR, { recursive: true });

  for (const key of selected.length ? selected : Object.keys(JOBS)) {
    current = key;
    recorded.set(key, new Map());
    try {
      await JOBS[key]();
    } catch (err) {
      console.error(`${key}: ${err.message}`);
    }

    const records = Array.from(recorded.get(key).values());
    const file = path.join(HTTP_FIXTURES_DIR, `${key}.json`);
    const payload = { recordedAt: new Date().toISOString(), trimmed: Boolean(TRIMMERS[key]), records };
    fs.writeFileSync(file, `${JSON.stringify(payload, null, 1)}\n`);
    console.log(`${key}: ${records.length} respuestas -> ${path.relative(process.cwd(), file)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
