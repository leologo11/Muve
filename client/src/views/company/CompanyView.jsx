import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import Header from '../../components/Header.jsx';
import RouteMap from '../../components/RouteMap.jsx';
import DeliveryModal from '../../components/DeliveryModal.jsx';
import Toast, { toast } from '../../components/Toast.jsx';

export default function CompanyView() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [packages, setPackages] = useState([]);
  const [tab, setTab] = useState('l');
  const [viewPkg, setViewPkg] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRoutes().then(r => {
      setRoutes(r);
      if (r[0]) loadRoute(r[0]._id);
    }).catch(e => toast('❌ ' + e.message)).finally(() => setLoading(false));
  }, []);

  const loadRoute = async (id) => {
    try {
      const { route, packages } = await api.getRoute(id);
      setSelectedRoute(route);
      setPackages(packages);
      setSearch('');
      setFilterStatus('todos');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const active = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');

  const stats = selectedRoute ? [
    { label: 'Entregadas', value: delivered.length, color: 'var(--accent)' },
    { label: 'No entregadas', value: active.filter(p => p.status === 'no-entregado').length, color: 'var(--danger)' },
    { label: 'Pendientes', value: active.filter(p => p.status === 'pendiente').length },
    { label: '% Completado', value: active.length ? `${Math.round(delivered.length / active.length * 100)}%` : '0%', color: 'var(--accent)' }
  ] : null;

  const filtered = active.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || [p.customerName, p.customerLastName, p.address, p.commune, p.trackingId, p.customerPhone].filter(Boolean).join(' ').toLowerCase().includes(q);
    const matchF = filterStatus === 'todos' || p.status === filterStatus;
    return matchQ && matchF;
  });

  const downloadReport = () => {
    if (!selectedRoute) return;
    const rows = [
      ['#', 'Nombre', 'Dirección', 'Comuna', 'Teléfono', 'Estado', 'Motivo', 'Nota', 'Entregado en'],
      ...active.map((p, i) => [
        i + 1,
        `${p.customerName} ${p.customerLastName || ''}`.trim(),
        p.address,
        p.commune || '',
        p.customerPhone || '',
        p.status,
        p.failReason || '',
        p.note || '',
        p.deliveredAt ? new Date(p.deliveredAt).toLocaleString('es-CL') : ''
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${selectedRoute.routeCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Cargando…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title={selectedRoute ? `🏢 ${selectedRoute.routeCode}` : '🏢 Empresa'} stats={stats} />

      {/* Route selector */}
      <div style={{ display: 'flex', gap: 5, padding: '8px 12px', overflowX: 'auto', background: '#fff', borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}>
        {routes.map(r => (
          <button key={r._id} onClick={() => loadRoute(r._id)} style={{
            flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            border: '1px solid var(--border)', cursor: 'pointer',
            background: selectedRoute?._id === r._id ? 'var(--accent)' : 'var(--card2)',
            color: selectedRoute?._id === r._id ? '#fff' : 'var(--muted)'
          }}>
            {r.routeCode}{r.name ? ` · ${r.name}` : ''} · {new Date(r.date).toLocaleDateString('es-CL')}
          </button>
        ))}
        {routes.length === 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>Sin rutas asignadas</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[['l', '📋 LISTA'], ['m', '🗺 MAPA'], ['r', '📊 REPORTE']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700,
            letterSpacing: .5, border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t ? 'var(--accent)' : 'var(--muted)',
            borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`
          }}>{label}</button>
        ))}
      </div>

      {/* Search bar (list tab) */}
      {tab === 'l' && (
        <div style={{ padding: '8px 10px 4px', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar por nombre, dirección, ID tracking…"
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 22, padding: '8px 14px', fontSize: 14, outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 7, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {['todos', 'pendiente', 'entregado', 'no-entregado'].map(f => (
              <button key={f} onClick={() => setFilterStatus(f)} style={{
                flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', border: '1px solid var(--border)',
                background: filterStatus === f ? 'var(--accent)' : 'var(--card2)',
                color: filterStatus === f ? '#fff' : 'var(--muted)'
              }}>
                {{ todos: 'Todos', pendiente: '⏳ Pendientes', entregado: '✅ Entregados', 'no-entregado': '❌ No entregados' }[f]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Map */}
        <div style={{ display: tab === 'm' ? 'block' : 'none', height: '100%' }}>
          <RouteMap packages={packages} onPkgClick={setViewPkg} readOnly visible={tab === 'm'} />
        </div>

        {/* List */}
        {tab === 'l' && (
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>🔍 Sin resultados</div>
            ) : (
              filtered.map(p => (
                <CompanyPackageCard key={p._id} pkg={p} onClick={() => setViewPkg(p)} />
              ))
            )}
          </div>
        )}

        {/* Report */}
        {tab === 'r' && <CompanyReport packages={packages} route={selectedRoute} onDownload={downloadReport} />}
      </div>

      {viewPkg && (
        <DeliveryModal pkg={viewPkg} onClose={() => setViewPkg(null)} readOnly />
      )}

      <Toast />
    </div>
  );
}

function CompanyPackageCard({ pkg, onClick }) {
  const statusColor = { entregado: 'var(--accent)', 'no-entregado': 'var(--danger)', pendiente: 'var(--muted)' }[pkg.status] || 'var(--muted)';
  const statusLabel = { entregado: '✅ Entregado', 'no-entregado': '❌ No entregado', pendiente: '⏳ Pendiente' }[pkg.status] || pkg.status;
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderLeft: `3px solid ${statusColor}`,
        borderBottom: '1px solid var(--border)', padding: '12px 14px', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{pkg.customerName} {pkg.customerLastName}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{pkg.address}{pkg.aptFloor ? `, ${pkg.aptFloor}` : ''}{pkg.commune ? `, ${pkg.commune}` : ''}</div>
        {pkg.customerPhone && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>📞 {pkg.customerPhone}</div>}
        <div style={{ fontSize: 11, fontWeight: 700, color: statusColor, marginTop: 5 }}>
          {statusLabel}
          {pkg.deliveredAt && ` · ${new Date(pkg.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
        </div>
        {pkg.failReason && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>↳ {pkg.failReason}</div>}
        {pkg.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>📝 {pkg.note}</div>}
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>#{pkg.trackingId}</div>
      </div>
      {(pkg.photoUrl || pkg.photo2Url) && (
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {pkg.photoUrl && <img src={pkg.photoUrl} alt="foto1" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover' }} />}
          {pkg.photo2Url && <img src={pkg.photo2Url} alt="foto2" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover' }} />}
        </div>
      )}
    </div>
  );
}

function CompanyReport({ packages, route, onDownload }) {
  const active = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');
  const failed = active.filter(p => p.status === 'no-entregado');
  const pending = active.filter(p => p.status === 'pendiente');
  const progress = active.length ? Math.round((delivered.length / active.length) * 100) : 0;
  const driver = route?.driverId;

  return (
    <div style={{ padding: '14px 10px calc(50px + env(safe-area-inset-bottom))', overflowY: 'auto', height: '100%' }}>

      {/* Driver info card */}
      {driver && (
        <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Repartidor</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🚗 {driver.name}</div>
          {driver.phone && (
            <a href={`tel:${driver.phone}`} style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, display: 'block', marginTop: 4, textDecoration: 'none' }}>
              📞 {driver.phone}
            </a>
          )}
          {driver.vehicle && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              🚘 {driver.vehicle}{driver.licensePlate ? ` · ${driver.licensePlate}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Route stats */}
      {route && (
        <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Ruta {route.routeCode}{route.name ? ` — ${route.name}` : ''}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{new Date(route.date).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>

          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: 8, background: 'var(--accent)', width: `${progress}%`, borderRadius: 4, transition: 'width .5s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, marginBottom: 12 }}>{progress}% completado</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Total', val: active.length },
              { label: 'Entregados', val: delivered.length, color: 'var(--accent)' },
              { label: 'No entregados', val: failed.length, color: 'var(--danger)' },
              { label: 'Pendientes', val: pending.length }
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)' }}>{val}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download button */}
      <button
        onClick={onDownload}
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)',
          background: 'var(--card2)', color: 'var(--text)', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}
      >
        📥 Descargar reporte CSV
      </button>

      {/* Delivered */}
      {delivered.length > 0 && (
        <>
          <SectionLabel>ENTREGADOS ({delivered.length})</SectionLabel>
          {delivered.map(p => <ReportRow key={p._id} pkg={p} />)}
        </>
      )}

      {/* Failed */}
      {failed.length > 0 && (
        <>
          <SectionLabel>NO ENTREGADOS ({failed.length})</SectionLabel>
          {failed.map(p => <ReportRow key={p._id} pkg={p} />)}
        </>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <>
          <SectionLabel>PENDIENTES ({pending.length})</SectionLabel>
          {pending.map(p => <ReportRow key={p._id} pkg={p} />)}
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', padding: '10px 0 6px', textTransform: 'uppercase' }}>{children}</div>;
}

function ReportRow({ pkg }) {
  const color = { entregado: 'var(--accent)', 'no-entregado': 'var(--danger)', pendiente: 'var(--muted)' }[pkg.status];
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${pkg.status === 'entregado' ? '#00885528' : pkg.status === 'no-entregado' ? '#cc224428' : 'var(--border)'}`,
      borderRadius: 12, padding: '12px 14px', marginBottom: 8
    }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{pkg.customerName} {pkg.customerLastName}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{pkg.address}{pkg.aptFloor ? `, ${pkg.aptFloor}` : ''}{pkg.commune ? `, ${pkg.commune}` : ''}</div>
      {pkg.failReason && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>↳ {pkg.failReason}</div>}
      {pkg.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>📝 {pkg.note}</div>}
      {pkg.deliveredAt && <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 3 }}>{new Date(pkg.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</div>}
      {(pkg.photoUrl || pkg.photo2Url) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {pkg.photoUrl && <img src={pkg.photoUrl} alt="foto" style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(pkg.photoUrl, '_blank')} />}
          {pkg.photo2Url && <img src={pkg.photo2Url} alt="foto2" style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(pkg.photo2Url, '_blank')} />}
        </div>
      )}
    </div>
  );
}
