// Antiguedad de los catalogos y habilitacion del boton "Actualizar".
import { describe, expect, it } from 'vitest';
import type { SourceStatus } from '@/lib/api/types';
import { ageMs, canRefresh, formatAge, freshnessOf, minutesUntilRefresh, serverNow } from '@/lib/freshness';

const MIN = 60_000;
const source = (key: string, fetchedAt: string | null): SourceStatus => ({ key, bank: key, status: fetchedAt ? 'ok' : 'error', fetchedAt });
const META = { generatedAt: '2026-11-12T15:00:00.000Z', refreshableAt: '2026-11-12T13:35:00.000Z' };
const RECEIVED = 1_000_000;

describe('freshnessOf', () => {
  it('usa la descarga mas antigua e ignora los emisores que fallaron', () => {
    const f = freshnessOf([source('a', '2026-11-12T14:50:00.000Z'), source('b', '2026-11-12T13:30:00.000Z'), source('c', null)], META, RECEIVED);
    expect(f?.oldestFetchedAt).toBe('2026-11-12T13:30:00.000Z');
  });

  it('null sin cache en el servidor (refreshableAt null) o si ningun emisor respondio', () => {
    expect(freshnessOf([source('a', '2026-11-12T14:50:00.000Z')], { ...META, refreshableAt: null }, RECEIVED)).toBeNull();
    expect(freshnessOf([source('a', null)], META, RECEIVED)).toBeNull();
  });
});

describe('con la hora del servidor', () => {
  const f = freshnessOf([source('a', '2026-11-12T13:30:00.000Z')], META, RECEIVED)!;

  it('la antiguedad es generatedAt - fetchedAt mas lo que paso en el navegador', () => {
    expect(ageMs(f, RECEIVED)).toBe(90 * MIN);
    expect(ageMs(f, RECEIVED + 10 * MIN)).toBe(100 * MIN);
  });

  it('un reloj del navegador atrasado no da antiguedades negativas', () => {
    expect(serverNow(f, RECEIVED - 5 * MIN)).toBe(Date.parse(META.generatedAt));
  });

  it('se puede actualizar desde refreshableAt; antes informa cuantos minutos faltan', () => {
    expect(canRefresh(f, RECEIVED)).toBe(true);
    const fresh = freshnessOf([source('a', '2026-11-12T15:00:00.000Z')], { ...META, refreshableAt: '2026-11-12T15:05:00.000Z' }, RECEIVED)!;
    expect(canRefresh(fresh, RECEIVED)).toBe(false);
    expect(minutesUntilRefresh(fresh, RECEIVED)).toBe(5);
    expect(minutesUntilRefresh(fresh, RECEIVED + 4.5 * MIN)).toBe(1);
    expect(canRefresh(fresh, RECEIVED + 5 * MIN)).toBe(true);
  });
});

describe('formatAge', () => {
  it.each([
    [20_000, 'hace menos de 1 min'],
    [5 * MIN, 'hace 5 min'],
    [60 * MIN, 'hace 1 h'],
    [90 * MIN, 'hace 1 h 30 min'],
    [125 * MIN, 'hace 2 h 5 min'],
  ])('%i ms -> %s', (ms, text) => {
    expect(formatAge(ms)).toBe(text);
  });
});
