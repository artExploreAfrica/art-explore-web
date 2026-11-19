import { describe, expect, it } from 'vitest';
// The website's search helper (plain JS in the frontend package).
import { filterSpaces, normalizeText, textMatches } from '../frontend/src/lib/search.js';

describe('space search — normalizeText', () => {
  it('drops tone marks, accents and Yoruba dots below', () => {
    expect(normalizeText('Alárá')).toBe('alara');
    expect(normalizeText('Ọ̀yọ́')).toBe('oyo');
    expect(normalizeText('Ẹ̀ṣọ́')).toBe('eso');
    expect(normalizeText('Ilé-Ifẹ̀')).toBe('ile ife');
  });

  it('drops apostrophes of every kind and reads & as "and"', () => {
    expect(normalizeText("Nike's")).toBe('nikes');
    expect(normalizeText('Nike’s')).toBe('nikes');
    expect(normalizeText('Kó')).toBe('ko');
    expect(normalizeText('Arts & Crafts')).toBe('arts and crafts');
  });
});

describe('space search — matching', () => {
  const cases: Array<[string, string]> = [
    ['alara', 'Alárá'],
    ['ALÁRÁ', 'Alara'],
    ['ko art space', 'Kó Art Space'],
    ['oyo', 'Ọ̀yọ́ Gallery'],
    ['nikes', "Nike's Gallery"],
    ["nike's", 'Nikes Gallery'],
    ['nike art', 'Nike Art Gallery'],
    ['art nike', 'Nike Art Gallery'], // any order
    ['gal', 'Nike Art Gallery'], // as you type
    ['nikeart', 'Nike Art Gallery'], // missing space
    ['art center', 'Lagos Art Centre'], // US/UK spelling
    ['galleries', 'Rele Gallery'], // plural
    ['galery', 'Rele Gallery'], // one typo
    ['musuem', 'National Museum Lagos'], // common misspelling
    ['arts and crafts', 'Arts & Crafts Hub'],
    ['terra-kulture', 'Terra Kulture'],
  ];
  it.each(cases)('"%s" finds "%s"', (query, name) => {
    expect(textMatches(name, query)).toBe(true);
  });

  const misses: Array<[string, string]> = [
    ['nike', 'Rele Gallery'],
    ['st', 'Saint Gallery'], // short words aren't expanded mid-typing
    ['xyz', 'Nike Art Gallery'],
    ['gal', 'Terra Kulture'],
  ];
  it.each(misses)('"%s" does not find "%s"', (query, name) => {
    expect(textMatches(name, query)).toBe(false);
  });
});

describe('space search — filterSpaces', () => {
  const spaces = [
    { id: '1', name: 'Alárá', subArea: 'Victoria Island', typeLabel: 'Art Gallery', tags: [] },
    { id: '2', name: 'Nike Art Gallery', subArea: 'Lekki', typeLabel: 'Art Gallery', tags: [{ label: 'Women Owned' }] },
    { id: '3', name: 'National Museum Lagos', subArea: 'Onikan', typeLabel: 'Museum', tags: [] },
  ];
  const ids = (q: string) => filterSpaces(spaces, q).map((s: { id: string }) => s.id);

  it('keeps everything for an empty query', () => {
    expect(ids('')).toEqual(['1', '2', '3']);
    expect(ids('   ')).toEqual(['1', '2', '3']);
  });

  it('searches name, area, type and tags', () => {
    expect(ids('alara')).toEqual(['1']);
    expect(ids('lekki')).toEqual(['2']);
    expect(ids('museum')).toEqual(['3']);
    expect(ids('women owned')).toEqual(['2']);
    expect(ids('victoria')).toEqual(['1']);
  });
});
