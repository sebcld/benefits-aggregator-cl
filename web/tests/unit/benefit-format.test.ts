import { describe, expect, it } from 'vitest';
import { extractHero, formatDate, formatValidUntil, initials } from '@/lib/benefit-format';

describe('formatDate / formatValidUntil', () => {
  it('formatea YYYY-MM-DD sin depender de la zona horaria', () => {
    expect(formatDate('2026-12-31')).toBe('31 dic 2026');
    expect(formatDate('2026-01-05')).toBe('5 ene 2026');
    expect(formatValidUntil('2026-11-30')).toBe('Vigente hasta 30 nov 2026');
  });

  it('devuelve null si no hay fecha o es invalida (la pastilla se oculta)', () => {
    expect(formatValidUntil(null)).toBeNull();
    expect(formatValidUntil(undefined)).toBeNull();
    expect(formatValidUntil('31/12/2026')).toBeNull();
    expect(formatDate('2026-13-01')).toBeNull();
  });
});

describe('initials', () => {
  it.each([
    ['Rappi', 'RA'],
    ['Burger King', 'BK'],
    ['Rappi Regiones', 'RR'],
    ['Café Rosa', 'CR'],
    ['Rappi 20% dcto', 'RD'],
    ['McDonald´s', 'MC'],
    ['123', '?'],
  ])('%s -> %s', (text, expected) => {
    expect(initials(text)).toBe(expected);
  });
});

describe('extractHero', () => {
  it.each([
    ['20% DCTO', '20% DCTO'],
    ['Hasta 50% de descuento para nuevos usuarios de la App Temu', '50% DCTO'],
    ['40% dcto + 10% adicional', '40% DCTO'],
    ['2x1 en combos', '2x1'],
    ['Combo 3 x 2', '3x2'],
    ['Hasta $6.000 de descuento los viernes', '$6.000 DCTO'],
    ['$3000 en tu primera compra', '$3.000 DCTO'],
    ['Envío gratis en tus pedidos', 'Envío gratis'],
    ['Despachos gratis', 'Envío gratis'],
    ['12 meses gratis de PedidosYa Plus', '12 meses gratis'],
    ['1 mes gratis', '1 mes gratis'],
  ])('"%s" -> %s', (title, expected) => {
    expect(extractHero(title)).toBe(expected);
  });

  it('no inventa un valor si no lo hay (la pildora no se muestra)', () => {
    expect(extractHero('Rappi')).toBeNull();
    expect(extractHero('Descuento Exclusivo')).toBeNull();
    expect(extractHero('1x2 raro')).toBeNull();
    expect(extractHero('Promo 0%')).toBeNull();
    expect(extractHero(null)).toBeNull();
  });

  it('si el titulo no trae valor, usa la bajada (como Santander, Copec Pay y Banco de Chile)', () => {
    expect(extractHero('Burger King', '40% dcto. todos los jueves.')).toBe('40% DCTO');
    expect(extractHero('Rappi', 'Hasta $6.000 de descuento los viernes')).toBe('$6.000 DCTO');
    expect(extractHero('Starbucks', 'Canjea tus Dólares-Premio')).toBeNull();
  });

  it('el titulo tiene prioridad sobre la bajada', () => {
    expect(extractHero('2x1 en cines', '50% en confites')).toBe('2x1');
  });

  it('el dato estructurado (discount) tiene prioridad sobre el texto (BCI: "Starbucks" / "Tu café favorito...")', () => {
    expect(extractHero('Starbucks', 'Tu café favorito y el momento perfecto para recargar tu dia.', '30%')).toBe('30% DCTO');
    expect(extractHero('2x1 en cines', null, '40%')).toBe('40% DCTO');
    // Sin discount, se sigue buscando en el texto.
    expect(extractHero('Burger King', '40% dcto. todos los jueves.', null)).toBe('40% DCTO');
  });

  it('un cashback se muestra como cashback, no como descuento', () => {
    expect(extractHero('Copec', null, '7% cashback')).toBe('7% CASHBACK');
    expect(extractHero('Turbus', 'Disfruta 15% de cashback pagando por primera vez')).toBe('15% CASHBACK');
  });
});
