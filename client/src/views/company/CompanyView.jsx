import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import Header from '../../components/Header.jsx';
import RouteMap from '../../components/RouteMap.jsx';
import PackageCard from '../../components/PackageCard.jsx';
import DeliveryModal from '../../components/DeliveryModal.jsx';
import Toast, { toast } from '../../components/Toast.jsx';

export default function CompanyView() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [packages, setPackages] = useState([]);
  const [tab, setTab] = useState('m');
  const [viewPkg, setViewPkg] = useState(null);
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
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const stats = selectedRoute ? [
    { label: 'Entregadas', value: packages.filter(p => p.status === 'entregado').length, color: 'var(--accent)' },
    { label: 'No entregadas', value: packages.filter(p => p.status === 'no-entregado').length, color: 'var(--danger)' },
    { label: 'Pendientes', value: packages.filter(p => p.status === 'pendiente').length },
    { label: 'Total ruta', value: '$' + packages.reduce((s, p) => s + (p.price || 0), 0).toLocaleString('es-CL') }
  ] : null;

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
            {r.routeCode} · {new Date(r.date).toLocaleDateString('es-CL')}
          </button>
        ))}
        {routes.length === 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>Sin rutas asignadas</span>}
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

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: tab === 'm' ? 'block' : 'none', height: '100%' }}>
          <RouteMap packages={packages} onPkgClick={setViewPkg} readOnly />
        </div>

        {tab === 'l' && (
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
            {packages.filter(p => p.status !== 'eliminado').map((pkg, i) => (
              <PackageCard key={pkg._id} pkg={pkg} index={i} readOnly onEdit={setViewPkg} />
            ))}
          </div>
        )}

        {tab === 'r' && <CompanyReport packages={packages} route={selectedRoute} />}
      </div>

      {viewPkg && (
        <DeliveryModal pkg={viewPkg} onClose={() => setViewPkg(null)} readOnly />
      )}

      <Toast />
    </div>
  );
}

function CompanyReport({ packages, route }) {
  const active = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');
  const failed = active.filter(p => p.status === 'no-entregado');
  const progress = active.length ? Math.round((delivered.length / active.length) * 100) : 0;

  return (
    <div style={{ padding: '14px 10px', overflowY: 'auto', height: '100%' }}>
      {route && (
        <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ruta {route.routeCode}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Driver: {route.driverId?.name || 'Sin asignar'} · {new Date(route.date).toLocaleDateString('es-CL')}
          </div>
          {/* Progress bar */}
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: 8, background: 'var(--accent)', width: `${progress}%`, borderRadius: 4, transition: 'width .5s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{progress}% completado</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            {[
              { label: 'Total', val: active.length },
              { label: 'Entregados', val: delivered.length, color: 'var(--accent)' },
              { label: 'No entregados', val: failed.length, color: 'var(--danger)' },
              { label: 'Pendientes', val: active.filter(p => p.status === 'pendiente').length }
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)' }}>{val}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', padding: '0 0 7px', textTransform: 'uppercase' }}>
        DETALLE DE ENTREGAS
      </div>
      {active.map(p => (
        <div key={p._id} style={{
          background: '#fff', border: `1px solid ${p.status === 'entregado' ? '#00885528' : p.status === 'no-entregado' ? '#cc224428' : 'var(--border)'}`,
          borderRadius: 12, padding: '12px 14px', marginBottom: 8,
          cursor: 'pointer'
        }} onClick={() => setViewPkg?.(p)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.customerName} {p.customerLastName}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.address}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: p.status === 'entregado' ? 'var(--accent)' : p.status === 'no-entregado' ? 'var(--danger)' : 'var(--muted)', marginTop: 5 }}>
                {{ pendiente: '⏳ Pendiente', entregado: '✅ Entregado', 'no-entregado': '❌ No entregado' }[p.status]}
                {p.deliveredAt && ` · ${new Date(p.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
              </div>
            </div>
            {p.photoUrl && (
              <img src={p.photoUrl} alt="foto" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
