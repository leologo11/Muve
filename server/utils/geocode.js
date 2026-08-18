import { SECTOR_TO_COMMUNE, normalize } from './priceByCommune.js';

// OSRM route-geometry service — was hardcoded independently in 3 places (deliveryRoutes.js
// x2, publicRoutes.js). Overridable via env in case the public demo server needs replacing
// with a self-hosted instance.
export const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

export async function geocodeAddress(address, commune) {
  if (!address) return null;
  const resolvedCommune = SECTOR_TO_COMMUNE[normalize(commune)] || commune;
  const query = [address, resolvedCommune, 'Chile'].filter(Boolean).join(', ');
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${key}&language=es&region=CL`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'OK' && data.results[0]) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch {}

  return null;
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Sequentially geocodes items missing coordinates, throttled between calls to respect
// the geocoding provider's rate limit. Returns a lat/lng result (or null) per item,
// aligned by index — items that already have coordinates or lack an address are
// skipped without a request or a wait. Used by both the AI import flow and quote
// approval flow, which previously each hand-rolled the same throttled loop.
export async function geocodeMissingCoords(items, {
  getLat = i => i.lat, getLng = i => i.lng,
  getAddress = i => i.address, getCommune = i => i.commune,
  throttleMs = 1100,
} = {}) {
  const results = new Array(items.length).fill(null);
  const toGeocode = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => (!getLat(item) || !getLng(item)) && getAddress(item));

  for (let n = 0; n < toGeocode.length; n++) {
    const { item, i } = toGeocode[n];
    results[i] = await geocodeAddress(getAddress(item), getCommune(item));
    if (n < toGeocode.length - 1) await sleep(throttleMs);
  }
  return results;
}
