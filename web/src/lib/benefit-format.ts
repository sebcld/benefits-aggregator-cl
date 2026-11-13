// Transformaciones de presentacion de un beneficio (sin React, para poder probarlas aisladas).

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/**
 * "2026-12-31" -> "31 dic 2026". Se parsea a mano (sin Date ni zona horaria) para que el servidor y
 * el navegador produzcan siempre el mismo texto. Devuelve null si la fecha no es valida.
 */
export function formatDate(isoDate: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? '');
  if (!match) return null;
  const [, year, month, day] = match;
  const m = Number(month);
  if (m < 1 || m > 12) return null;
  return `${Number(day)} ${MONTHS[m - 1]} ${year}`;
}

export function formatValidUntil(isoDate: string | null | undefined): string | null {
  const date = formatDate(isoDate);
  return date ? `Vigente hasta ${date}` : null;
}

/** Iniciales para el contenedor de logo cuando la fuente no entrega imagen: "Burger King" -> "BK". */
export function initials(text: string): string {
  const words = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[´'’`]/g, '') // McDonald´s -> McDonalds (una palabra)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    // "Rappi 20% dcto" -> RD, no R2: las cifras no sirven como iniciales.
    .filter((w) => /^\p{L}/u.test(w));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const PERCENT = /(\d{1,3})\s?%/g;
const N_FOR_M = /\b([2-5])\s?x\s?([1-4])\b/i;
const AMOUNT = /\$\s?(\d{1,3}(?:\.\d{3})+|\d{4,})/;
const FREE_SHIPPING = /\b(env[ií]o|despacho)s?\s+gratis\b/i;
const FREE_MONTHS = /\b(\d{1,2})\s+mes(?:es)?\s+gratis\b/i;

/**
 * Valor principal del descuento para la pildora "hero" de la tarjeta.
 * Primero el dato estructurado de la API (`discount`, por ejemplo "30%" en BCI, donde el texto no
 * siempre lo dice). Si no viene, se busca en el titulo y luego en la bajada: Santander, Copec Pay y
 * Banco de Chile ponen el valor en la bajada ("Burger King" / "40% dcto. todos los jueves").
 * Devuelve null si no hay un valor claro: en ese caso la tarjeta no muestra la pildora.
 */
export function extractHero(title: string | null | undefined, subtitle?: string | null, discount?: string | null): string | null {
  return heroFrom(discount) ?? heroFrom(title) ?? heroFrom(subtitle);
}

const CASHBACK = /\bcashback\b/i;

/** Orden: porcentaje (el mayor) > NxM > monto en pesos > envio gratis > meses gratis. */
function heroFrom(title: string | null | undefined): string | null {
  if (!title) return null;

  const percents = [...title.matchAll(PERCENT)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 100);
  // "7% cashback" no es un descuento en el precio: se muestra como lo que es.
  if (percents.length) return `${Math.max(...percents)}% ${CASHBACK.test(title) ? 'CASHBACK' : 'DCTO'}`;

  const nxm = N_FOR_M.exec(title);
  if (nxm && Number(nxm[1]) > Number(nxm[2])) return `${nxm[1]}x${nxm[2]}`;

  const amount = AMOUNT.exec(title);
  if (amount) {
    const digits = String(Number(amount[1].replace(/\./g, '')));
    return `$${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} DCTO`;
  }

  if (FREE_SHIPPING.test(title)) return 'Envío gratis';

  const months = FREE_MONTHS.exec(title);
  if (months) return `${Number(months[1])} ${Number(months[1]) === 1 ? 'mes' : 'meses'} gratis`;

  return null;
}
