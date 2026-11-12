// Renderiza los frames del archivo de diseno a PNG para compararlos con la web (sin el conector
// de FigCraft). Cada nodo trae su posicion (transform) y tamano ya resueltos por el motor de
// auto-layout, asi que basta con posicionarlos en absoluto. Cubre lo que usa este archivo:
// rellenos solidos y degradados lineales, bordes, radios, sombras, blur de fondo, textos,
// elipses y vectores (iconos).
// Uso: npm run design:render [-- <filtro de nombre>]  ->  design-ref/<pagina>/<frame>.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { readDesign, toCssColor } from './figcraft.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../../design-ref');
const filter = (process.argv[2] || '').toLowerCase();

const doc = readDesign();
const nodes = doc.nodes;

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const visible = (paint) => paint && paint.visible !== false;

const WEIGHTS = { Regular: 400, Medium: 500, SemiBold: 600, 'Semi Bold': 600, Bold: 700, ExtraBold: 800 };

function paintCss(paint) {
  if (paint.type === 'solid') return toCssColor(paint.color, paint.opacity ?? 1);
  if (paint.type === 'gradient' && paint.kind === 'linear') {
    const [fx, fy] = paint.from;
    const [tx, ty] = paint.to;
    const angle = (Math.atan2(tx - fx, -(ty - fy)) * 180) / Math.PI;
    const stops = paint.stops.map((s) => `${toCssColor(s.color, paint.opacity ?? 1)} ${s.position * 100}%`);
    return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
  }
  return null;
}

function boxStyles(n) {
  const css = [];
  const fills = (n.fills || []).filter(visible).map(paintCss).filter(Boolean);
  // CSS pinta el primer fondo arriba; FigCraft lista de abajo hacia arriba.
  if (fills.length) {
    css.push(`background:${fills.reverse().map((f) => (f.startsWith('linear') ? f : `linear-gradient(${f},${f})`)).join(',')}`);
  }

  const shadows = [];
  const stroke = (n.strokes || []).find(visible);
  if (stroke) {
    const c = paintCss(stroke);
    const w = n.stroke?.weight ?? 1;
    const sides = n.stroke?.sides;
    if (sides) {
      if (sides.top) shadows.push(`inset 0 ${sides.top}px 0 ${c}`);
      if (sides.bottom) shadows.push(`inset 0 -${sides.bottom}px 0 ${c}`);
      if (sides.left) shadows.push(`inset ${sides.left}px 0 0 ${c}`);
      if (sides.right) shadows.push(`inset -${sides.right}px 0 0 ${c}`);
    } else {
      shadows.push(`inset 0 0 0 ${w}px ${c}`);
    }
  }
  for (const e of n.effects || []) {
    if (e.visible === false) continue;
    if (e.type === 'dropShadow' || e.type === 'innerShadow') {
      const inset = e.type === 'innerShadow' ? 'inset ' : '';
      shadows.push(`${inset}${e.offset[0]}px ${e.offset[1]}px ${e.radius}px ${e.spread || 0}px ${toCssColor(e.color)}`);
    } else if (e.type === 'backgroundBlur') {
      css.push(`backdrop-filter:blur(${e.radius}px)`);
    }
  }
  if (shadows.length) css.push(`box-shadow:${shadows.join(',')}`);

  const radii = n.corners?.radii;
  if (n.type === 'ellipse') css.push('border-radius:50%');
  else if (radii && radii.some(Boolean)) css.push(`border-radius:${radii.map((r) => `${r}px`).join(' ')}`);
  if (n.clip) css.push('overflow:hidden');
  return css;
}

function textHtml(n, base) {
  const s = n.style;
  const color = (n.fills || []).filter(visible).map(paintCss)[0] || '#000';
  const lh = s.line_height?.unit === 'pixels' ? `${s.line_height.value}px` : s.line_height?.unit === 'percent' ? `${s.line_height.value}%` : 'normal';
  const ls = s.letter_spacing?.unit === 'percent' ? `${s.letter_spacing.value / 100}em` : `${s.letter_spacing?.value || 0}px`;
  const wrap = n.auto_resize === 'height' ? 'white-space:pre-wrap' : 'white-space:pre';
  const css = [
    ...base,
    `font-family:'${s.font_family}'`,
    `font-weight:${WEIGHTS[s.font_style] || 400}`,
    `font-size:${s.font_size}px`,
    `line-height:${lh}`,
    `letter-spacing:${ls}`,
    `color:${color}`,
    wrap,
    n.align_h === 'center' ? 'text-align:center' : n.align_h === 'right' ? 'text-align:right' : '',
    s.case === 'upper' ? 'text-transform:uppercase' : '',
    s.decoration === 'underline' ? 'text-decoration:underline' : '',
  ].filter(Boolean);
  return `<div data-id="${n.id}" style="${css.join(';')}">${esc(n.characters)}</div>`;
}

function vectorHtml(n, base) {
  const { vertices, segments, regions } = n.network || {};
  if (!vertices) return '';
  const pt = (i) => vertices[i];
  const seg = (s, move) => {
    const a = pt(s.a);
    const b = pt(s.b);
    const head = move ? `M${a.x} ${a.y}` : '';
    const curved = (s.ta && (s.ta[0] || s.ta[1])) || (s.tb && (s.tb[0] || s.tb[1]));
    if (!curved) return `${head}L${b.x} ${b.y}`;
    return `${head}C${a.x + s.ta[0]} ${a.y + s.ta[1]} ${b.x + s.tb[0]} ${b.y + s.tb[1]} ${b.x} ${b.y}`;
  };
  const fill = (n.fills || []).filter(visible).map(paintCss)[0];
  const strokePaint = (n.strokes || []).find(visible);
  const parts = [];
  if (fill && regions?.length) {
    const d = regions.flatMap((r) => r.loops.map((loop) => loop.map((si, k) => seg(segments[si], k === 0)).join('') + 'Z')).join('');
    parts.push(`<path d="${d}" fill="${fill}" fill-rule="${regions[0].winding === 'evenOdd' ? 'evenodd' : 'nonzero'}"/>`);
  }
  if (strokePaint) {
    const st = n.stroke || {};
    const d = segments.map((s) => seg(s, true)).join('');
    parts.push(
      `<path d="${d}" fill="none" stroke="${paintCss(strokePaint)}" stroke-width="${st.weight ?? 1}" stroke-linecap="${st.cap_start || 'butt'}" stroke-linejoin="${st.join || 'miter'}"/>`,
    );
  }
  return `<svg data-id="${n.id}" style="${base.join(';')};overflow:visible" width="${n.width}" height="${n.height}">${parts.join('')}</svg>`;
}

function nodeHtml(id, isRoot = false) {
  const n = nodes[id];
  if (!n || n.visible === false) return '';
  const t = n.transform || [1, 0, 0, 1, 0, 0];
  const base = [
    'position:absolute',
    `left:${isRoot ? 0 : t[4]}px`,
    `top:${isRoot ? 0 : t[5]}px`,
    `width:${n.width}px`,
    `height:${n.height}px`,
    'box-sizing:border-box',
  ];
  if (!isRoot && (t[0] !== 1 || t[1] !== 0 || t[2] !== 0 || t[3] !== 1)) {
    base.push(`transform:matrix(${t[0]},${t[1]},${t[2]},${t[3]},0,0)`, 'transform-origin:0 0');
  }
  if (n.opacity !== undefined && n.opacity < 1) base.push(`opacity:${n.opacity}`);
  if (n.type === 'text') return textHtml(n, base);
  if (n.type === 'vector') return vectorHtml(n, base);
  const children = (n.children || []).map((c) => nodeHtml(c)).join('');
  return `<div data-id="${n.id}" data-name="${esc(n.name)}" style="${[...base, ...boxStyles(n)].join(';')}">${children}</div>`;
}

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Sans:opsz,wght@9..40,400..700&display=swap';

const targets = doc.pages.flatMap((pid) => {
  const page = nodes[pid];
  return (page.children || []).map((id) => ({ page: page.name, id, name: nodes[id].name }));
});

const browser = await chromium.launch(process.env.PW_CHANNEL === 'chromium' ? {} : { channel: 'msedge' }).catch(() => chromium.launch());
const pageCtx = await browser.newPage({ deviceScaleFactor: 1 });
let count = 0;
for (const target of targets) {
  if (filter && !`${target.page} ${target.name}`.toLowerCase().includes(filter)) continue;
  const n = nodes[target.id];
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}">
<style>html,body{margin:0;background:#fff}#root{position:relative;width:${n.width}px;height:${n.height}px}</style></head>
<body><div id="root">${nodeHtml(target.id, true)}</div></body></html>`;
  const dir = path.join(OUT_DIR, slug(target.page));
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug(target.name)}`);
  writeFileSync(`${file}.html`, html);
  await pageCtx.setViewportSize({ width: Math.ceil(n.width), height: Math.ceil(n.height) });
  await pageCtx.setContent(html, { waitUntil: 'networkidle' });
  await pageCtx.evaluate(() => document.fonts.ready);
  await pageCtx.locator('#root').screenshot({ path: `${file}.png` });
  count += 1;
  console.log(`${target.page} / ${target.name} -> ${path.relative(process.cwd(), file)}.png`);
}
await browser.close();
console.log(`${count} frames renderizados en ${path.relative(process.cwd(), OUT_DIR)}`);
