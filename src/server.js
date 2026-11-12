const http = require('http');
const config = require('./config');
const { searchBenefits } = require('./benefits');

const PORT = config.port;

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Body demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON invalido'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  const json = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json),
  });
  res.end(json);
}

function parseBanks(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url.startsWith('/health')) {
      return send(res, 200, { status: 'ok' });
    }

    if (req.method === 'GET' && req.url.startsWith('/search')) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const query = (url.searchParams.get('q') || '').trim();
      const banks = parseBanks(url.searchParams.get('banks'));

      if (!query) {
        return send(res, 400, { error: 'Falta el parametro q' });
      }

      const { matches, errors } = await searchBenefits(query, { banks });
      return send(res, 200, { matches, errors });
    }

    if (req.method === 'POST' && req.url.startsWith('/search')) {
      const body = await parseJson(req);
      const query = (body.query || '').trim();
      const banks = parseBanks(body.banks);

      if (!query) {
        return send(res, 400, { error: 'Falta el campo query' });
      }

      const { matches, errors } = await searchBenefits(query, { banks });
      return send(res, 200, { matches, errors });
    }

    send(res, 404, { error: 'No encontrado' });
  } catch (err) {
    console.error('Server error', err);
    send(res, 500, { error: err.message || 'Error interno' });
  }
});

server.listen(PORT, () => {
  console.log(`API de beneficios escuchando en http://localhost:${PORT}`);
});
