// Lee los tokens de src/styles/tokens.css (la unica fuente de los colores) para usarlos fuera del
// CSS: themeColor del layout, swatches de /sistema y el test de contraste AA. Solo servidor: las
// paginas que lo usan son estaticas, asi que se lee en el build.
import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type Tokens = Record<string, string>;
export interface ThemeTokens {
  light: Tokens;
  dark: Tokens;
  /** Bloque de @media (prefers-color-scheme: dark): debe repetir los valores de "dark". */
  systemDark: Tokens;
}

const declarations = (body: string): Tokens =>
  Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

/**
 * Valores de cada tema. Light = bloque ":root, [data-theme='light']"; Dark = bloque
 * "[data-theme='dark']". Los tokens comunes (":root" solo: espaciado, radios) van en ambos.
 */
export function parseTokens(css: string): ThemeTokens {
  const shared: Tokens = {};
  const light: Tokens = {};
  const dark: Tokens = {};
  const systemDark: Tokens = {};
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Bloques sin llaves anidadas: dentro de @media se toma el selector interior.
  for (const [, rawSelector, body] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rawSelector.replace(/\s+/g, '');
    if (selector === ':root') Object.assign(shared, declarations(body));
    else if (selector === ":root,[data-theme='light']") Object.assign(light, declarations(body));
    else if (selector === "[data-theme='dark']") Object.assign(dark, declarations(body));
    else if (selector === ":root:not([data-theme='light'])") Object.assign(systemDark, declarations(body));
  }
  return {
    light: { ...shared, ...light },
    dark: { ...shared, ...light, ...dark },
    systemDark: { ...shared, ...light, ...systemDark },
  };
}

// La ruta va escrita entera (no en una variable): asi el build traza solo este archivo y no
// todo el proyecto.
export function readTokens(): ThemeTokens {
  return parseTokens(readFileSync(path.join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8'));
}

/** Nombres de los tokens de color (para los swatches), en el orden del archivo. */
export function colorTokenNames(tokens: Tokens): string[] {
  return Object.keys(tokens).filter((name) => /^(#|rgb|hsl|linear-gradient)/.test(tokens[name]));
}
