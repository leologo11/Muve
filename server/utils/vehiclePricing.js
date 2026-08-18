// Vehicle km-tier pricing — the core tier-lookup here was reimplemented independently
// in client/src/views/admin/QuotesView.jsx and client/src/views/public/LandingView.jsx.
// This is the canonical server-side version (the only one that correctly applies
// driverHelps cost); the client owns a copy of just findTierPricePerKm in
// client/src/utils/vehiclePricing.js since browser and server code can't share a
// module tree in this repo.

// Finds the price-per-km for the tier whose max_km covers the given distance,
// falling back to the last (highest) tier as an unlimited ceiling.
export function findTierPricePerKm(kmTiers, distanceKm) {
  const tiers = (kmTiers || []).slice().sort((a, b) => Number(a.max_km) - Number(b.max_km));
  const tier = tiers.find(t => Number(distanceKm) <= Number(t.max_km)) || tiers[tiers.length - 1];
  return tier ? Number(tier.price_per_km || 0) : 0;
}

export function calcVehiclePrice(config, distanceKm, numHelpers = 0, numFloors = 0, needsPacking = false, driverHelps = false) {
  const ppk = findTierPricePerKm(config.km_tiers, distanceKm);
  const extras = config.extras || {};
  const kmCost = distanceKm * ppk;
  const driverHelpCost = driverHelps ? Number(extras.driver_help || 0) : 0;
  const helperCost = numHelpers * Number(extras.helper || 0);
  const floorCost = numFloors * Number(extras.floor || 0);
  const packingCost = needsPacking ? Number(extras.packing || 0) : 0;
  const total = Number(config.base_price || 0) + kmCost + driverHelpCost + helperCost + floorCost + packingCost;
  return Math.round(total / 1000) * 1000;
}
