// Precarga para procesos hijo (CLI y servidor) en los tests de caracterizacion:
//   node -r ./tests/helpers/preload.js src/index.js "rappi"
// Reemplaza fetch por los fixtures grabados, congela la fecha y acelera las pausas entre paginas.
// Sirve igual para el codigo original y para el refactorizado, porque no depende de sus modulos.
const { createReplayFetch } = require('./replay-fetch');
const { FIXED_NOW } = require('./constants');

globalThis.fetch = createReplayFetch();

const RealDate = Date;
const fixedMs = new RealDate(process.env.TEST_NOW || FIXED_NOW).getTime();

class FrozenDate extends RealDate {
  constructor(...args) {
    if (args.length) super(...args);
    else super(fixedMs);
  }

  static now() {
    return fixedMs;
  }
}

globalThis.Date = FrozenDate;

// Las pausas de cortesia entre paginas (>= 100 ms) se vuelven inmediatas.
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, ms >= 100 ? 0 : ms, ...args);
