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
  const dateStr   = new Date(route.date).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const totalAmt  = route.stats?.totalAmount || route.invoiceAmount || 0;

  const rowsHtml = active.map((p, i) => {
    const status = p.status === 'entregado' ? '✅ Entregado' : p.status === 'no-entregado' ? '❌ No entregado' : '⏳ Pendiente';
    const time   = p.deliveredAt ? new Date(p.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—';
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${p.customerName} ${p.customerLastName || ''}</td>
      <td>${p.address || ''}${p.commune ? ', ' + p.commune : ''}${p.aptFloor ? ' · ' + p.aptFloor : ''}</td>
      <td>${status}</td>
      <td>${time}</td>
      <td>${p.note || p.failReason || ''}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${route.name || route.routeCode} — Detalle de entrega</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 28px 32px; }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
    h2 { font-size: 13px; font-weight: 700; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
    .meta { font-size: 11px; color: #777; margin-bottom: 14px; }
    .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; flex: 1; min-width: 180px; }
    .card-title { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .card-val { font-size: 14px; font-weight: 800; }
    .stat-row { display: flex; gap: 20px; margin-bottom: 16px; }
    .stat { text-align: center; }
    .stat .num { font-size: 22px; font-weight: 800; }
    .stat .lbl { font-size: 10px; color: #888; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f5f7fa; border: 1px solid #e0e0e0; padding: 7px 8px; text-align: left; font-size: 11px; font-weight: 700; }
    td { border: 1px solid #eee; padding: 7px 8px; font-size: 11px; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 24px; font-size: 10px; color: #bbb; text-align: center; }
    @media print { button { display: none; } body { padding: 12px 16px; } }
  </style>
</head>
<body>
  <h1>📦 ${route.name || route.routeCode}</h1>
  <div class="meta">${dateStr}${route.routeCode !== route.name ? ' · ' + route.routeCode : ''}</div>

  <div class="cards">
    ${route.driverName ? `<div class="card">
      <div class="card-title">🚗 Driver</div>
      <div class="card-val">${route.driverName}</div>
      ${route.driverPhone ? `<div style="font-size:11px;color:#555;margin-top:3px">${route.driverPhone}</div>` : ''}
    </div>` : ''}
    ${route.clientCompany?.name ? `<div class="card">
      <div class="card-title">🏢 Empresa cliente</div>
      <div class="card-val">${route.clientCompany.name}</div>
      ${route.clientCompany.contactPerson ? `<div style="font-size:11px;color:#555;margin-top:3px">👤 ${route.clientCompany.contactPerson}</div>` : ''}
      ${route.clientCompany.contactPhone ? `<div style="font-size:11px;color:#555;margin-top:2px">${route.clientCompany.contactPhone}</div>` : ''}
    </div>` : ''}
    ${totalAmt > 0 ? `<div class="card">
      <div class="card-title">💰 Total ruta</div>
      <div class="card-val" style="color:#0052FF">$${totalAmt.toLocaleString('es-CL')}</div>
    </div>` : ''}
  </div>

  <div class="stat-row">
    <div class="stat"><div class="num">${active.length}</div><div class="lbl">Total</div></div>
    <div class="stat"><div class="num" style="color:#0052FF">${delivered.length}</div><div class="lbl">✅ Entregados</div></div>
    <div class="stat"><div class="num" style="color:#cc2244">${failed.length}</div><div class="lbl">❌ No entregados</div></div>
    <div class="stat"><div class="num" style="color:#f57c00">${pending.length}</div><div class="lbl">⏳ Pendientes</div></div>
  </div>

  <h2>Detalle de paquetes</h2>
  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>Destinatario</th>
        <th>Dirección</th>
        <th>Estado</th>
        <th>Hora</th>
        <th>Nota</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

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
        </div>
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
  const [tab, setTab]           = useState('list');
  const [search, setSearch]     = useState('');
  const [expandedPkg, setExpandedPkg] = useState(null);

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
  const visible = q
    ? active.filter(p => [p.customerName, p.customerLastName, p.address, p.commune, p.trackingId].filter(Boolean).join(' ').toLowerCase().includes(q))
    : active;

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
              ...(totalAmt > 0 ? [{ label: '$' + totalAmt.toLocaleString('es-CL'), value: '', color: '#0052FF', bold: true }] : [])
            ].map(({ label, value, color, bold }) => (
              <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: bold ? 13 : 18, fontWeight: 800, color }}>{bold ? label : value}</div>
                <div style={{ fontSize: 9, color: '#aaa', fontWeight: 600, marginTop: 1 }}>{bold ? (label.startsWith('$') ? 'total ruta' : 'avance') : label}</div>
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

      {/* ── Search (list only) ── */}
      {tab === 'list' && (
        <div style={{ flexShrink: 0, padding: '8px 12px', background: '#fff', borderBottom: '1px solid #e8e8e8' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar por nombre, dirección, tracking…"
            style={{ width: '100%', boxSizing: 'border-box', background: '#f5f7fa', border: '1px solid #e8e8e8', borderRadius: 22, padding: '8px 14px', fontSize: 13, outline: 'none' }}
          />
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
                <div style={{ fontSize: 13 }}>{q ? 'Sin resultados para esa búsqueda' : 'Sin paquetes en esta ruta'}</div>
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
