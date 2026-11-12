// Exporta las variables del archivo de diseno a src/styles/tokens.css.
// Reemplaza a "variable.export" del conector de FigCraft: lee las colecciones Color (Light/Dark),
// Espaciado y Radio, mas el estilo de efecto "Sombra/Elevada".
// Uso: npm run design:tokens   (el archivo generado se versiona; no editarlo a mano)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readDesign, toCssColor } from './figcraft.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../src/styles/tokens.css');

const doc = readDesign();
const { collections, variables } = doc.variables;
const byName = (name) => {
  const c = collections.find((col) => col.name === name);
  if (!c) throw new Error(`Falta la coleccion "${name}" en el diseno`);
  return c;
};

const color = byName('Color');
const light = color.modes.find((m) => m.name === 'Light');
const dark = color.modes.find((m) => m.name === 'Dark');
if (!light || !dark) throw new Error('La coleccion Color debe tener los modos Light y Dark');

// "bg/page" -> "--bg-page"
const cssName = (name) => `--${name.replace(/\//g, '-')}`;

const valueFor = (v, modeId) => {
  const value = v.values[modeId];
  if (!value) throw new Error(`La variable ${v.name} no tiene valor para el modo ${modeId}`);
  if (value.type === 'color') return toCssColor(value.value);
  // tint/opacity se usa como porcentaje en color-mix().
  if (v.name === 'tint/opacity') return `${value.value}%`;
  return `${value.value}px`;
};

const lines = (vars, modeId) => vars.map((v) => `  ${cssName(v.name)}: ${valueFor(v, modeId)};`).join('\n');

const colorVars = variables.filter((v) => v.collection === color.id).sort((a, b) => a.name.localeCompare(b.name));
const numberVars = ['Espaciado', 'Radio'].flatMap((name) => {
  const col = byName(name);
  return variables
    .filter((v) => v.collection === col.id)
    .map((v) => ({ v, mode: col.modes[0].id }));
});

const effectCss = (e) => {
  if (!e) return 'none';
  const inset = e.type === 'innerShadow' ? 'inset ' : '';
  return `${inset}${e.offset[0]}px ${e.offset[1]}px ${e.radius}px ${e.spread || 0}px ${toCssColor(e.color)}`;
};

// Busca un nodo por nombre dentro de un frame o componente (por nombre), en anchura.
const findIn = (containerName, nodeName) => {
  const container = Object.values(doc.nodes).find((n) => n.name === containerName);
  if (!container) throw new Error(`No existe "${containerName}" en el diseno`);
  const queue = [container.id];
  while (queue.length) {
    const n = doc.nodes[queue.shift()];
    if (n.name === nodeName) return n;
    queue.push(...(n.children || []));
  }
  throw new Error(`No existe "${nodeName}" dentro de "${containerName}"`);
};

const shadowStyle = doc.styles.find((s) => s.type === 'effect' && s.name === 'Sombra/Elevada');

// Efectos de componente que no son variables en el diseno, pero cambian por tema. Se toman de las
// pantallas (fuente de verdad): en Light la tarjeta y el buscador tienen sombra suave; en Dark,
// borde y un brillo superior de 1px (inset).
const derived = {
  light: {
    '--shadow-card': effectCss(findIn('Emisor=BCI', 'Emisor=BCI').effects?.[0]),
    '--shimmer-highlight': toCssColor(findIn('Tarjeta cargando', 'Shimmer').fills[0].stops[1].color),
  },
  dark: {
    '--shadow-card': effectCss(findIn('Escritorio / Resultados / Dark', 'Tarjeta de beneficio').effects?.[0]),
    '--shimmer-highlight': toCssColor(findIn('Móvil / Resultados / Dark', 'Shimmer').fills[0].stops[1].color),
  },
};
const derivedLines = (mode, indent = '  ') =>
  Object.entries(derived[mode])
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join('\n');

const css = `/* GENERADO por scripts/design/export-tokens.mjs desde design/beneficios_CL.figcraft. No editar a mano.
 * Light es el tema por defecto. Dark aplica con [data-theme="dark"] o, si el usuario no eligio tema,
 * con prefers-color-scheme: dark. Los selectores [data-theme] tambien funcionan en un elemento
 * interior (por ejemplo, para mostrar ambos temas lado a lado en /sistema). */

:root {
${numberVars.map(({ v, mode }) => `  ${cssName(v.name)}: ${valueFor(v, mode)};`).join('\n')}

  --shadow-elevated: ${effectCss(shadowStyle?.effects?.[0])};
}

:root,
[data-theme='light'] {
${lines(colorVars, light.id)}
${derivedLines('light')}
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${lines(colorVars, dark.id).replace(/^ {2}/gm, '    ')}
${derivedLines('dark', '    ')}
    color-scheme: dark;
  }
}

[data-theme='dark'] {
${lines(colorVars, dark.id)}
${derivedLines('dark')}
  color-scheme: dark;
}
`;

writeFileSync(OUT, css);

// Los mismos colores como modulo TS: para metadata (theme-color) y para el test de contraste AA.
const colorMap = (modeId) =>
  Object.fromEntries(colorVars.filter((v) => v.resolvedType === 'color').map((v) => [v.name, valueFor(v, modeId)]));
const ts = `// GENERADO por scripts/design/export-tokens.mjs desde design/beneficios_CL.figcraft. No editar a mano.
export const colorTokens = ${JSON.stringify({ light: colorMap(light.id), dark: colorMap(dark.id) }, null, 2)} as const;

export type ColorToken = keyof typeof colorTokens.light;
`;
writeFileSync(OUT.replace(/\.css$/, '.ts'), ts);
console.log(`tokens: ${colorVars.length} colores (Light/Dark), ${numberVars.length} medidas -> ${path.relative(process.cwd(), OUT)}`);
