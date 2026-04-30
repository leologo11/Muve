import Zone from '../models/Zone.js';

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
    const zones = await Zone.find().lean();
    return zones.find(z => pointInPolygon([lng, lat], z.polygon.coordinates[0])) || null;
  } catch { return null; }
}
