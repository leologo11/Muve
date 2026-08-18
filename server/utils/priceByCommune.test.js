import { describe, it, expect } from 'vitest';
import { normalize, suggestPrice, roundPrice } from './priceByCommune.js';

describe('normalize', () => {
  it('lowercases, trims, and strips accents', () => {
    expect(normalize('  Ñuñoa  ')).toBe('nunoa');
    expect(normalize('San José de Maipo')).toBe('san jose de maipo');
  });
  it('handles null/undefined safely', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });
});

describe('suggestPrice', () => {
  it('returns the known price for an official commune, accent-insensitive', () => {
    expect(suggestPrice('Providencia')).toBe(4000);
    expect(suggestPrice('nunoa')).toBe(4000);
  });
  it('resolves a sector name to its real commune price', () => {
    // 'chicureo' maps to 'Colina' in SECTOR_TO_COMMUNE
    expect(suggestPrice('Chicureo')).toBe(suggestPrice('Colina'));
  });
  it('falls back to the default price for an unknown commune', () => {
    expect(suggestPrice('Comuna Inexistente XYZ')).toBe(5000);
  });
});

describe('roundPrice', () => {
  it('rounds to the nearest 500', () => {
    expect(roundPrice(4750)).toBe(5000);
    expect(roundPrice(4740)).toBe(4500);
  });
});
