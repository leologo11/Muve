import { qs, supabaseRequest } from './supabase.js';

// Ray-casting point-in-polygon (GeoJSON: coords are [lng, lat])
export function pointInPolygon(lngLat, ring) {
  const [x, y] = lngLat;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export async function findZoneForPoint(lng, lat) {
  try {
    const zones = await supabaseRequest(`/zones${qs({ select: 'name,price,color,source,polygon' })}`);
    return zones.find(z => {
      const ring = z.polygon?.coordinates?.[0] || z.polygon?.geometry?.coordinates?.[0];
      return ring && pointInPolygon([lng, lat], ring);
    }) || null;
  } catch { return null; }
}
