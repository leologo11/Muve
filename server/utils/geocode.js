// Nominatim (OpenStreetMap) — free, no API key, 1 req/s limit
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export async function geocodeAddress(address, commune) {
  if (!address) return null;
  const query = [address, commune, 'Chile'].filter(Boolean).join(', ');
  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=cl`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Routiflow/1.0 (delivery management)' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

// Delay between geocoding calls to respect rate limit
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
