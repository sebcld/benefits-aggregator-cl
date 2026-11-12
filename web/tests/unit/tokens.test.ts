// @vitest-environment node
// Tokens: contraste AA de los pares de texto usados en la UI (ambos temas) y ningun color suelto
// en los componentes.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { colorTokens, type ColorToken } from '@/styles/tokens';

type RGBA = [number, number, number, number];

function parse(color: string): RGBA {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(color);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4])];
  throw new Error(`Color no reconocido: ${color}`);
}

/** Compone un color con alfa sobre un fondo opaco. */
const over = ([r, g, b, a]: RGBA, [br, bg, bb]: RGBA): RGBA => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];

function luminance([r, g, b]: RGBA): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: RGBA, bg: RGBA): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// [texto, fondo, fondo base si el fondo es translucido, donde se usa]
const TEXT_PAIRS: Array<[ColorToken, ColorToken, ColorToken | null, string]> = [
  ['text/primary', 'bg/page', null, 'texto general'],
  ['text/primary', 'bg/surface', null, 'tarjetas'],
  ['text/secondary', 'bg/page', null, 'bajadas, resumen'],
  ['text/secondary', 'bg/surface', null, 'placeholder, emisor'],
  ['text/secondary', 'bg/subtle', null, 'iniciales del logo'],
  ['text/on-brand', 'brand/primary', null, 'chip activo, boton buscar'],
  ['brand/soft-text', 'brand/soft', null, 'pildora hero, Ver beneficio'],
  ['brand/primary', 'glass/bg', 'bg/page', '"Limpiar" en el panel de vidrio'],
  ['state/warn-text', 'state/warn-bg', 'bg/page', 'aviso parcial'],
  ['state/error', 'state/error-bg', 'bg/page', 'aviso de error'],
  ['accent/on-amber', 'accent/amber-bg', 'bg/surface', 'vigencia y Beta'],
];

describe.each(['light', 'dark'] as const)('contraste AA (%s)', (mode) => {
  const t = colorTokens[mode];
  it.each(TEXT_PAIRS)('%s sobre %s (%s, %s)', (fg, bg, base) => {
    const background = base ? over(parse(t[bg]), parse(t[base])) : parse(t[bg]);
    const foreground = over(parse(t[fg]), background);
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('sin colores sueltos', () => {
  const ROOT = path.resolve(__dirname, '../../src');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? files(full) : /\.(tsx?|css)$/.test(name) ? [full] : [];
    });
  // Los unicos lugares con valores de color son los generados desde el diseno.
  const GENERATED = new Set(['tokens.css', 'tokens.ts']);

  it.each(files(ROOT).filter((f) => !GENERATED.has(path.basename(f))).map((f) => [path.relative(ROOT, f), f]))(
    '%s no usa hex, rgb() ni la paleta por defecto de Tailwind',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/#[0-9a-f]{3,8}\b(?![\w-])/i);
      expect(source).not.toMatch(/\brgba?\(\s*\d/);
      // Paleta por defecto (bg-red-500, text-white...). Igual no se genera: globals.css la borra.
      expect(source).not.toMatch(/\b(?:bg|text|border|from|to|ring)-(?:[a-z]+-\d{2,3}|white|black)\b/);
    },
  );
});
