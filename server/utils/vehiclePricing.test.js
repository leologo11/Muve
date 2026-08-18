import { describe, it, expect } from 'vitest';
import { findTierPricePerKm, calcVehiclePrice } from './vehiclePricing.js';

const TIERS = [
  { max_km: 10, price_per_km: 1000 },
  { max_km: 30, price_per_km: 800 },
];

describe('findTierPricePerKm', () => {
  it('picks the tier whose max_km covers the distance', () => {
    expect(findTierPricePerKm(TIERS, 5)).toBe(1000);
  });
  it('falls back to the last tier past the highest max_km', () => {
    expect(findTierPricePerKm(TIERS, 999)).toBe(800);
  });
});

describe('calcVehiclePrice', () => {
  const config = { base_price: 20000, km_tiers: TIERS, extras: { driver_help: 5000, helper: 8000, floor: 2000, packing: 6000 } };

  it('sums base + km cost, rounded to the nearest 1000', () => {
    const price = calcVehiclePrice(config, 5, 0, 0, false, false);
    expect(price).toBe(Math.round((20000 + 5 * 1000) / 1000) * 1000);
  });

  it('adds driver-help cost only when driverHelps is true', () => {
    const without = calcVehiclePrice(config, 5, 0, 0, false, false);
    const withHelp = calcVehiclePrice(config, 5, 0, 0, false, true);
    expect(withHelp - without).toBe(5000);
  });

  it('adds helper/floor/packing costs proportionally', () => {
    const price = calcVehiclePrice(config, 5, 2, 1, true, false);
    const expected = Math.round((20000 + 5 * 1000 + 2 * 8000 + 1 * 2000 + 6000) / 1000) * 1000;
    expect(price).toBe(expected);
  });
});
