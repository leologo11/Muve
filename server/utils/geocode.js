// Photon (komoot) — fast, handles misspellings, OSM data, no rate limit
// Nominatim — fallback, strict rate limit (1 req/s)
export async function geocodeAddress(address, commune) {
  if (!address) return null;
  const query = [address, commune].filter(Boolean).join(', ');

  // Try Photon first — biased toward Santiago, better for Spanish/Chilean addresses
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=3&lang=es&lat=-33.45&lon=-70.65`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Routiflow/1.0' },
      signal: AbortSignal.timeout(7000)
    });
    if (res.ok) {
      const data = await res.json();
      const feature = (data.features || []).find(f => {
        const cc = (f.properties?.countrycode || '').toUpperCase();
        const co = (f.properties?.country || '').toLowerCase();
        return cc === 'CL' || co.includes('chile');
      }) || data.features?.[0];
      if (feature) return { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] };
    }
  } catch {}

  // Nominatim fallback
  try {
    const fullQuery = [address, commune, 'Chile'].filter(Boolean).join(', ');
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullQuery)}&format=json&limit=1&countrycodes=cl`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Routiflow/1.0 (delivery management)' },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {}

  return null;
}

// Delay between geocoding calls to respect rate limit
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
