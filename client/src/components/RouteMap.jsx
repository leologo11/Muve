import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

const STATUS_COLOR = {
  pendiente: null,
  entregado: '#008855',
  'no-entregado': '#cc2244',
  eliminado: '#aaa'
};

const ZONE_COLORS = {
  Providencia: '#e8740a',
  'Las Condes': '#2288cc',
  Vitacura: '#2a9940',
  'Lo Barnechea': '#cc6600',
  Chicureo: '#cc3333',
  default: '#888'
};

function pinColor(pkg) {
  if (pkg.status === 'eliminado') return '#aaa';
  if (pkg.status === 'entregado') return '#008855';
  if (pkg.status === 'no-entregado') return '#cc2244';
  return ZONE_COLORS[pkg.zone] || ZONE_COLORS.default;
}

function pinLabel(pkg, index) {
  if (pkg.status === 'eliminado') return '✕';
  if (pkg.status === 'entregado') return '✓';
  if (pkg.status === 'no-entregado') return '✗';
  return String(index + 1);
}

export default function RouteMap({ packages, onPkgClick, readOnly, startPoint }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const markersRef = useRef({});
  const lineRef = useRef(null);
  const startMarkerRef = useRef(null);

  useEffect(() => {
    if (instanceRef.current) return;
    instanceRef.current = L.map(mapRef.current, { zoomControl: true })
      .setView([-33.42, -70.57], 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '©<a href="https://carto.com/">CARTO</a> ©<a href="https://www.openstreetmap.org/copyright">OSM</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(instanceRef.current);
  }, []);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map || !packages) return;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};
    if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }

    // Draw route line
    const pts = packages
      .filter(p => p.lat && p.lng && p.status !== 'eliminado')
      .map(p => [p.lat, p.lng]);
    if (pts.length > 1) {
      lineRef.current = L.polyline(pts, { color: '#008855', weight: 2, opacity: .35, dashArray: '5,8' }).addTo(map);
    }

    // Start point marker
    if (startMarkerRef.current) { startMarkerRef.current.remove(); startMarkerRef.current = null; }
    if (startPoint?.lat && startPoint?.lng) {
      const startIcon = L.divIcon({
        className: '',
        html: `<div style="background:#1a1a2e;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid #fff;box-shadow:0 2px 8px #00000033;">🏠</div>`,
        iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -36]
      });
      startMarkerRef.current = L.marker([startPoint.lat, startPoint.lng], { icon: startIcon }).addTo(map);
      startMarkerRef.current.bindPopup(`<div style="font-family:'Space Grotesk',sans-serif"><b>📍 Punto de inicio</b><br><span style="font-size:12px;color:#777">${startPoint.address || 'Bodega / Pickup'}</span></div>`);
    }

    // Add markers
    packages.forEach((pkg, idx) => {
      if (!pkg.lat || !pkg.lng) return;
      const color = pinColor(pkg);
      const label = pinLabel(pkg, idx);
      const elim = pkg.status === 'eliminado';

      const icon = L.divIcon({
        className: '',
        html: `<div class="mpin" style="background:${color};${elim ? 'opacity:.3;filter:grayscale(1)' : ''}">${label}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -32]
      });

      const nav = `<a href="https://maps.google.com/maps?daddr=${pkg.lat},${pkg.lng}&dir_action=navigate" style="padding:4px 9px;background:#2a994018;color:#2a9940;border:1px solid #2a994030;border-radius:7px;font-size:11px;font-weight:700">📍 Maps</a>`;
      const waze = `<a href="https://waze.com/ul?q=${encodeURIComponent(pkg.address + ', Chile')}&navigate=yes" style="padding:4px 9px;background:#0077aa18;color:#0077aa;border:1px solid #0077aa30;border-radius:7px;font-size:11px;font-weight:700">🔵 Waze</a>`;
      const editBtn = !readOnly ? `<button onclick="window.__pkgClick('${pkg._id}')" style="padding:4px 9px;background:#55555518;color:#555;border:1px solid #55555530;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">✏️ Editar</button>` : '';

      const statusText = { pendiente: '⏳ Pendiente', entregado: '✅ Entregado', 'no-entregado': '❌ No entregado', eliminado: '🗑️ Eliminada' }[pkg.status];

      const popup = `<div style="font-family:'Space Grotesk',sans-serif;min-width:190px">
        <b style="font-size:13px;color:#111">${idx + 1}. ${pkg.customerName} ${pkg.customerLastName || ''}</b><br>
        <span style="font-size:11px;color:#777">${pkg.address}${pkg.aptFloor ? '<br><em style="color:#d4650a">' + pkg.aptFloor + '</em>' : ''}</span><br>
        <span style="font-size:11px;font-weight:700;color:${color}">${statusText} · $${(pkg.price || 0).toLocaleString('es-CL')}</span>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">${nav}${waze}${editBtn}</div>
      </div>`;

      const marker = L.marker([pkg.lat, pkg.lng], { icon }).addTo(map);
      marker.bindPopup(popup, { maxWidth: 270 });
      markersRef.current[pkg._id] = marker;
    });

    // Global callback for popup edit button
    window.__pkgClick = (id) => {
      const pkg = packages.find(p => p._id === id);
      if (pkg) onPkgClick?.(pkg);
    };
  }, [packages, readOnly]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#e8e8e0' }} />;
}
