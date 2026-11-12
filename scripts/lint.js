// Lint sin dependencias: sintaxis + reglas de arquitectura del proyecto. Uso: npm run lint
// (ESLint/Prettier estan propuestos en docs/ARQUITECTURA.md; requieren aprobar devDependencies.)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MAX_LINES = 200;

// Archivos de "dir" (recursivo) con alguna de las extensiones dadas. Omite fixtures y node_modules.
const listFiles = (dir, extensions) =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = path.posix.join(dir, d.name);
    if (d.isDirectory()) {
      return d.name === 'fixtures' || d.name === 'node_modules' ? [] : listFiles(rel, extensions);
    }
    return extensions.some((ext) => d.name.endsWith(ext)) ? [rel] : [];
  });

const listJs = (dir) => listFiles(dir, ['.js']);

// Codigo sin comentarios (las reglas de codigo no deben dispararse por la documentacion).
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

const requiresOf = (source) => [...source.matchAll(/require\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
const layerOf = (file) => (file.match(/^src\/([^/]+)\//) || [])[1] || 'root';

// Capas que cada capa NO puede importar (las dependencias apuntan hacia el dominio).
const FORBIDDEN_IMPORTS = {
  domain: ['config', 'shared', 'providers', 'services', 'interfaces'],
  shared: ['providers', 'services', 'interfaces'],
  config: ['providers', 'services', 'interfaces'],
  providers: ['services', 'interfaces', 'config'],
  services: ['providers', 'interfaces', 'config'],
};

const RULES = [
  {
    name: `maximo ${MAX_LINES} lineas por modulo`,
    applies: (f) => f.startsWith('src/'),
    check: (src) => src.split('\n').length <= MAX_LINES,
  },
  {
    name: 'process.env solo en src/config',
    applies: (f) => f.startsWith('src/') && !f.startsWith('src/config/'),
    check: (src) => !/process\.env/.test(stripComments(src)),
  },
  {
    name: 'fetch global solo en src/shared/http-client.js',
    applies: (f) => f.startsWith('src/') && f !== 'src/shared/http-client.js',
    check: (src) =>
      stripComments(src)
        .split('\n')
        .every((line) => line.includes('async fetch(') || !/(^|[^.\w])fetch\(/.test(line)),
  },
  {
    name: 'sin llaves o tokens escritos en el codigo',
    applies: (f) => f.startsWith('src/') || f.startsWith('docs/'),
    check: (src) => !/['"=:\s][0-9a-f]{32}['"\s]/.test(src),
  },
  {
    name: 'dependencias entre capas',
    applies: (f) => FORBIDDEN_IMPORTS[layerOf(f)],
    check: (src, file) =>
      requiresOf(src)
        .filter((r) => r.startsWith('.'))
        .map((r) => layerOf(path.posix.join(path.posix.dirname(file), r) + '/'))
        .every((target) => !FORBIDDEN_IMPORTS[layerOf(file)].includes(target)),
  },
];

const files = [...listJs('src'), ...listJs('tests'), ...listJs('scripts')];
// Toda la documentacion, incluidas subcarpetas (docs/arquitectura, docs/adr).
const docs = listFiles('docs', ['.md', '.yaml', '.yml']);
const problems = [];

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, file)], { stdio: 'pipe' });
  } catch (err) {
    problems.push(`${file}: error de sintaxis\n${String(err.stderr).trim()}`);
  }
}

for (const file of [...files, ...docs]) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const rule of RULES) {
    if (rule.applies(file) && !rule.check(source, file)) problems.push(`${file}: ${rule.name}`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problema(s)`);
  process.exitCode = 1;
} else {
  console.log(`lint OK (${files.length} archivos JS, ${docs.length} documentos)`);
}
