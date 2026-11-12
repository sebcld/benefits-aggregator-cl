// CLI: node src/index.js "<texto>". Devuelve el codigo de salida; no llama a process.exit.
const { formatResults, formatErrors } = require('./formatter');

const USAGE = 'Uso: node src/index.js "burger king"';

const writeLines = (stream, lines) => {
  if (lines.length) stream.write(`${lines.join('\n')}\n`);
};

/**
 * @param {string[]} args argumentos posteriores al script
 * @param {object} deps
 * @param {() => { searchService: object }} deps.createApp se llama solo si hay consulta
 * @param {NodeJS.WritableStream} [deps.stdout]
 * @param {NodeJS.WritableStream} [deps.stderr]
 * @returns {Promise<number>}
 */
async function runCli(args, { createApp, stdout = process.stdout, stderr = process.stderr }) {
  const query = args.join(' ').trim();
  if (!query) {
    writeLines(stderr, [USAGE]);
    return 1;
  }

  try {
    const { searchService } = createApp();
    const { matches, errors } = await searchService.search(query);
    writeLines(stderr, formatErrors(errors));
    writeLines(stdout, formatResults(query, matches));
    return 0;
  } catch (err) {
    writeLines(stderr, [`Error: ${err.message}`]);
    return 1;
  }
}

module.exports = { runCli, USAGE };
