import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

const ZONE_COLORS = {
  Providencia: '#e8740a',
  'Las Condes': '#2288cc',
  Vitacura: '#2a9940',
  'Lo Barnechea': '#cc6600',
  Chicureo: '#cc3333',
  default: '#555588'
};

function pinColor(pkg) {
  if (pkg.status === 'eliminado') return '#aaa';
  if (pkg.status === 'entregado') return '#008855';
  if (pkg.status === 'no-entregado') return '#cc2244';
  return ZONE_COLORS[pkg.zone] || ZONE_COLORS.default;
}

function pinLabel(pkg, i) {
  if (pkg.status === 'entregado') return '✓';
  if (pkg.status === 'no-entregado') return '✗';
  if (pkg.status === 'eliminado') return '✕';
  return String(i + 1);
}

export default function RouteMap({ packages, onPkgClick, readOnly, startPoint, visible = true }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const markersRef = useRef({});
  const lineRef = useRef(null);
  const startRef = useRef(null);

  // Init map once
  useEffect(() => {
    if (instanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([-33.45, -70.65], 12);
    // OpenStreetMap — reliable fallback
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19
    }).addTo(map);
    instanceRef.current = map;
  }, []);

  // Resize when tab becomes visible
  useEffect(() => {
    if (visible && instanceRef.current) {
      setTimeout(() => instanceRef.current?.invalidateSize(), 80);
    }
  }, [visible]);

  // Update markers whenever packages or startPoint change
  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    // Clear existing layers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};
    if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }
    if (startRef.current) { startRef.current.remove(); startRef.current = null; }

    const active = (packages || []).filter(p => p.status !== 'eliminado');
    const withCoords = active.filter(p => p.lat && p.lng);

    // Route line through coords in order
    if (withCoords.length > 1) {
      lineRef.current = L.polyline(
        withCoords.map(p => [p.lat, p.lng]),
        { color: '#008855', weight: 3, opacity: 0.45, dashArray: '6,10' }
      ).addTo(map);
    }

    // Start point
    if (startPoint?.lat && startPoint?.lng) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#1a1a2e;color:#fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #fff;box-shadow:0 2px 8px #0003">🏠</div>`,
        iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -38]
      });
      startRef.current = L.marker([startPoint.lat, startPoint.lng], { icon }).addTo(map);
      startRef.current.bindPopup(
        `<b style="font-family:'Space Grotesk',sans-serif">📍 Inicio / Bodega</b><br><span style="font-size:12px;color:#777">${startPoint.address || ''}</span>`
      );
    }

    // Package markers
    active.forEach((pkg, i) => {
      if (!pkg.lat || !pkg.lng) return;

      const color = pinColor(pkg);
      const label = pinLabel(pkg, i);
      const elim = pkg.status === 'eliminado';

      const icon = L.divIcon({
        className: '',
        html: `<div class="mpin" style="background:${color};${elim ? 'opacity:.35;filter:grayscale(1)' : ''}">${label}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -32]
      });

      const statusText = { pendiente: '⏳ Pendiente', entregado: '✅ Entregado', 'no-entregado': '❌ No entregado', eliminado: '🗑️' }[pkg.status];
      const fullAddr = [pkg.address, pkg.aptFloor, pkg.commune].filter(Boolean).join(' · ');

      const nav = `<a href="https://maps.google.com/maps?daddr=${pkg.lat},${pkg.lng}&dir_action=navigate" target="_blank" style="padding:4px 8px;background:#2a994018;color:#2a9940;border:1px solid #2a994030;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none">📍 Maps</a>`;
      const waze = `<a href="https://waze.com/ul?q=${encodeURIComponent((pkg.address || '') + ', Chile')}&navigate=yes" target="_blank" style="padding:4px 8px;background:#0077aa18;color:#0077aa;border:1px solid #0077aa30;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none">🔵 Waze</a>`;
      const editBtn = !readOnly
        ? `<button onclick="window.__pkgClick('${pkg._id}')" style="padding:4px 8px;background:#55555518;color:#444;border:1px solid #55555530;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">✏️ Editar</button>`
        : '';

      const popup = `<div style="font-family:'Space Grotesk',sans-serif;min-width:200px">
        <b style="font-size:13px">${i + 1}. ${pkg.customerName} ${pkg.customerLastName || ''}</b><br>
        <span style="font-size:11px;color:#777;line-height:1.5">${fullAddr}</span><br>
        <span style="font-size:11px;font-weight:700;color:${color};margin-top:4px;display:block">${statusText}</span>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">${nav} ${waze} ${editBtn}</div>
      </div>`;

      const marker = L.marker([pkg.lat, pkg.lng], { icon }).addTo(map);
      marker.bindPopup(popup, { maxWidth: 290 });
      markersRef.current[pkg._id] = marker;
    });

    // Fit map to all visible points
    const allPts = [
      ...withCoords.map(p => [p.lat, p.lng]),
      ...(startPoint?.lat && startPoint?.lng ? [[startPoint.lat, startPoint.lng]] : [])
    ];
    if (allPts.length === 1) {
      map.setView(allPts[0], 15);
    } else if (allPts.length > 1) {
      map.fitBounds(allPts, { padding: [45, 45], maxZoom: 15 });
    }

    window.__pkgClick = (id) => {
      const pkg = (packages || []).find(p => p._id === id);
      if (pkg) onPkgClick?.(pkg);
    };
  }, [packages, startPoint, readOnly]);

  const noCoords = (packages || []).filter(p => p.status !== 'eliminado' && (!p.lat || !p.lng)).length;
  const total = (packages || []).filter(p => p.status !== 'eliminado').length;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#e8e8e0' }} />
      {noCoords > 0 && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          background: '#fff8e1', border: '1px solid #f57c0044', borderRadius: 20,
          padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#f57c00',
          zIndex: 900, pointerEvents: 'none', boxShadow: '0 2px 8px #0002'
        }}>
          ⚠️ {noCoords}/{total} sin coordenadas · Usa "Geocodificar ruta" en INFO
        </div>
      )}
    </div>
  );
}
