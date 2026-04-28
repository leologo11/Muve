import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import Header from '../../components/Header.jsx';
import RouteMap from '../../components/RouteMap.jsx';
import PackageCard from '../../components/PackageCard.jsx';
import DeliveryModal from '../../components/DeliveryModal.jsx';
import Toast, { toast } from '../../components/Toast.jsx';

export default function DriverView() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [packages, setPackages] = useState([]);
  const [tab, setTab] = useState('m'); // m=map, l=list, r=report
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [editPkg, setEditPkg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRoutes().then(r => {
      setRoutes(r);
      // Auto-select the most recent active route
      const active = r.find(x => x.status === 'active') || r[0];
      if (active) loadRoute(active._id);
    }).catch(e => toast('❌ ' + e.message)).finally(() => setLoading(false));
  }, []);

  const loadRoute = async (id) => {
    try {
      const { route, packages } = await api.getRoute(id);
      setSelectedRoute(route);
      setPackages(packages);
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const handleStatusChange = async (pkg, newStatus) => {
    try {
      const updated = await api.updatePackage(pkg._id, { status: newStatus });
      setPackages(prev => prev.map(p => p._id === pkg._id ? { ...p, ...updated } : p));
      toast(newStatus === 'entregado' ? '✅ Entregado' : newStatus === 'no-entregado' ? '❌ No entregado' : '↩ Deshecho');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const visible = packages.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || [p.customerName, p.customerLastName, p.address, p.commune, p.customerPhone].join(' ').toLowerCase().includes(q);
    const matchF = filter === 'todos' || p.status === filter;
    return matchQ && matchF;
  });

  const stats = [
    { label: 'Entregadas', value: packages.filter(p => p.status === 'entregado').length, color: 'var(--accent)' },
    { label: 'No entregadas', value: packages.filter(p => p.status === 'no-entregado').length, color: 'var(--danger)' },
    { label: 'Pendientes', value: packages.filter(p => p.status === 'pendiente').length },
    { label: 'Cobrado', value: '$' + packages.filter(p => p.status === 'entregado').reduce((s, p) => s + (p.price || 0), 0).toLocaleString('es-CL'), color: 'var(--accent)' }
  ];

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
      Cargando ruta…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title={selectedRoute ? `🚗 ${selectedRoute.routeCode}` : '🚚 Routiflow'}
        stats={selectedRoute ? stats : null}
      />

      {/* Route selector if multiple */}
      {routes.length > 1 && (
        <div style={{ display: 'flex', gap: 5, padding: '6px 12px', overflowX: 'auto', background: '#fff', borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}>
          {routes.map(r => (
            <button
              key={r._id}
              onClick={() => loadRoute(r._id)}
              style={{
                flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                border: '1px solid var(--border)',
                background: selectedRoute?._id === r._id ? 'var(--accent)' : 'var(--card2)',
                color: selectedRoute?._id === r._id ? '#fff' : 'var(--muted)',
                cursor: 'pointer'
              }}
            >
              {r.routeCode} · {new Date(r.date).toLocaleDateString('es-CL')}
            </button>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div style={{ height: 2, background: 'var(--border)', flexShrink: 0 }}>
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, var(--accent), var(--a2))',
          width: packages.length ? `${(packages.filter(p => p.status !== 'pendiente' && p.status !== 'eliminado').length / packages.filter(p => p.status !== 'eliminado').length * 100) || 0}%` : '0%',
          transition: 'width .5s'
        }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[['m', '🗺 MAPA'], ['l', '📋 LISTA'], ['r', '📊 REPORTE']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700,
            letterSpacing: .5, border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t ? 'var(--accent)' : 'var(--muted)',
            borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`
          }}>{label}</button>
        ))}
      </div>

      {/* Search (list tab) */}
      {tab === 'l' && (
        <div style={{ padding: '8px 10px 4px', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar por nombre, dirección, comuna…"
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 22, padding: '8px 14px', fontSize: 14, outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 7, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {['todos', 'pendiente', 'entregado', 'no-entregado', 'eliminado'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', border: '1px solid var(--border)',
                background: filter === f ? 'var(--accent)' : 'var(--card2)',
                color: filter === f ? '#fff' : 'var(--muted)'
              }}>
                {{ todos: 'Todos', pendiente: '⏳ Pendientes', entregado: '✅ Entregados', 'no-entregado': '❌ No entregados', eliminado: '🗑️ Eliminados' }[f]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Map */}
        <div style={{ display: tab === 'm' ? 'block' : 'none', height: '100%' }}>
          <RouteMap packages={packages} onPkgClick={setEditPkg} />
        </div>

        {/* List */}
        {tab === 'l' && (
          <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
            {visible.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>🔍 Sin resultados</div>
            ) : (
              visible.map((pkg, i) => (
                <PackageCard
                  key={pkg._id}
                  pkg={pkg}
                  index={i}
                  onEdit={setEditPkg}
                  onStatusChange={handleStatusChange}
                />
              ))
            )}
          </div>
        )}

        {/* Report */}
        {tab === 'r' && <DriverReport packages={packages} route={selectedRoute} />}
      </div>

      {editPkg && (
        <DeliveryModal
          pkg={editPkg}
          onClose={() => setEditPkg(null)}
          onSaved={() => loadRoute(selectedRoute._id)}
        />
      )}

      <Toast />
    </div>
  );
}

function DriverReport({ packages, route }) {
  const active = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');
  const failed = active.filter(p => p.status === 'no-entregado');
  const pending = active.filter(p => p.status === 'pendiente');
  const total = active.reduce((s, p) => s + (p.price || 0), 0);
  const collected = delivered.reduce((s, p) => s + (p.price || 0), 0);

  return (
    <div style={{ padding: '14px 10px calc(50px + env(safe-area-inset-bottom))', overflowY: 'auto', height: '100%' }}>
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 14 }}>
        {[
          ['Total paradas', active.length],
          ['Entregados', delivered.length],
          ['No entregados', failed.length],
          ['Pendientes', pending.length],
          ['Total ruta', '$' + total.toLocaleString('es-CL')],
          ['Cobrado', '$' + collected.toLocaleString('es-CL')]
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
            <span>{label}</span>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{val}</span>
          </div>
        ))}
      </div>

      {delivered.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', padding: '14px 0 7px', textTransform: 'uppercase' }}>
            ENTREGADOS ({delivered.length})
          </div>
          {delivered.map(p => <ReportCard key={p._id} pkg={p} type="entregado" />)}
        </>
      )}

      {failed.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', padding: '14px 0 7px', textTransform: 'uppercase' }}>
            NO ENTREGADOS ({failed.length})
          </div>
          {failed.map(p => <ReportCard key={p._id} pkg={p} type="no-entregado" />)}
        </>
      )}
    </div>
  );
}

function ReportCard({ pkg, type }) {
  const color = type === 'entregado' ? 'var(--accent)' : 'var(--danger)';
  return (
    <div style={{ background: '#fff', border: `1px solid ${type === 'entregado' ? '#00885528' : '#cc224428'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{pkg.customerName} {pkg.customerLastName}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{pkg.address}{pkg.commune ? `, ${pkg.commune}` : ''}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 5 }}>
        ${(pkg.price || 0).toLocaleString('es-CL')}
        {pkg.deliveredAt && ` · ${new Date(pkg.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
      </div>
      {pkg.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>📝 {pkg.note}</div>}
      {pkg.failReason && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>↳ {pkg.failReason}</div>}
      {pkg.photoUrl && (
        <img src={pkg.photoUrl} alt="foto" style={{ width: '100%', borderRadius: 9, maxHeight: 130, objectFit: 'cover', marginTop: 8, cursor: 'pointer' }} onClick={() => window.open(pkg.photoUrl, '_blank')} />
      )}
    </div>
  );
}
