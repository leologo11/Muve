import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

const ZONE_COLORS = {
  Providencia: '#e8740a',
  'Las Condes': '#2288cc',
  Vitacura: '#2a9940',
  'Lo Barnechea': '#cc6600',
  Chicureo: '#cc3333',
  default: '#e8740a'
};

function pinColor(pkg) {
  if (pkg.status === 'eliminado') return '#aaaaaa';
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

function makeIcon(pkg, i, hasStart) {
  const color = pinColor(pkg);
  const num = pkg.status === 'entregado' ? '✓' : pkg.status === 'no-entregado' ? '✗' : pkg.status === 'eliminado' ? '✕' : String(hasStart ? i + 2 : i + 1);
  const elim = pkg.status === 'eliminado';
  const size = 32;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${color};
      border:2.5px solid rgba(255,255,255,0.92);
      box-shadow:0 2px 10px rgba(0,0,0,0.38);
      display:flex;align-items:center;justify-content:center;
      font-size:${num.length > 2 ? 9 : 12}px;font-weight:800;color:#fff;
      font-family:'Space Grotesk',sans-serif;
      ${elim ? 'opacity:.35;filter:grayscale(1);' : ''}
      cursor:pointer;
    ">${num}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 6)]
  });
}

function makePopup(pkg, i, hasStart, onPkgClick, readOnly) {
  const displayNum = hasStart ? i + 2 : i + 1;
  const color = pinColor(pkg);
  const statusText = { pendiente: '⏳ Pendiente', entregado: '✅ Entregado', 'no-entregado': '❌ No entregado', eliminado: '🗑️ Eliminado' }[pkg.status] || pkg.status;
  const price = pkg.price ? ` · $${Number(pkg.price).toLocaleString('es-CL')}` : '';
  const aptHtml = pkg.aptFloor ? `<div style="font-size:12px;font-weight:700;color:#d4650a;margin-top:2px;font-style:italic">${pkg.aptFloor}</div>` : '';
  const phoneHtml = pkg.customerPhone
    ? `<a href="tel:${pkg.customerPhone}" style="${btnStyle('#008855')}">📞 Llamar</a>`
    : '';
  const wazeHtml = `<a href="https://waze.com/ul?q=${encodeURIComponent((pkg.address || '') + (pkg.commune ? ', ' + pkg.commune : '') + ', Chile')}&navigate=yes" target="_blank" style="${btnStyle('#0077aa')}">🔵 Waze</a>`;
  const mapsHtml = `<a href="https://maps.google.com/?daddr=${pkg.lat},${pkg.lng}&dir_action=navigate" target="_blank" style="${btnStyle('#2a9940')}">📍 Maps</a>`;
  const editHtml = !readOnly
    ? `<button onclick="window.__pkgClick('${pkg._id}')" style="${btnStyle('#555555')}">✏️ Editar</button>`
    : `<button onclick="window.__pkgClick('${pkg._id}')" style="${btnStyle('#555555')}">🔍 Ver</button>`;
  const deleteHtml = !readOnly && pkg.status !== 'eliminado'
    ? `<button onclick="window.__pkgDelete('${pkg._id}')" style="${btnStyle('#cc2244')}">🗑️ Eliminar</button>`
    : '';
  const restoreHtml = !readOnly && pkg.status === 'eliminado'
    ? `<button onclick="window.__pkgRestore('${pkg._id}')" style="${btnStyle('#008855')}">↩ Restaurar</button>`
    : '';

  return `<div style="font-family:'Space Grotesk',sans-serif;min-width:210px;max-width:270px">
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">${displayNum}. ${pkg.customerName} ${pkg.customerLastName || ''}</div>
    <div style="font-size:12px;color:#666;line-height:1.4">${pkg.address || ''}</div>
    ${aptHtml}
    ${pkg.commune ? `<div style="font-size:11px;color:#999;margin-top:1px">${pkg.commune}</div>` : ''}
    <div style="font-size:12px;font-weight:700;color:${color};margin-top:6px">${statusText}${price}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:10px">
      ${phoneHtml}${wazeHtml}${mapsHtml}${editHtml}${deleteHtml}${restoreHtml}
    </div>
  </div>`;
}

function btnStyle(color) {
  return `display:flex;align-items:center;justify-content:center;gap:4px;
    padding:7px 6px;border-radius:8px;border:1px solid ${color}30;
    background:${color}14;color:${color};font-size:11px;font-weight:700;
    cursor:pointer;text-decoration:none;font-family:'Space Grotesk',sans-serif;
    white-space:nowrap;`;
}

export default function RouteMap({ packages, onPkgClick, onPkgDelete, onPkgRestore, onVerifyLoad, readOnly, startPoint, visible = true }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const markersRef = useRef({});
  const lineRef = useRef(null);
  const startRef = useRef(null);

  // Init map once
  useEffect(() => {
    if (instanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([-33.45, -70.65], 12);
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

    // Register global callbacks
    window.__verifyLoad = () => onVerifyLoad?.();
    window.__pkgClick = (id) => {
      const pkg = (packages || []).find(p => p._id === id);
      if (pkg) onPkgClick?.(pkg);
    };
    window.__pkgDelete = (id) => {
      const pkg = (packages || []).find(p => p._id === id);
      if (pkg && confirm(`¿Eliminar a ${pkg.customerName}?`)) onPkgDelete?.(pkg);
    };
    window.__pkgRestore = (id) => {
      const pkg = (packages || []).find(p => p._id === id);
      if (pkg) onPkgRestore?.(pkg);
    };

    // Clear existing layers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};
    if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }
    if (startRef.current) { startRef.current.remove(); startRef.current = null; }

    const active = (packages || []).filter(p => p.status !== 'eliminado');
    const allPkgs = (packages || []);
    const withCoords = active.filter(p => p.lat && p.lng);
    const hasStartCoords = !!(startPoint?.lat && startPoint?.lng);
    // Full ordered route: start point first, then packages in order
    const routePoints = hasStartCoords
      ? [{ lat: startPoint.lat, lng: startPoint.lng }, ...withCoords]
      : withCoords;

    // Draw straight fallback line immediately, then replace with real road geometry
    if (routePoints.length > 1) {
      lineRef.current = L.polyline(
        routePoints.map(p => [p.lat, p.lng]),
        { color: '#008855', weight: 2.5, opacity: 0.35, dashArray: '6,10' }
      ).addTo(map);

      // Fetch actual road route from OSRM asynchronously
      const coordStr = routePoints.map(p => `${p.lng},${p.lat}`).join(';');
      fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`, {
        signal: AbortSignal.timeout(10000)
      })
        .then(r => r.json())
        .then(data => {
          if (data.code === 'Ok' && data.routes?.[0]?.geometry) {
            if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }
            const latlngs = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            lineRef.current = L.polyline(latlngs, { color: '#008855', weight: 3, opacity: 0.65 }).addTo(map);
          }
        })
        .catch(() => {}); // Keep straight fallback on error
    }

    // Start point — marker #1 (purple square)
    if (startPoint?.lat && startPoint?.lng) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:36px;height:36px;border-radius:9px;
          background:#5c35cc;
          border:2.5px solid rgba(255,255,255,.95);
          box-shadow:0 3px 14px rgba(92,53,204,.6);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;font-weight:900;color:#fff;
          font-family:'Space Grotesk',sans-serif;
          cursor:pointer;
        ">1</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -22]
      });
      startRef.current = L.marker([startPoint.lat, startPoint.lng], { icon }).addTo(map);
      const verifyBtn = onVerifyLoad
        ? `<button onclick="window.__verifyLoad()" style="${btnStyle('#5c35cc')}">📦 Verificar carga</button>`
        : '';
      startRef.current.bindPopup(
        `<div style="font-family:'Space Grotesk',sans-serif;min-width:190px">
          <b style="font-size:13px;color:#5c35cc">📍 Punto de salida</b>
          <div style="font-size:12px;color:#666;margin-top:4px">${startPoint.address || ''}</div>
          ${verifyBtn ? `<div style="margin-top:10px">${verifyBtn}</div>` : ''}
        </div>`,
        { maxWidth: 240 }
      );
    }

    // Package markers — numbered from 2 if start point exists (start = 1)
    const hasStart = hasStartCoords;
    let activeIdx = 0;
    allPkgs.forEach(pkg => {
      if (!pkg.lat || !pkg.lng) return;
      const idx = pkg.status !== 'eliminado' ? activeIdx++ : -1;
      if (pkg.status === 'eliminado') return; // skip eliminated
      const icon = makeIcon(pkg, idx, hasStart);
      const popup = makePopup(pkg, idx, hasStart, onPkgClick, readOnly);
      const marker = L.marker([pkg.lat, pkg.lng], { icon }).addTo(map);
      marker.bindPopup(popup, { maxWidth: 280 });
      markersRef.current[pkg._id] = marker;
    });

    // Fit map bounds
    const allPts = [
      ...withCoords.map(p => [p.lat, p.lng]),
      ...(startPoint?.lat && startPoint?.lng ? [[startPoint.lat, startPoint.lng]] : [])
    ];
    if (allPts.length === 1) {
      map.setView(allPts[0], 15);
    } else if (allPts.length > 1) {
      map.fitBounds(allPts, { padding: [50, 50], maxZoom: 15 });
    }
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
          zIndex: 900, pointerEvents: 'none', boxShadow: '0 2px 8px #0002',
          whiteSpace: 'nowrap'
        }}>
          ⚠️ {noCoords}/{total} sin coordenadas · usar "Geocodificar ruta" en INFO
        </div>
      )}
    </div>
  );
}
