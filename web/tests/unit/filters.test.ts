import { describe, expect, it } from 'vitest';
import { isSelected, onlyThis, parseBanksParam, resultsHref, setChecked, toggleChip } from '@/lib/filters';

const ALL = ['santander', 'bci', 'tenpo'];

describe('seleccion de emisores ([] = todos)', () => {
  it('parsea el parametro banks de la URL', () => {
    expect(parseBanksParam(null)).toEqual([]);
    expect(parseBanksParam('bci, Copec ,bci,')).toEqual(['bci', 'copec']);
  });

  it('con la seleccion vacia, todos estan seleccionados', () => {
    expect(isSelected([], 'bci')).toBe(true);
    expect(isSelected(['santander'], 'bci')).toBe(false);
  });

  it('checkbox: desmarcar uno desde "todos" deja los demas', () => {
    expect(setChecked([], 'bci', false, ALL)).toEqual(['santander', 'tenpo']);
  });

  it('checkbox: volver a marcar todos normaliza a "todos"', () => {
    expect(setChecked(['santander', 'tenpo'], 'bci', true, ALL)).toEqual([]);
  });

  it('checkbox: desmarcar el ultimo vuelve a "todos" (nunca una busqueda vacia)', () => {
    expect(setChecked(['bci'], 'bci', false, ALL)).toEqual([]);
  });

  it('"Solo": deja ese emisor y descarta los demas, desde "todos" o desde otra seleccion', () => {
    expect(onlyThis('bci', ALL)).toEqual(['bci']);
    // Elegir 2 rapido: "Solo" en uno y marcar el otro.
    expect(setChecked(onlyThis('bci', ALL), 'tenpo', true, ALL)).toEqual(['bci', 'tenpo']);
    // Con un solo emisor disponible, "solo ese" es lo mismo que "todos".
    expect(onlyThis('bci', ['bci'])).toEqual([]);
  });

  it('chip: desde "Todos", tocar un emisor filtra solo por el', () => {
    expect(toggleChip([], 'bci', ALL)).toEqual(['bci']);
  });

  it('chip: agrega y quita emisores; sin ninguno vuelve a "Todos"', () => {
    expect(toggleChip(['bci'], 'tenpo', ALL)).toEqual(['bci', 'tenpo']);
    expect(toggleChip(['bci', 'tenpo'], 'bci', ALL)).toEqual(['tenpo']);
    expect(toggleChip(['tenpo'], 'tenpo', ALL)).toEqual([]);
  });

  it('arma la URL de resultados', () => {
    expect(resultsHref('el café', [])).toBe('/buscar?q=el+caf%C3%A9');
    expect(resultsHref('rappi', ['bci', 'copec'])).toBe('/buscar?q=rappi&banks=bci%2Ccopec');
  });
});
