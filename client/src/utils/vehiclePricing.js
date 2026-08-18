// The one truly identical piece of the km-tier pricing logic that used to be
// copy-pasted separately in QuotesView.jsx and LandingView.jsx. Each of those still
// composes its own "total price" formula on top of this — they apply genuinely
// different business rules (multi-truck, partial-load discount, etc. are Landing-only
// features, not bugs to unify away) — so only the tier lookup itself is shared.
// Mirrors server/utils/vehiclePricing.js's findTierPricePerKm (can't share a module
// tree between the Vite client bundle and the Node server).
export function findTierPricePerKm(kmTiers, distanceKm) {
  const tiers = (kmTiers || []).slice().sort((a, b) => Number(a.max_km) - Number(b.max_km));
  const tier = tiers.find(t => Number(distanceKm) <= Number(t.max_km)) || tiers[tiers.length - 1];
  return tier ? Number(tier.price_per_km || tier.pricePerKm || 0) : 0;
}
