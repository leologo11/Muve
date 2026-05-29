// Singleton loader — loads Google Maps JS API once and resolves with the `google.maps` namespace.
// All map components import this instead of Leaflet.
let _promise = null;

export function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (_promise) return _promise;

  _promise = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';
    const cb  = '__gmLoaded_' + Date.now();
    window[cb] = () => { resolve(window.google.maps); delete window[cb]; };
    const s = document.createElement('script');
    s.src   = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,drawing,geometry&language=es&region=CL&callback=${cb}`;
    s.async = true;
    s.onerror = (e) => { _promise = null; reject(e); };
    document.head.appendChild(s);
  });

  return _promise;
}

// Convert GeoJSON ring [lng,lat][] → google.maps.LatLng[]
export function geoJsonToLatLngs(gm, coordinates) {
  return coordinates.map(([lng, lat]) => new gm.LatLng(lat, lng));
}

// Convert google.maps.Polygon path → GeoJSON ring (closed)
export function polygonToGeoJson(polygon) {
  const arr = polygon.getPath().getArray();
  const coords = arr.map(ll => [ll.lng(), ll.lat()]);
  coords.push(coords[0]); // close ring
  return coords;
}

// Compute LatLngBounds from a google.maps.Polygon
export function polygonBounds(gm, polygon) {
  const bounds = new gm.LatLngBounds();
  polygon.getPath().forEach(ll => bounds.extend(ll));
  return bounds;
}

// Spread overlapping markers in a circle so stacked pins are all visible.
// Returns a new array where each package gets _dispLat/_dispLng (offset position)
// plus _groupSize / _centerLat / _centerLng when it belongs to a cluster.
export function spreadOverlapping(packages, radiusM = 22) {
  const R_LAT = radiusM / 111320; // degrees per metre (latitude)

  // Group by coordinates rounded to 4 decimal places (~11 m precision)
  const groups = {};
  packages.forEach(pkg => {
    if (!pkg.lat || !pkg.lng) return;
    const key = `${Number(pkg.lat).toFixed(4)}_${Number(pkg.lng).toFixed(4)}`;
    if (!groups[key]) groups[key] = { lat: Number(pkg.lat), lng: Number(pkg.lng), ids: [] };
    groups[key].ids.push(pkg._id);
  });

  const offsets = {};
  Object.values(groups).forEach(g => {
    if (g.ids.length < 2) return;
    const n      = g.ids.length;
    const cosLat = Math.cos(g.lat * Math.PI / 180);
    g.ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      offsets[id] = {
        lat:       g.lat + R_LAT * Math.cos(angle),
        lng:       g.lng + (R_LAT / cosLat) * Math.sin(angle),
        groupSize: n,
        centerLat: g.lat,
        centerLng: g.lng,
      };
    });
  });

  return packages.map(pkg => {
    const o = offsets[pkg._id];
    if (!o) return pkg;
    return { ...pkg, _dispLat: o.lat, _dispLng: o.lng, _groupSize: o.groupSize, _centerLat: o.centerLat, _centerLng: o.centerLng };
  });
}

// SVG circle marker icon (for package pins)
export function makeSvgIcon(gm, label, color, size = 32) {
  const fs  = label.length > 2 ? 9 : 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2-1.5}" fill="${color}" stroke="white" stroke-width="2.5"/>
    <text x="${size/2}" y="${size/2+4}" text-anchor="middle" fill="white"
      font-family="Inter,Arial,sans-serif" font-size="${fs}" font-weight="800">${label}</text>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new gm.Size(size, size),
    anchor:     new gm.Point(size / 2, size / 2),
  };
}
