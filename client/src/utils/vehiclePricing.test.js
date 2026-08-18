import { describe, it, expect } from 'vitest';
import { findTierPricePerKm } from './vehiclePricing.js';

const TIERS = [
  { max_km: 10, price_per_km: 1000 },
  { max_km: 30, price_per_km: 800 },
  { max_km: 100, price_per_km: 600 },
];

describe('findTierPricePerKm', () => {
  it('picks the tier whose max_km covers the distance', () => {
    expect(findTierPricePerKm(TIERS, 5)).toBe(1000);
    expect(findTierPricePerKm(TIERS, 25)).toBe(800);
  });
  it('falls back to the last (unlimited ceiling) tier past the highest max_km', () => {
    expect(findTierPricePerKm(TIERS, 500)).toBe(600);
  });
  it('works regardless of input tier order', () => {
    const shuffled = [TIERS[2], TIERS[0], TIERS[1]];
    expect(findTierPricePerKm(shuffled, 5)).toBe(1000);
  });
  it('accepts camelCase pricePerKm as a fallback', () => {
    expect(findTierPricePerKm([{ max_km: 10, pricePerKm: 1234 }], 5)).toBe(1234);
  });
  it('returns 0 for an empty tier list', () => {
    expect(findTierPricePerKm([], 10)).toBe(0);
  });
});
