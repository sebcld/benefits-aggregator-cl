// @vitest-environment node
// Tokens (src/styles/tokens.css, editado a mano): los dos bloques de Dark coinciden, contraste AA de
// los pares de texto usados en la UI (ambos temas) y ningun color suelto en los componentes.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTokens, readTokens } from '@/styles/read-tokens';

const tokens = readTokens();

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
const TEXT_PAIRS: Array<[string, string, string | null, string]> = [
  ['--text-primary', '--bg-page', null, 'texto general'],
  ['--text-primary', '--bg-surface', null, 'tarjetas'],
  ['--text-secondary', '--bg-page', null, 'bajadas, resumen'],
  ['--text-secondary', '--bg-surface', null, 'placeholder, emisor'],
  ['--text-secondary', '--bg-subtle', null, 'iniciales del logo'],
  ['--text-on-brand', '--brand-primary', null, 'chip activo, boton buscar'],
  ['--brand-soft-text', '--brand-soft', null, 'pildora hero, Ver beneficio'],
  ['--brand-primary', '--glass-bg', '--bg-page', '"Limpiar" en el panel de vidrio'],
  ['--state-warn-text', '--state-warn-bg', '--bg-page', 'aviso parcial'],
  ['--state-error', '--state-error-bg', '--bg-page', 'aviso de error'],
  ['--accent-on-amber', '--accent-amber-bg', '--bg-surface', 'vigencia y Beta'],
];

describe('tokens.css', () => {
  it('Dark por sistema (@media) y Dark elegido ([data-theme="dark"]) tienen los mismos valores', () => {
    expect(tokens.systemDark).toEqual(tokens.dark);
  });

  it('tiene los tokens de color que usa la UI, en ambos temas', () => {
    for (const name of TEXT_PAIRS.flatMap(([fg, bg, base]) => [fg, bg, base]).filter(Boolean) as string[]) {
      expect(tokens.light[name], name).toBeTruthy();
      expect(tokens.dark[name], name).toBeTruthy();
    }
  });

  it('parseTokens: comunes en ambos temas, Light por defecto y Dark encima', () => {
    const t = parseTokens(`:root { --space-1: 4px; }
      :root, [data-theme='light'] { --a: #fff; --b: #111; }
      @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { --a: #000; } }
      [data-theme='dark'] { --a: #000; }`);
    expect(t.light).toEqual({ '--space-1': '4px', '--a': '#fff', '--b': '#111' });
    expect(t.dark).toEqual({ '--space-1': '4px', '--a': '#000', '--b': '#111' });
    expect(t.systemDark).toEqual(t.dark);
  });
});

describe.each(['light', 'dark'] as const)('contraste AA (%s)', (mode) => {
  const t = tokens[mode];
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
  // El unico lugar con valores de color es tokens.css.
  const COLOR_SOURCES = new Set(['tokens.css']);

  it.each(files(ROOT).filter((f) => !COLOR_SOURCES.has(path.basename(f))).map((f) => [path.relative(ROOT, f), f]))(
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
