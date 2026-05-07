import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import Header from '../../components/Header.jsx';
import RouteMap from '../../components/RouteMap.jsx';
import DeliveryModal from '../../components/DeliveryModal.jsx';
import Toast, { toast } from '../../components/Toast.jsx';

const STATUS_COLOR = { entregado: '#0052FF', 'no-entregado': '#cc2244', pendiente: '#f57c00' };
const STATUS_LABEL = { entregado: '✅ Entregado', 'no-entregado': '❌ No entregado', pendiente: '⏳ Pendiente' };
const STATUS_BG = { entregado: '#0052FF12', 'no-entregado': '#cc224412', pendiente: '#f57c0012' };

export default function CompanyView() {
  const [routes, setRoutes] = useState([]);
  const [routeSearch, setRouteSearch] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [packages, setPackages] = useState([]);
  const [pkgSearch, setPkgSearch] = useState('');
  const [pkgFilter, setPkgFilter] = useState('todos');
  const [tab, setTab] = useState('l');
  const [viewPkg, setViewPkg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRoutes()
      .then(r => setRoutes(r))
      .catch(e => toast('❌ ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadRoute = async (route) => {
    try {
      const { route: full, packages } = await api.getRoute(route._id);
      setSelectedRoute(full);
      setPackages(packages);
      setPkgSearch('');
      setPkgFilter('todos');
      setTab('l');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const goBack = () => {
    setSelectedRoute(null);
    setPackages([]);
  };

  // ── Routes list view ──
  if (!selectedRoute) {
    const filtered = routes.filter(r => {
      const q = routeSearch.toLowerCase();
      return !q || [r.routeCode, r.name, r.driverId?.name].filter(Boolean).join(' ').toLowerCase().includes(q);
    });

    if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Cargando…</div>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header title="🏢 Mis rutas" />

        {/* Search bar */}
        <div style={{ padding: '10px 12px', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <input
              value={routeSearch}
              onChange={e => setRouteSearch(e.target.value)}
              placeholder="🔍 Buscar ruta por ID, nombre o repartidor…"
              style={{
                width: '100%', background: 'var(--card2)', border: '1px solid var(--border)',
                borderRadius: 22, padding: '10px 40px 10px 16px', fontSize: 14, outline: 'none'
              }}
            />
            {routeSearch && (
              <span onClick={() => setRouteSearch('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--muted)', fontSize: 18 }}>×</span>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px calc(40px + env(safe-area-inset-bottom))' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p style={{ fontSize: 14 }}>{routes.length === 0 ? 'No tienes rutas asignadas.' : 'Sin resultados.'}</p>
            </div>
          ) : (
            filtered.map(r => <RouteCard key={r._id} route={r} onClick={() => loadRoute(r)} />)
          )}
        </div>

        <Toast />
      </div>
    );
  }

  // ── Route packages view ──
  const active = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');
  const progress = active.length ? Math.round(delivered.length / active.length * 100) : 0;

  const filteredPkgs = active.filter(p => {
    const q = pkgSearch.toLowerCase();
    const matchQ = !q || [p.customerName, p.customerLastName, p.address, p.commune, p.trackingId, p.customerPhone].filter(Boolean).join(' ').toLowerCase().includes(q);
    const matchF = pkgFilter === 'todos' || p.status === pkgFilter;
    return matchQ && matchF;
  });

  const stats = [
    { label: 'Entregadas', value: delivered.length, color: '#0052FF' },
    { label: 'Pendientes', value: active.filter(p => p.status === 'pendiente').length, color: '#f57c00' },
    { label: '% Listo', value: `${progress}%`, color: progress === 100 ? '#0052FF' : 'var(--text)' }
  ];

  const downloadCSV = () => {
    const rows = [
      ['#', 'Nombre', 'Dirección', 'Depto/Casa', 'Comuna', 'Teléfono', 'Estado', 'Motivo', 'Nota', 'Hora entrega'],
      ...active.map((p, i) => [
        i + 1,
        `${p.customerName} ${p.customerLastName || ''}`.trim(),
        p.address, p.aptFloor || '', p.commune || '', p.customerPhone || '',
        STATUS_LABEL[p.status] || p.status,
        p.failReason || '', p.note || '',
        p.deliveredAt ? new Date(p.deliveredAt).toLocaleString('es-CL') : ''
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reporte-${selectedRoute.routeCode}.csv`;
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title={selectedRoute.name || selectedRoute.routeCode}
        stats={stats}
        onBack={goBack}
      />

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--border)', flexShrink: 0 }}>
        <div style={{ height: 3, background: 'var(--accent)', width: `${progress}%`, transition: 'width .5s', borderRadius: 2 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[['l', '📋 PAQUETES'], ['m', '🗺 MAPA'], ['r', '📊 REPORTE']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700,
            letterSpacing: .5, border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t ? 'var(--accent)' : 'var(--muted)',
            borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`
          }}>{label}</button>
        ))}
      </div>

      {/* Package search (list tab) */}
      {tab === 'l' && (
        <div style={{ padding: '8px 10px 4px', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ position: 'relative', marginBottom: 7 }}>
            <input
              value={pkgSearch}
              onChange={e => setPkgSearch(e.target.value)}
              placeholder="🔍 Buscar por nombre, dirección, tracking ID…"
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 22, padding: '8px 36px 8px 14px', fontSize: 13, outline: 'none' }}
            />
            {pkgSearch && (
              <span onClick={() => setPkgSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--muted)', fontSize: 18 }}>×</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
            {['todos', 'pendiente', 'entregado', 'no-entregado'].map(f => (
              <button key={f} onClick={() => setPkgFilter(f)} style={{
                flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: pkgFilter === f ? 'var(--accent)' : 'var(--card2)',
                color: pkgFilter === f ? '#fff' : 'var(--muted)'
              }}>
                {{ todos: `Todos (${active.length})`, pendiente: `⏳ ${active.filter(p=>p.status==='pendiente').length}`, entregado: `✅ ${delivered.length}`, 'no-entregado': `❌ ${active.filter(p=>p.status==='no-entregado').length}` }[f]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Map */}
        <div style={{ display: tab === 'm' ? 'block' : 'none', height: '100%' }}>
          <RouteMap packages={packages} onPkgClick={setViewPkg} startPoint={selectedRoute?.startPoint} readOnly visible={tab === 'm'} />
        </div>

        {/* Packages list */}
        {tab === 'l' && (
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
            {filteredPkgs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>🔍 Sin resultados</div>
            ) : filteredPkgs.map((p, i) => (
              <PkgRow key={p._id} pkg={p} index={i} onClick={() => setViewPkg(p)} />
            ))}
          </div>
        )}

        {/* Report */}
        {tab === 'r' && (
          <CompanyReport
            packages={packages}
            route={selectedRoute}
            onDownload={downloadCSV}
          />
        )}
      </div>

      {viewPkg && <DeliveryModal pkg={viewPkg} onClose={() => setViewPkg(null)} readOnly />}
      <Toast />
    </div>
  );
}

// ── Route card in list ──
function RouteCard({ route, onClick }) {
  const s = route.stats || {};
  const progress = s.total ? Math.round((s.delivered / s.total) * 100) : 0;
  const statusColor = { active: '#0052FF', paused: '#f57c00', completed: '#0077aa', draft: '#999', cancelled: '#cc2244' }[route.status] || '#999';
  const statusLabel = { active: '● Activa', paused: '⏸ Pausada', completed: '✓ Completada', draft: 'Borrador', cancelled: 'Cancelada' }[route.status] || route.status;

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 14, border: '1px solid var(--border)',
        padding: '14px 16px', marginBottom: 10, cursor: 'pointer',
        boxShadow: '0 1px 4px #0000000a',
        transition: 'box-shadow .15s'
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 12px #00000015'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px #0000000a'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{route.name || route.routeCode}</div>
          {route.name && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{route.routeCode}</div>}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            📅 {new Date(route.date).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
            {route.driverId?.name ? ` · 🚗 ${route.driverId.name}` : ''}
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30`, flexShrink: 0, marginLeft: 8 }}>
          {statusLabel}
        </span>
      </div>

      {s.total > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: '#0052FF', fontWeight: 700 }}>✅ {s.delivered}</span>
            <span style={{ color: '#cc2244', fontWeight: 700 }}>❌ {s.failed}</span>
            <span style={{ color: '#f57c00', fontWeight: 700 }}>⏳ {s.pending}</span>
            <span style={{ color: 'var(--muted)' }}>/ {s.total} total</span>
          </div>
          <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: 5, background: 'var(--accent)', width: `${progress}%`, borderRadius: 3, transition: 'width .5s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>{progress}% completado</div>
        </>
      )}

      <div style={{ marginTop: 10, color: 'var(--accent)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
        Ver paquetes →
      </div>
    </div>
  );
}

// ── Package row in list ──
function PkgRow({ pkg, index, onClick }) {
  const color = STATUS_COLOR[pkg.status] || 'var(--muted)';
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px', borderBottom: '1px solid var(--border)',
        cursor: 'pointer', background: '#fff',
        transition: 'background .1s'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--card2)'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
    >
      {/* Status circle */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: STATUS_BG[pkg.status] || 'var(--card2)',
        border: `2px solid ${color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color, marginTop: 2
      }}>
        {pkg.status === 'entregado' ? '✓' : pkg.status === 'no-entregado' ? '✗' : index + 1}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{pkg.customerName} {pkg.customerLastName}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pkg.address}{pkg.aptFloor ? ` · ${pkg.aptFloor}` : ''}{pkg.commune ? ` · ${pkg.commune}` : ''}
        </div>
        {pkg.customerPhone && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>📞 {pkg.customerPhone}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color, background: STATUS_BG[pkg.status], padding: '2px 8px', borderRadius: 10, border: `1px solid ${color}25` }}>
            {STATUS_LABEL[pkg.status] || pkg.status}
          </span>
          {pkg.deliveredAt && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(pkg.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        {pkg.failReason && <div style={{ fontSize: 11, color: '#cc2244', marginTop: 3 }}>↳ {pkg.failReason}</div>}
        {pkg.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>📝 {pkg.note}</div>}
      </div>

      {/* Photos */}
      {(pkg.photoUrl || pkg.photo2Url) && (
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {pkg.photoUrl && <img src={pkg.photoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 7, objectFit: 'cover' }} />}
          {pkg.photo2Url && <img src={pkg.photo2Url} alt="" style={{ width: 44, height: 44, borderRadius: 7, objectFit: 'cover' }} />}
        </div>
      )}
    </div>
  );
}

// ── Report tab ──
function CompanyReport({ packages, route, onDownload }) {
  const active = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');
  const failed = active.filter(p => p.status === 'no-entregado');
  const pending = active.filter(p => p.status === 'pendiente');
  const driver = route?.driverId;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 12px calc(40px + env(safe-area-inset-bottom))' }}>

      {/* Driver card */}
      {driver && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Repartidor</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🚗 {driver.name}</div>
          {driver.phone && <a href={`tel:${driver.phone}`} style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, display: 'block', marginTop: 4, textDecoration: 'none' }}>📞 {driver.phone}</a>}
          {driver.vehicle && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>🚘 {driver.vehicle}{driver.licensePlate ? ` · ${driver.licensePlate}` : ''}</div>}
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Total', val: active.length, color: 'var(--text)' },
          { label: 'Entregados', val: delivered.length, color: '#0052FF' },
          { label: 'No entregados', val: failed.length, color: '#cc2244' },
          { label: 'Pendientes', val: pending.length, color: '#f57c00' }
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Download */}
      <button onClick={onDownload} style={{
        width: '100%', padding: '13px 16px', borderRadius: 12,
        border: '1px solid var(--border)', background: '#fff',
        color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
      }}>
        📥 Descargar reporte CSV
      </button>

      {/* Package list */}
      {[
        { list: delivered, label: `✅ Entregados (${delivered.length})`, color: '#0052FF' },
        { list: failed, label: `❌ No entregados (${failed.length})`, color: '#cc2244' },
        { list: pending, label: `⏳ Pendientes (${pending.length})`, color: '#f57c00' }
      ].filter(s => s.list.length > 0).map(({ list, label, color }) => (
        <div key={label}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', padding: '10px 0 6px', textTransform: 'uppercase' }}>{label}</div>
          {list.map(p => (
            <div key={p._id} style={{ background: '#fff', border: `1px solid ${color}28`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.customerName} {p.customerLastName}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.address}{p.aptFloor ? `, ${p.aptFloor}` : ''}{p.commune ? `, ${p.commune}` : ''}</div>
              {p.failReason && <div style={{ fontSize: 11, color: '#cc2244', marginTop: 3 }}>↳ {p.failReason}</div>}
              {p.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>📝 {p.note}</div>}
              {p.deliveredAt && <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 4 }}>{new Date(p.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</div>}
              {(p.photoUrl || p.photo2Url) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {p.photoUrl && <img src={p.photoUrl} alt="" onClick={() => window.open(p.photoUrl, '_blank')} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} />}
                  {p.photo2Url && <img src={p.photo2Url} alt="" onClick={() => window.open(p.photo2Url, '_blank')} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} />}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
