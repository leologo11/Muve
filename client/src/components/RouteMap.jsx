import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, makeSvgIcon, spreadOverlapping } from '../utils/googleMaps.js';

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
  if (pkg.status === 'entregado') return '#0052FF';
  if (pkg.status === 'no-entregado') return '#cc2244';
  return ZONE_COLORS[pkg.zone] || ZONE_COLORS.default;
}

function btnStyle(color) {
  return `display:inline-flex;align-items:center;justify-content:center;gap:4px;
    padding:7px 6px;border-radius:8px;border:1px solid ${color}30;
    background:${color}14;color:${color};font-size:11px;font-weight:700;
    cursor:pointer;text-decoration:none;font-family:'Inter',sans-serif;white-space:nowrap;`;
}

function makePopupContent(pkg, idx, hasStart, readOnly) {
  const displayNum = hasStart ? idx + 2 : idx + 1;
  const color = pinColor(pkg);
  const statusText = { pendiente: '⏳ Pendiente', entregado: '✅ Entregado', 'no-entregado': '❌ No entregado', eliminado: '🗑️ Eliminado' }[pkg.status] || pkg.status;
  const price = pkg.price ? ` · $${Number(pkg.price).toLocaleString('es-CL')}` : '';
  const aptHtml = pkg.aptFloor ? `<div style="font-size:12px;font-weight:700;color:#d4650a;margin-top:2px;font-style:italic">${pkg.aptFloor}</div>` : '';
  const phoneHtml = pkg.customerPhone
    ? `<a href="tel:${pkg.customerPhone}" style="${btnStyle('#0052FF')}">📞 Llamar</a>`
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
    ? `<button onclick="window.__pkgRestore('${pkg._id}')" style="${btnStyle('#0052FF')}">↩ Restaurar</button>`
    : '';

  return `<div style="font-family:'Inter',sans-serif;min-width:210px;max-width:270px">
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

export default function RouteMap({ packages, onPkgClick, onPkgDelete, onPkgRestore, onVerifyLoad, readOnly, startPoint, visible = true, myLocation = null, driverLocation = null }) {
  const mapRef         = useRef(null);
  const gmRef          = useRef(null);
  const mapInst        = useRef(null);
  const markersRef     = useRef({});
  const lineRef        = useRef(null);
  const startRef       = useRef(null);
  const myLocationRef  = useRef(null);
  const myAccuracyRef  = useRef(null);
  const driverRef      = useRef(null);
  const infoWindowRef  = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Init map once
  useEffect(() => {
    loadGoogleMaps().then(gm => {
      if (!mapRef.current || mapInst.current) return;
      gmRef.current = gm;
      mapInst.current = new gm.Map(mapRef.current, {
        center: { lat: -33.45, lng: -70.65 },
        zoom: 12,
        gestureHandling: 'cooperative',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      infoWindowRef.current = new gm.InfoWindow();
      setMapReady(true);
    });
  }, []);

  // Resize when tab becomes visible
  useEffect(() => {
    if (visible && mapInst.current && gmRef.current) {
      gmRef.current.event.trigger(mapInst.current, 'resize');
    }
  }, [visible]);

  // Update markers on packages/startPoint change
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInst.current;
    const gm  = gmRef.current;
    if (!map || !gm) return;

    window.__verifyLoad  = () => onVerifyLoad?.();
    window.__pkgClick    = id => { const p = (packages || []).find(p => p._id === id); if (p) onPkgClick?.(p); };
    window.__pkgDelete   = id => { const p = (packages || []).find(p => p._id === id); if (p && confirm(`¿Eliminar a ${p.customerName}?`)) onPkgDelete?.(p); };
    window.__pkgRestore  = id => { const p = (packages || []).find(p => p._id === id); if (p) onPkgRestore?.(p); };

    // Clear existing layers
    Object.values(markersRef.current).forEach(m => m.setMap(null));
    markersRef.current = {};
    if (lineRef.current) { lineRef.current.setMap(null); lineRef.current = null; }
    if (startRef.current) { startRef.current.setMap(null); startRef.current = null; }

    const active = (packages || []).filter(p => p.status !== 'eliminado');
    const withCoords = active.filter(p => p.lat && p.lng);
    const hasStartCoords = !!(startPoint?.lat && startPoint?.lng);
    const routePoints = hasStartCoords
      ? [{ lat: startPoint.lat, lng: startPoint.lng }, ...withCoords]
      : withCoords;

    // Straight dashed fallback line
    if (routePoints.length > 1) {
      lineRef.current = new gm.Polyline({
        path: routePoints.map(p => ({ lat: p.lat, lng: p.lng })),
        strokeColor: '#0052FF',
        strokeOpacity: 0,
        strokeWeight: 3,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.35, strokeWeight: 2.5, scale: 4, strokeColor: '#0052FF' }, offset: '0', repeat: '16px' }],
        map,
      });

      // Replace with real road geometry from OSRM proxy
      const base = import.meta.env.VITE_API_URL || '/api';
      const token = localStorage.getItem('rf_token');
      fetch(`${base}/routes/osrm-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ coords: routePoints.map(p => [p.lng, p.lat]) }),
        signal: AbortSignal.timeout(10000),
      })
        .then(r => r.json())
        .then(data => {
          if (data.geometry?.coordinates && lineRef.current) {
            lineRef.current.setMap(null);
            lineRef.current = new gm.Polyline({
              path: data.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
              strokeColor: '#0052FF',
              strokeWeight: 3,
              strokeOpacity: 0.65,
              map,
            });
          }
        })
        .catch(() => {});
    }

    // Start point marker
    if (hasStartCoords) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
        <rect x="1.5" y="1.5" width="33" height="33" rx="8" fill="#5c35cc" stroke="rgba(255,255,255,.95)" stroke-width="2.5"/>
        <text x="18" y="24" text-anchor="middle" fill="white" font-family="Inter,Arial,sans-serif" font-size="16" font-weight="900">1</text>
      </svg>`;
      startRef.current = new gm.Marker({
        position: { lat: startPoint.lat, lng: startPoint.lng },
        icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: new gm.Size(36, 36), anchor: new gm.Point(18, 18) },
        map,
        zIndex: 10,
      });
      const verifyBtn = onVerifyLoad
        ? `<button onclick="window.__verifyLoad()" style="${btnStyle('#5c35cc')}">📦 Verificar carga</button>`
        : '';
      startRef.current.addListener('click', () => {
        infoWindowRef.current.setContent(
          `<div style="font-family:'Inter',sans-serif;min-width:190px">
            <b style="font-size:13px;color:#5c35cc">📍 Punto de salida</b>
            <div style="font-size:12px;color:#666;margin-top:4px">${startPoint.address || ''}</div>
            ${verifyBtn ? `<div style="margin-top:10px">${verifyBtn}</div>` : ''}
          </div>`
        );
        infoWindowRef.current.open(map, startRef.current);
      });
    }

    // Package markers — spread overlapping pins so stacked packages are visible
    const hasStart = hasStartCoords;
    const spread   = spreadOverlapping((packages || []).filter(p => p.status !== 'eliminado'), 45);

    let activeIdx = 0;
    spread.forEach(pkg => {
      if (!pkg.lat || !pkg.lng) return;
      const idx       = activeIdx++;
      const color     = pinColor(pkg);
      const num       = pkg.status === 'entregado' ? '✓' : pkg.status === 'no-entregado' ? '✗' : String(hasStart ? idx + 2 : idx + 1);
      const isGrouped = (pkg._groupSize || 1) > 1;
      const cs        = 32; // circle diameter
      const fs        = num.length > 2 ? 9 : 12;
      const lat       = pkg._dispLat || pkg.lat;
      const lng       = pkg._dispLng || pkg.lng;

      let svg, iconW, iconH, anchorX, anchorY;
      if (isGrouped) {
        // Badge pill above + connector line + circle below
        iconW  = cs;
        iconH  = cs + 22;           // 22px for pill+gap above circle
        anchorX = cs / 2;
        anchorY = 22 + cs / 2;      // anchor = center of circle
        svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconW}" height="${iconH}">
          <rect x="2" y="0" width="${iconW-4}" height="16" rx="8" fill="#111" stroke="white" stroke-width="1.5"/>
          <text x="${iconW/2}" y="11" text-anchor="middle" fill="white" font-family="Inter,Arial,sans-serif" font-size="9" font-weight="900">×${pkg._groupSize}</text>
          <line x1="${iconW/2}" y1="16" x2="${iconW/2}" y2="22" stroke="#111" stroke-width="2"/>
          <circle cx="${iconW/2}" cy="${22+cs/2}" r="${cs/2-1.5}" fill="${color}" stroke="white" stroke-width="2.5"/>
          <text x="${iconW/2}" y="${22+cs/2+4}" text-anchor="middle" fill="white" font-family="Inter,Arial,sans-serif" font-size="${fs}" font-weight="800">${num}</text>
        </svg>`;
      } else {
        iconW  = cs; iconH = cs; anchorX = cs / 2; anchorY = cs / 2;
        svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cs}" height="${cs}">
          <circle cx="${cs/2}" cy="${cs/2}" r="${cs/2-1.5}" fill="${color}" stroke="white" stroke-width="2.5"/>
          <text x="${cs/2}" y="${cs/2+4}" text-anchor="middle" fill="white" font-family="Inter,Arial,sans-serif" font-size="${fs}" font-weight="800">${num}</text>
        </svg>`;
      }

      const icon = {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new gm.Size(iconW, iconH),
        anchor: new gm.Point(anchorX, anchorY),
      };
      const marker = new gm.Marker({ position: { lat, lng }, icon, map, zIndex: 5 });
      const origPkg = (packages || []).find(p => p._id === pkg._id) || pkg;
      const content = makePopupContent(origPkg, idx, hasStart, readOnly);
      marker.addListener('click', () => {
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(map, marker);
      });
      markersRef.current[pkg._id] = marker;
    });

    // Fit bounds
    const allPts = [
      ...withCoords.map(p => new gm.LatLng(p.lat, p.lng)),
      ...(hasStartCoords ? [new gm.LatLng(startPoint.lat, startPoint.lng)] : []),
    ];
    if (allPts.length === 1) {
      map.setCenter(allPts[0]); map.setZoom(15);
    } else if (allPts.length > 1) {
      const bounds = new gm.LatLngBounds();
      allPts.forEach(p => bounds.extend(p));
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [mapReady, packages, startPoint, readOnly]);

  // My location (driver GPS)
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInst.current;
    const gm  = gmRef.current;
    if (!map || !gm) return;

    if (myAccuracyRef.current) { myAccuracyRef.current.setMap(null); myAccuracyRef.current = null; }
    if (myLocationRef.current) { myLocationRef.current.setMap(null); myLocationRef.current = null; }
    if (!myLocation?.lat || !myLocation?.lng) return;

    if (myLocation.accuracy && myLocation.accuracy < 500) {
      myAccuracyRef.current = new gm.Circle({
        center: { lat: myLocation.lat, lng: myLocation.lng },
        radius: myLocation.accuracy,
        strokeColor: '#1a73e8', strokeOpacity: 0.3, strokeWeight: 1,
        fillColor: '#1a73e8', fillOpacity: 0.08,
        map,
      });
    }

    const deg = (myLocation.heading != null && !isNaN(myLocation.heading)) ? myLocation.heading : null;
    const arrow = deg != null
      ? `<polygon points="18,3 22,13 14,13" fill="#1a73e8" transform="rotate(${deg},18,18)"/>`
      : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
      ${arrow}
      <circle cx="18" cy="18" r="9" fill="#1a73e8" stroke="white" stroke-width="3"/>
    </svg>`;
    myLocationRef.current = new gm.Marker({
      position: { lat: myLocation.lat, lng: myLocation.lng },
      icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: new gm.Size(36, 36), anchor: new gm.Point(18, 18) },
      map,
      zIndex: 20,
    });
  }, [mapReady, myLocation]);

  // Driver tracker (admin view)
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInst.current;
    const gm  = gmRef.current;
    if (!map || !gm) return;

    if (driverRef.current) { driverRef.current.setMap(null); driverRef.current = null; }
    if (!driverLocation?.lat || !driverLocation?.lng) return;

    const updatedAt  = driverLocation.updatedAt ? new Date(driverLocation.updatedAt) : null;
    const minsAgo    = updatedAt ? Math.round((Date.now() - updatedAt.getTime()) / 60000) : null;
    const freshness  = minsAgo == null ? '…' : minsAgo < 1 ? 'hace un momento' : `hace ${minsAgo} min`;
    const isStale    = minsAgo != null && minsAgo > 15;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38">
      <circle cx="19" cy="19" r="17" fill="#0077aa" stroke="white" stroke-width="3"/>
      <text x="19" y="25" text-anchor="middle" font-size="18" font-family="Arial">🚗</text>
    </svg>`;
    driverRef.current = new gm.Marker({
      position: { lat: driverLocation.lat, lng: driverLocation.lng },
      icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: new gm.Size(38, 38), anchor: new gm.Point(19, 19) },
      map,
      zIndex: 25,
    });
    driverRef.current.addListener('click', () => {
      infoWindowRef.current.setContent(
        `<div style="font-family:'Inter',sans-serif;min-width:170px">
          <div style="font-size:13px;font-weight:700;color:#0077aa;margin-bottom:4px">🚗 ${driverLocation.driverName || 'Driver'}</div>
          <div style="font-size:11px;color:${isStale ? '#cc2244' : '#666'}">${isStale ? '⚠ ' : '📡 '}Ubicación ${freshness}</div>
          ${driverLocation.speed != null ? `<div style="font-size:11px;color:#666;margin-top:2px">⚡ ${Math.round((driverLocation.speed || 0) * 3.6)} km/h</div>` : ''}
        </div>`
      );
      infoWindowRef.current.open(map, driverRef.current);
    });
  }, [mapReady, driverLocation]);

  const noCoords = (packages || []).filter(p => p.status !== 'eliminado' && (!p.lat || !p.lng)).length;
  const total    = (packages || []).filter(p => p.status !== 'eliminado').length;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#e8e8e0' }} />
      {noCoords > 0 && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          background: '#fff8e1', border: '1px solid #f57c0044', borderRadius: 20,
          padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#f57c00',
          zIndex: 900, pointerEvents: 'none', boxShadow: '0 2px 8px #0002', whiteSpace: 'nowrap',
        }}>
          ⚠️ {noCoords}/{total} sin coordenadas · usar "Geocodificar ruta" en INFO
        </div>
      )}
    </div>
  );
}
