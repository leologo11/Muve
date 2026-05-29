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
