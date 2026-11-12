const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
// timers.setTimeout no lo altera preload.js (que acelera globalThis.setTimeout).
const { setTimeout: realSetTimeout } = require('timers');
const { ROOT, TEST_ENV } = require('./constants');

const PRELOAD = path.join(ROOT, 'tests', 'helpers', 'preload.js');

const childEnv = (extra = {}) => ({ ...process.env, ...TEST_ENV, ...extra });

// Ejecuta un script con fetch simulado y devuelve { code, stdout, stderr }.
function runScript(script, args = [], extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-r', PRELOAD, script, ...args], {
      cwd: ROOT,
      env: childEnv(extraEnv),
    });
    let stdout = '';
    let stderr = '';
    // setEncoding evita cortar caracteres UTF-8 multibyte entre chunks.
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

const runCli = (args, extraEnv) => runScript('src/index.js', args, extraEnv);

// Resultado de la API publica de src/benefits.js contra los fixtures.
async function dumpFacade() {
  const { code, stdout, stderr } = await runScript('tests/helpers/facade-dump.js');
  if (code !== 0) throw new Error(`facade-dump fallo (${code}): ${stderr}`);
  return JSON.parse(stdout);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Levanta src/server.js con fetch simulado. Resuelve cuando imprime que esta escuchando.
async function startServer(extraEnv) {
  const port = await freePort();
  const child = spawn(process.execPath, ['-r', PRELOAD, 'src/server.js'], {
    cwd: ROOT,
    env: childEnv({ PORT: String(port), ...extraEnv }),
  });

  await new Promise((resolve, reject) => {
    const timer = realSetTimeout(() => reject(new Error('El servidor no inicio a tiempo')), 10000);
    child.stdout.on('data', (d) => {
      if (String(d).includes('escuchando')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`El servidor termino con codigo ${code}`)));
  });

  const stop = () =>
    new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', () => resolve());
      child.kill();
    });

  return { port, stop };
}

// Peticion HTTP simple: devuelve { status, headers, body } con el body parseado si es JSON.
function request(port, { method = 'GET', path: urlPath, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (raw += d));
      res.on('end', () => {
        let parsed = raw;
        try {
          parsed = raw ? JSON.parse(raw) : raw;
        } catch {
          // body no JSON
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

module.exports = { runScript, runCli, dumpFacade, startServer, request, PRELOAD };
