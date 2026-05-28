import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api/index.js';

const STATUS_META = {
  pendiente:      { label: '⏳ Pendiente',    color: '#888' },
  entregado:      { label: '✅ Entregado',     color: '#0052FF' },
  'no-entregado': { label: '❌ No entregado', color: '#cc2244' }
};

const ROUTE_STATUS = {
  draft:     { label: 'Borrador',      color: '#888',    bg: '#f5f5f5' },
  active:    { label: '● En curso',    color: '#0052FF', bg: '#0052FF12' },
  paused:    { label: '⏸ Pausada',    color: '#f57c00', bg: '#f57c0012' },
  completed: { label: '✓ Completada', color: '#0077aa', bg: '#0077aa12' },
  cancelled: { label: 'Cancelada',    color: '#cc2244', bg: '#cc224412' }
};

function pinColor(status) {
  if (status === 'entregado')    return '#0052FF';
  if (status === 'no-entregado') return '#cc2244';
  return '#f57c00';
}

function makePin(num, status) {
  const bg = pinColor(status);
  const symbol = status === 'entregado' ? '✓' : status === 'no-entregado' ? '✗' : num;
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};border:2px solid #fff;box-shadow:0 2px 6px #0005;display:flex;align-items:center;justify-content:center">
             <span style="transform:rotate(45deg);color:#fff;font-size:10px;font-weight:800;line-height:1">${symbol}</span>
           </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });
}

// ── PDF generator ──────────────────────────────────────────────────────────────
function generatePdf(route, packages) {
  const active    = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');
  const failed    = active.filter(p => p.status === 'no-entregado');
  const pending   = active.filter(p => p.status === 'pendiente');
  const fmt       = n => Number(n || 0).toLocaleString('es-CL');
  const dateStr   = new Date(route.date + 'T12:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const subtotalDelivered = delivered.reduce((s, p) => s + Number(p.price || 0), 0);
  const subtotalFailed    = failed.reduce((s, p) => s + Number(p.price || 0), 0);
  const subtotalPending   = pending.reduce((s, p) => s + Number(p.price || 0), 0);
  const netoTotal         = subtotalDelivered + subtotalFailed;
  const hasPrice          = active.some(p => Number(p.price || 0) > 0);

  const time = p => p.deliveredAt
    ? new Date(p.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const deliveredRows = delivered.map((p, i) => `
    <tr>
      <td style="text-align:center;color:#888">${i + 1}</td>
      <td>${p.customerName} ${p.customerLastName || ''}</td>
      <td>${p.address || ''}${p.commune ? ', ' + p.commune : ''}${p.aptFloor ? ' · ' + p.aptFloor : ''}</td>
      <td style="color:#555">${time(p)}</td>
      ${hasPrice ? `<td style="text-align:right;font-weight:700">$${fmt(p.price)}</td>` : ''}
    </tr>`).join('');

  const failedRows = failed.map((p, i) => `
    <tr>
      <td style="text-align:center;color:#888">${i + 1}</td>
      <td>${p.customerName} ${p.customerLastName || ''}</td>
      <td>${p.address || ''}${p.commune ? ', ' + p.commune : ''}${p.aptFloor ? ' · ' + p.aptFloor : ''}</td>
      <td style="color:#cc2244;font-weight:600">${p.failReason || '—'}</td>
      <td style="color:#555">${time(p)}</td>
      ${hasPrice ? `<td style="text-align:right;font-weight:700">$${fmt(p.price)}</td>` : ''}
    </tr>`).join('');

  const pendingRows = pending.map((p, i) => `
    <tr>
      <td style="text-align:center;color:#888">${i + 1}</td>
      <td>${p.customerName} ${p.customerLastName || ''}</td>
      <td>${p.address || ''}${p.commune ? ', ' + p.commune : ''}${p.aptFloor ? ' · ' + p.aptFloor : ''}</td>
      ${hasPrice ? `<td style="text-align:right;color:#aaa">$${fmt(p.price)}</td>` : ''}
    </tr>`).join('');

  const priceHeader = hasPrice ? '<th style="text-align:right">Precio</th>' : '';

  // ── Pricing tramos (from actual packages, group by commune + unit price) ──
  const tramosMap = {};
  active.forEach(p => {
    const commune = (p.commune || 'Sin comuna').trim();
    const price   = Number(p.price || 0);
    const key     = `${commune.toLowerCase()}::${price}`;
    if (!tramosMap[key]) tramosMap[key] = { commune, price, billed: 0, pendingCount: 0 };
    if (p.status === 'entregado' || p.status === 'no-entregado') tramosMap[key].billed++;
    else if (p.status === 'pendiente') tramosMap[key].pendingCount++;
  });
  const tramos = Object.values(tramosMap).sort((a, b) => b.price - a.price || a.commune.localeCompare(b.commune));
  const tramosRows = tramos.map(t => `
    <tr>
      <td style="font-weight:600">${t.commune}</td>
      <td style="text-align:center;font-weight:800;color:#0052FF">${t.price > 0 ? '$' + fmt(t.price) : '—'}</td>
      <td style="text-align:center">${t.billed > 0 ? `<span style="background:#dcfce7;color:#16a34a;border-radius:20px;padding:1px 8px;font-weight:700;font-size:10px">${t.billed} cobrado${t.billed > 1 ? 's' : ''}</span>` : '—'}</td>
      <td style="text-align:center">${t.pendingCount > 0 ? `<span style="background:#fff8e1;color:#f57c00;border-radius:20px;padding:1px 8px;font-weight:700;font-size:10px">${t.pendingCount} pend.</span>` : '—'}</td>
      <td style="text-align:right;font-weight:700">${t.billed > 0 && t.price > 0 ? '$' + fmt(t.billed * t.price) : '—'}</td>
    </tr>`).join('');

  // ── Filter: only communes actually used in this route's packages ──
  const usedCommunes = new Set(active.map(p => (p.commune || '').toLowerCase().trim()).filter(Boolean));
  const priceTiers = (route.priceTiers || [])
    .filter(t => t.commune && t.price > 0 && usedCommunes.has(t.commune.toLowerCase().trim()))
    .sort((a, b) => b.price - a.price || a.commune.localeCompare(b.commune));
  const tierRows = priceTiers.map(t => `
    <tr>
      <td>${t.commune}${t.zone ? ` <span style="font-size:10px;color:#94a3b8">· ${t.zone}</span>` : ''}</td>
      <td style="text-align:right;font-weight:700;color:#0052FF">$${fmt(t.price)}</td>
    </tr>`).join('');

  // ── Volume tier logic ──
  const volumeTiers = (route.volumeTiers || [])
    .filter(t => t.price > 0)
    .sort((a, b) => a.minQty - b.minQty);
  const billedCount  = delivered.length + failed.length;
  const totalCount   = active.length;
  const appliedTier  = volumeTiers.length
    ? [...volumeTiers].reverse().find(t => totalCount >= t.minQty) || volumeTiers[0]
    : null;
  const volTierRows = volumeTiers.map((t, i) => {
    const isApplied = appliedTier && t.minQty === appliedTier.minQty;
    return `<tr style="${isApplied ? 'background:#0052FF10;font-weight:800' : ''}">
      <td style="padding:7px 10px">${i === 0 ? '1 paquete' : `≥ ${t.minQty} paquetes`}</td>
      <td style="padding:7px 10px;text-align:right;color:#0052FF;font-weight:700">$${fmt(t.price)} / paquete</td>
      ${isApplied ? '<td style="padding:7px 10px;color:#16a34a;font-weight:800;font-size:11px">← aplica esta ruta</td>' : '<td></td>'}
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Liquidación ${route.routeCode} — MUVE</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;padding:28px 32px}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #0052FF;margin-bottom:20px}
    .logo{font-size:26px;font-weight:900;color:#0052FF;letter-spacing:-1px}.logo span{color:#00DAFF}
    .doc-right{text-align:right}
    .doc-title{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px}
    .doc-num{font-size:20px;font-weight:900;color:#0052FF}.doc-date{font-size:11px;color:#64748b}
    .info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px}
    .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 13px}
    .cl{font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px}
    .cv{font-size:13px;font-weight:700}.cs{font-size:11px;color:#64748b;margin-top:2px}
    .stats{display:flex;gap:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:18px}
    .st{flex:1;text-align:center;padding:10px 4px;border-right:1px solid #e2e8f0}
    .st:last-child{border-right:none}
    .sn{font-size:20px;font-weight:900}.sl{font-size:9px;color:#94a3b8;margin-top:2px}
    h3{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin:16px 0 7px}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px}
    thead tr{background:#0052FF}
    thead th{padding:7px 9px;color:#fff;font-size:10px;font-weight:700;text-align:left}
    tbody tr:nth-child(even){background:#f8fafc}
    tbody td{padding:7px 9px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    .bill{display:flex;justify-content:flex-end;margin-top:20px}
    .bill-box{width:280px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    .br{display:flex;justify-content:space-between;padding:8px 13px;border-bottom:1px solid #e2e8f0;font-size:12px}
    .br.total{background:#0052FF;color:#fff;font-size:14px;font-weight:900;border-bottom:none}
    .br.ref{color:#94a3b8;font-size:11px}
    .note{font-size:10px;color:#94a3b8;margin-top:5px;text-align:right}
    .tramos-section{margin-top:28px;padding-top:20px;border-top:2px dashed #e2e8f0}
    .tramos-section h3{color:#0052FF;border-bottom:none;margin-bottom:10px}
    .tramos-section table thead tr{background:#0052FF08}
    .tramos-section table thead th{color:#0052FF;font-size:10px}
    .tramos-note{font-size:10px;color:#94a3b8;margin-top:8px;line-height:1.5}
    .vol-box{background:#f0f4ff;border:1.5px solid #0052FF30;border-radius:10px;padding:14px 16px;margin-top:22px}
    .vol-box h3{color:#0052FF;margin-bottom:8px;border:none}
    .vol-tag{display:inline-block;background:#0052FF;color:#fff;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:800;margin-left:8px}
    .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
    @media print{body{padding:16px 20px}}
  </style>
</head>
<body>
<div class="hdr">
  <div><div class="logo">MU<span>VE</span></div><div style="font-size:10px;color:#64748b;margin-top:2px">Logística y Delivery · Chile</div></div>
  <div class="doc-right">
    <div class="doc-title">Liquidación de Ruta</div>
    <div class="doc-num">${route.routeCode}</div>
    <div class="doc-date">${dateStr}</div>
  </div>
</div>

<div class="info-grid">
  ${route.clientCompany?.name ? `<div class="card"><div class="cl">Cliente</div><div class="cv">${route.clientCompany.name}</div>${route.clientCompany.contactPerson ? `<div class="cs">👤 ${route.clientCompany.contactPerson}</div>` : ''}${route.clientCompany.contactPhone ? `<div class="cs">${route.clientCompany.contactPhone}</div>` : ''}</div>` : ''}
  ${route.driverName ? `<div class="card"><div class="cl">🚗 Repartidor</div><div class="cv">${route.driverName}</div>${route.driverPhone ? `<div class="cs">${route.driverPhone}</div>` : ''}</div>` : ''}
  <div class="card"><div class="cl">Ruta</div><div class="cv">${route.routeCode}${route.name ? ' · ' + route.name : ''}</div><div class="cs">${active.length} paquetes</div></div>
</div>

<div class="stats">
  <div class="st"><div class="sn">${active.length}</div><div class="sl">Total</div></div>
  <div class="st"><div class="sn" style="color:#16a34a">${delivered.length}</div><div class="sl">✅ Entregados</div></div>
  <div class="st"><div class="sn" style="color:#cc2244">${failed.length}</div><div class="sl">❌ Incidencias</div></div>
  <div class="st"><div class="sn" style="color:#f57c00">${pending.length}</div><div class="sl">⏳ Pendientes</div></div>
</div>

${delivered.length ? `
<h3>✅ Entregados (${delivered.length})</h3>
<table><thead><tr><th>#</th><th>Destinatario</th><th>Dirección</th><th>Hora</th>${priceHeader}</tr></thead>
<tbody>${deliveredRows}</tbody></table>` : ''}

${failed.length ? `
<h3>❌ No entregados — cobro por intento (${failed.length})</h3>
<table><thead><tr><th>#</th><th>Destinatario</th><th>Dirección</th><th>Motivo</th><th>Hora</th>${priceHeader}</tr></thead>
<tbody>${failedRows}</tbody></table>
<div style="font-size:10px;color:#cc2244;margin:4px 0 0">* El repartidor se presentó en el domicilio. Se cobra el intento de entrega.</div>` : ''}

${pending.length ? `
<h3>⏳ Pendientes — sin cobrar aún (${pending.length})</h3>
<table><thead><tr><th>#</th><th>Destinatario</th><th>Dirección</th>${hasPrice ? '<th style="text-align:right">Precio ref.</th>' : ''}</tr></thead>
<tbody>${pendingRows}</tbody></table>` : ''}

${hasPrice ? `
<div class="bill"><div class="bill-box">
  <div class="br"><span>Entregados (${delivered.length})</span><span>$${fmt(subtotalDelivered)}</span></div>
  ${failed.length ? `<div class="br"><span>Incidencias — cobro por intento (${failed.length})</span><span>$${fmt(subtotalFailed)}</span></div>` : ''}
  ${pending.length ? `<div class="br ref"><span>Pendientes sin cobrar (${pending.length})</span><span>$${fmt(subtotalPending)}</span></div>` : ''}
  <div class="br total"><span>NETO (sin IVA)</span><span>$${fmt(netoTotal)}</span></div>
</div></div>` : ''}

<div class="tramos-section">
  <h3>📋 Precio por comuna en esta ruta${route.tariffName ? ` <span style="font-size:10px;color:#94a3b8;font-weight:400">(tarifa: ${route.tariffName})</span>` : ''}</h3>

  ${volumeTiers.length > 0 ? `
  <!-- Volume tier scale -->
  <div style="font-size:11px;color:#475569;margin-bottom:8px">
    El precio unitario depende del total de paquetes en la ruta. Esta ruta tiene <strong>${totalCount} paquete${totalCount !== 1 ? 's' : ''}</strong>${appliedTier ? `, por lo que aplica el tramo de <strong>${appliedTier.minQty === 1 ? '1 paquete' : `≥${appliedTier.minQty} paquetes`}</strong> → <strong style="color:#0052FF">$${fmt(appliedTier.price)}</strong> por entrega.` : '.'}
  </div>
  <table style="margin-bottom:16px">
    <thead><tr>
      <th style="width:220px">Cantidad de paquetes en ruta</th>
      <th style="text-align:right">Precio por entrega</th>
      <th style="width:140px;text-align:center">Estado</th>
    </tr></thead>
    <tbody>${volTierRows}</tbody>
  </table>` : ''}

  ${priceTiers.length > 0 ? `
  <!-- Communes table -->
  <div style="font-size:10px;color:#94a3b8;margin-bottom:6px${volumeTiers.length > 0 ? ';border-top:1px solid #e2e8f0;padding-top:12px;margin-top:4px' : ''}">
    ${volumeTiers.length > 0 ? 'Precio base por comuna (antes del ajuste por volumen):' : 'Comunas de entrega en esta ruta y su precio acordado. Futuros envíos a las mismas comunas tendrán el mismo valor.'}
  </div>
  <table>
    <thead><tr style="background:#f1f5f9">
      <th style="color:#475569">Comuna / Sector</th>
      <th style="color:#475569;text-align:right">Precio por entrega</th>
    </tr></thead>
    <tbody>${tierRows}</tbody>
  </table>` : ''}

  ${hasPrice && tramos.length > 0 ? `
  <div style="border-top:1px solid #e2e8f0;margin-top:14px;padding-top:12px">
    <div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:7px">Resumen por comuna cobrado en esta ruta</div>
    <table>
      <thead><tr>
        <th>Tramo / Comuna</th>
        <th style="text-align:center">Precio unitario</th>
        <th style="text-align:center">Paquetes cobrados</th>
        <th style="text-align:center">Pendientes</th>
        <th style="text-align:right">Subtotal cobrado</th>
      </tr></thead>
      <tbody>${tramosRows}</tbody>
      <tfoot><tr style="background:#0052FF08;border-top:2px solid #0052FF30">
        <td colspan="4" style="font-weight:800;color:#0052FF;padding:9px">NETO TOTAL (sin IVA)</td>
        <td style="text-align:right;font-weight:900;color:#0052FF;font-size:14px;padding:9px">$${fmt(netoTotal)}</td>
      </tr></tfoot>
    </table>
  </div>` : ''}

  <div class="tramos-note" style="margin-top:10px">
    * Los paquetes "No entregado" se cobran al mismo valor ya que el repartidor se presentó en el domicilio.<br>
    * Los tramos de volumen se calculan sobre el total de paquetes en la ruta (entregados + no entregados + pendientes).
  </div>
</div>

<div class="footer">Generado por MUVE · ${new Date().toLocaleString('es-CL')}</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Public map ─────────────────────────────────────────────────────────────────
function PublicMap({ packages }) {
  const mapRef  = useRef(null);
  const mapInst = useRef(null);
  const mksRef  = useRef([]);

  useEffect(() => {
    if (mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([-33.45, -70.65], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(map);
    mapInst.current = map;
    setTimeout(() => map.invalidateSize(), 120);
  }, []);

  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;
    mksRef.current.forEach(m => map.removeLayer(m));
    mksRef.current = [];
    const active = packages.filter(p => p.status !== 'eliminado');
    const withCoords = active.filter(p => p.lat && p.lng);
    withCoords.forEach((pkg, i) => {
      const mk = L.marker([pkg.lat, pkg.lng], { icon: makePin(i + 1, pkg.status) }).addTo(map);
      mk.bindPopup(
        `<div style="font-family:'Inter',sans-serif;min-width:160px">
          <b style="font-size:13px">${pkg.customerName} ${pkg.customerLastName || ''}</b><br>
          <span style="font-size:11px;color:#555">${pkg.address || ''}${pkg.commune ? ', ' + pkg.commune : ''}</span><br>
          <span style="font-size:12px;font-weight:700;color:${pinColor(pkg.status)}">${STATUS_META[pkg.status]?.label || pkg.status}</span>
        </div>`,
        { maxWidth: 240 }
      );
      mksRef.current.push(mk);
    });
    if (withCoords.length > 0) {
      map.fitBounds(L.latLngBounds(withCoords.map(p => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 14 });
    }
    setTimeout(() => map.invalidateSize(), 80);
  }, [packages]);

  const withCoords = packages.filter(p => p.lat && p.lng && p.status !== 'eliminado').length;
  const total      = packages.filter(p => p.status !== 'eliminado').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {withCoords < total && (
        <div style={{ background: '#fff8e1', borderBottom: '1px solid #f57c0033', padding: '6px 14px', fontSize: 11, color: '#f57c00', fontWeight: 600, flexShrink: 0 }}>
          ⚠ {total - withCoords} paquete{total - withCoords !== 1 ? 's' : ''} sin coordenadas
        </div>
      )}
      <div ref={mapRef} style={{ flex: 1 }} />
    </div>
  );
}

// ── Package card ───────────────────────────────────────────────────────────────
function PkgCard({ pkg, expanded, onToggle }) {
  const meta = STATUS_META[pkg.status] || STATUS_META.pendiente;
  return (
    <div
      style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e8e8', marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px #0000000a', cursor: 'pointer' }}
      onClick={onToggle}
    >
      <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: pkg.status === 'entregado' ? '#0052FF' : pkg.status === 'no-entregado' ? '#cc2244' : '#e8e8e8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: pkg.status === 'pendiente' ? '#888' : '#fff'
        }}>
          {pkg.status === 'entregado' ? '✓' : pkg.status === 'no-entregado' ? '✗' : pkg.order + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pkg.customerName} {pkg.customerLastName}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pkg.address}{pkg.commune ? `, ${pkg.commune}` : ''}
          </div>
          {pkg.aptFloor && <div style={{ fontSize: 11, color: '#d4650a', fontWeight: 600 }}>{pkg.aptFloor}</div>}
          {pkg.status === 'no-entregado' && pkg.failReason && (
            <div style={{ fontSize: 11, color: '#cc2244', fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ✗ {pkg.failReason}
            </div>
          )}
        </div>
        {pkg.photoUrl && (
          <a href={pkg.photoUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
            <img
              src={pkg.photoUrl}
              alt="foto"
              style={{ width: 52, height: 44, objectFit: 'cover', borderRadius: 8, border: '2px solid #e8e8e8', flexShrink: 0, display: 'block' }}
            />
          </a>
        )}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</div>
          {pkg.deliveredAt && (
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
              {new Date(pkg.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <div style={{ color: '#ccc', fontSize: 12, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 14px', background: '#fafafa' }}>
          {pkg.status === 'no-entregado' && pkg.failReason && (
            <div style={{ background: '#fff0f2', border: '1px solid #cc224420', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#cc2244', fontWeight: 600 }}>
              Motivo: {pkg.failReason}
            </div>
          )}
          {pkg.note && (
            <div style={{ background: '#fffde7', border: '1px solid #f57c0020', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#555' }}>
              📝 {pkg.note}
            </div>
          )}
          {(pkg.photoUrl || pkg.photo2Url) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[pkg.photoUrl, pkg.photo2Url].filter(Boolean).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', flex: 1 }}>
                  <img src={url} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, border: '1px solid #e8e8e8' }} />
                </a>
              ))}
            </div>
          )}
          {!pkg.photoUrl && !pkg.photo2Url && pkg.status === 'pendiente' && (
            <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12, paddingBottom: 8 }}>Sin fotos aún</div>
          )}
          <a
            href={`https://waze.com/ul?q=${encodeURIComponent((pkg.address || '') + (pkg.commune ? ', ' + pkg.commune : '') + ', Chile')}&navigate=yes`}
            target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: '#0077aa14', border: '1px solid #0077aa30', color: '#0077aa', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
          >
            🔵 Ver en Waze
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────
export default function PublicRouteView() {
  const { shareToken } = useParams();
  const [route, setRoute]       = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [tab, setTab]             = useState('list');
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedPkg, setExpandedPkg]   = useState(null);

  const load = useCallback(() =>
    api.getPublicRoute(shareToken)
      .then(data => { setRoute(data.route); setPackages(data.packages); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  , [shareToken]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!route || route.status !== 'active') return;
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [route?.status, load]);

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
        <div style={{ fontSize: 14 }}>Cargando estado de la ruta…</div>
      </div>
    </div>
  );

  if (error || !route) return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', color: '#cc2244', padding: '0 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Enlace no válido</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>Este enlace no existe o ya no está disponible.</div>
      </div>
    </div>
  );

  const active    = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado').length;
  const failed    = active.filter(p => p.status === 'no-entregado').length;
  const pending   = active.filter(p => p.status === 'pendiente').length;
  const total     = active.length;
  const progress  = total > 0 ? Math.round((delivered + failed) / total * 100) : 0;
  const routeMeta = ROUTE_STATUS[route.status] || ROUTE_STATUS.draft;
  const totalAmt  = route.stats?.totalAmount || route.invoiceAmount || 0;

  const q = search.toLowerCase().trim();
  const filtered = statusFilter === 'all' ? active : active.filter(p => p.status === statusFilter);
  const visible = q
    ? filtered.filter(p => [p.customerName, p.customerLastName, p.address, p.commune, p.trackingId].filter(Boolean).join(' ').toLowerCase().includes(q))
    : filtered;

  const driverWaPhone = route.driverPhone?.replace(/[^0-9]/g, '');

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif", background: '#f5f7fa', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '12px 16px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>📦</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#111', flex: 1, minWidth: 0 }}>{route.name || route.routeCode}</span>
            <button
              onClick={() => generatePdf(route, packages)}
              style={{ flexShrink: 0, padding: '5px 11px', borderRadius: 20, border: '1px solid #0077aa30', background: '#0077aa10', color: '#0077aa', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              📄 PDF
            </button>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: routeMeta.bg, color: routeMeta.color, border: `1px solid ${routeMeta.color}30`, flexShrink: 0 }}>
              {routeMeta.label}
            </span>
          </div>

          {/* Date */}
          <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
            {new Date(route.date).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, background: '#f0f0f0', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #0052FF, #00DAFF)', borderRadius: 6, transition: 'width .5s' }} />
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
            {[
              { label: 'Total', value: total, color: '#555' },
              { label: '✅', value: delivered, color: '#0052FF' },
              { label: '❌', value: failed, color: '#cc2244' },
              { label: '⏳', value: pending, color: '#f57c00' },
              { label: `${progress}%`, value: '', color: '#111', bold: true },
            ].map(({ label, value, color, bold }) => (
              <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: bold ? 13 : 18, fontWeight: 800, color }}>{bold ? label : value}</div>
                <div style={{ fontSize: 9, color: '#aaa', fontWeight: 600, marginTop: 1 }}>{bold ? 'avance' : label}</div>
              </div>
            ))}
          </div>

          {/* Driver + Company info cards */}
          {(route.driverName || route.clientCompany?.name) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {route.driverName && (
                <div style={{ flex: 1, minWidth: 160, background: '#f5f7fa', border: '1px solid #e8e8e8', borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0077aa', letterSpacing: 1, marginBottom: 4 }}>🚗 DRIVER</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{route.driverName}</div>
                  {route.driverPhone && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <a
                        href={`tel:${route.driverPhone}`}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 8px', borderRadius: 8, background: '#0077aa12', border: '1px solid #0077aa25', color: '#0077aa', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                      >
                        📞 Llamar
                      </a>
                      <a
                        href={`https://wa.me/${driverWaPhone}?text=${encodeURIComponent('Hola, te contacto por la ruta ' + (route.name || route.routeCode))}`}
                        target="_blank" rel="noreferrer"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 8px', borderRadius: 8, background: '#0052FF12', border: '1px solid #0052FF25', color: '#0052FF', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              )}

              {route.clientCompany?.name && (
                <div style={{ flex: 1, minWidth: 160, background: '#f5f7fa', border: '1px solid #e8e8e8', borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#005078', letterSpacing: 1, marginBottom: 4 }}>🏢 EMPRESA CLIENTE</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{route.clientCompany.name}</div>
                  {route.clientCompany.contactPerson && (
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>👤 {route.clientCompany.contactPerson}</div>
                  )}
                  {route.clientCompany.contactPhone && (
                    <a
                      href={`tel:${route.clientCompany.contactPhone}`}
                      style={{ display: 'block', fontSize: 11, color: '#0077aa', fontWeight: 600, marginTop: 4, textDecoration: 'none' }}
                    >
                      📞 {route.clientCompany.contactPhone}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ flexShrink: 0, display: 'flex', background: '#fff', borderBottom: '1px solid #e8e8e8' }}>
        {[['list', '📋 Lista'], ['map', '🗺 Mapa']].map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 4px', fontSize: 12, fontWeight: 700, border: 'none',
            background: 'none', cursor: 'pointer', letterSpacing: .3,
            color: tab === t ? '#0052FF' : '#aaa',
            borderBottom: `2px solid ${tab === t ? '#0052FF' : 'transparent'}`
          }}>{lbl}</button>
        ))}
      </div>

      {/* ── Search + filters (list only) ── */}
      {tab === 'list' && (
        <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e8e8e8' }}>
          <div style={{ padding: '8px 12px 6px' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Buscar por nombre, dirección, tracking…"
              style={{ width: '100%', boxSizing: 'border-box', background: '#f5f7fa', border: '1px solid #e8e8e8', borderRadius: 22, padding: '8px 14px', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px', overflowX: 'auto' }}>
            {[
              { key: 'all',           label: 'Todos',          count: total,     color: '#64748b', bg: '#f1f5f9' },
              { key: 'entregado',     label: '✅ Entregados',  count: delivered, color: '#16a34a', bg: '#dcfce7' },
              { key: 'no-entregado',  label: '❌ Incidencias', count: failed,    color: '#cc2244', bg: '#fff0f2' },
              { key: 'pendiente',     label: '⏳ Pendientes',  count: pending,   color: '#f57c00', bg: '#fff8e1' },
            ].map(({ key, label, count, color, bg }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: statusFilter === key ? bg : 'transparent',
                  color: statusFilter === key ? color : '#94a3b8',
                  outline: statusFilter === key ? `1.5px solid ${color}40` : 'none',
                }}
              >
                {label} <span style={{ fontWeight: 800 }}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: tab === 'map' ? 'hidden' : 'auto' }}>
        {tab === 'map' && (
          <div style={{ height: '100%' }}>
            <PublicMap packages={active} />
          </div>
        )}

        {tab === 'list' && (
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '12px 12px 40px' }}>
            {visible.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 13 }}>
                  {q ? 'Sin resultados para esa búsqueda' : statusFilter !== 'all' ? 'No hay paquetes en esta categoría' : 'Sin paquetes en esta ruta'}
                </div>
              </div>
            )}
            {visible.map(pkg => (
              <PkgCard
                key={pkg._id}
                pkg={pkg}
                expanded={expandedPkg === pkg._id}
                onToggle={() => setExpandedPkg(expandedPkg === pkg._id ? null : pkg._id)}
              />
            ))}
            <div style={{ textAlign: 'center', marginTop: 16, color: '#ccc', fontSize: 11 }}>
              {route.status === 'active' ? 'Actualización automática cada 60 s · ' : ''}MUVE
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
