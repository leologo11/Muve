import { SECTOR_TO_COMMUNE } from './priceByCommune.js';

function normalizeKey(str) {
  return (str || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export async function geocodeAddress(address, commune) {
  if (!address) return null;
  const resolvedCommune = SECTOR_TO_COMMUNE[normalizeKey(commune)] || commune;
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
