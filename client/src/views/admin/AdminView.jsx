import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import Header from '../../components/Header.jsx';
import RouteMap from '../../components/RouteMap.jsx';
import PackageCard from '../../components/PackageCard.jsx';
import DeliveryModal from '../../components/DeliveryModal.jsx';
import Toast, { toast } from '../../components/Toast.jsx';
import UserManager from './UserManager.jsx';
import AddPackageModal from './AddPackageModal.jsx';
import AddRouteModal from './AddRouteModal.jsx';

export default function AdminView() {
  const [view, setView] = useState('routes'); // routes | route | users
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [packages, setPackages] = useState([]);
  const [tab, setTab] = useState('m');
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [editPkg, setEditPkg] = useState(null);
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRoutes(); }, []);

  const loadRoutes = async () => {
    try {
      const r = await api.getRoutes();
      setRoutes(r);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRoute = async (id) => {
    try {
      const { route, packages } = await api.getRoute(id);
      setSelectedRoute(route);
      setPackages(packages);
      setView('route');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const refreshRoute = async () => {
    if (selectedRoute) {
      const { packages } = await api.getRoute(selectedRoute._id);
      setPackages(packages);
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

  const handleDelete = async (pkg) => {
    if (!confirm(`¿Eliminar a ${pkg.customerName} de la ruta?`)) return;
    try {
      await api.deletePackage(pkg._id);
      setPackages(prev => prev.map(p => p._id === pkg._id ? { ...p, status: 'eliminado' } : p));
      toast('🗑️ Eliminado (puedes restaurar)');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const handleRestore = async (pkg) => {
    try {
      const updated = await api.restorePackage(pkg._id);
      setPackages(prev => prev.map(p => p._id === pkg._id ? { ...p, ...updated } : p));
      toast('↩ Restaurado');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const handleOptimize = async () => {
    if (!selectedRoute) return;
    setOptimizing(true);
    try {
      const { packages: optimized } = await api.optimizeRoute(selectedRoute._id);
      setPackages(optimized);
      toast('🤖 Ruta optimizada con IA');
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setOptimizing(false);
    }
  };

  const handleDeleteRoute = async (route) => {
    if (!confirm(`¿Cancelar la ruta ${route.routeCode}?`)) return;
    try {
      await api.deleteRoute(route._id);
      await loadRoutes();
      toast('🗑️ Ruta cancelada');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const visible = packages.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || [p.customerName, p.customerLastName, p.address, p.commune, p.customerPhone, p.trackingId].join(' ').toLowerCase().includes(q);
    const matchF = filter === 'todos' || p.status === filter;
    return matchQ && matchF;
  });

  const stats = selectedRoute ? [
    { label: 'Entregadas', value: packages.filter(p => p.status === 'entregado').length, color: 'var(--accent)' },
    { label: 'No entregadas', value: packages.filter(p => p.status === 'no-entregado').length, color: 'var(--danger)' },
    { label: 'Pendientes', value: packages.filter(p => p.status === 'pendiente').length },
    { label: 'Cobrado', value: '$' + packages.filter(p => p.status === 'entregado').reduce((s, p) => s + (p.price || 0), 0).toLocaleString('es-CL'), color: 'var(--accent)' },
    { label: 'Total', value: '$' + packages.reduce((s, p) => s + (p.price || 0), 0).toLocaleString('es-CL') }
  ] : null;

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Cargando…</div>;

  // ── USERS VIEW ──
  if (view === 'users') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header title="👥 Usuarios" onBack={() => setView('routes')} />
        <UserManager />
        <Toast />
      </div>
    );
  }

  // ── ROUTES LIST ──
  if (view === 'routes') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header
          title="⚙️ Admin · Rutas"
          extra={
            <button onClick={() => setView('users')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>
              👥 Usuarios
            </button>
          }
        />

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px calc(90px + env(safe-area-inset-bottom))' }}>
          {routes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <p style={{ fontSize: 14 }}>No hay rutas. Crea la primera.</p>
            </div>
          ) : (
            routes.map(route => (
              <div key={route._id} style={{
                background: '#fff', borderRadius: 14, border: '1px solid var(--border)',
                padding: '14px', marginBottom: 10, cursor: 'pointer',
                boxShadow: '0 1px 4px #0000000a'
              }} onClick={() => loadRoute(route._id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{route.routeCode}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {new Date(route.date).toLocaleDateString('es-CL', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      {route.driverId && ` · 🚗 ${route.driverId.name}`}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                    background: route.status === 'active' ? '#00885512' : route.status === 'completed' ? '#00885508' : 'var(--card2)',
                    color: route.status === 'active' ? 'var(--accent)' : route.status === 'completed' ? 'var(--a2)' : 'var(--muted)',
                    border: `1px solid ${route.status === 'active' ? '#00885530' : 'var(--border)'}`
                  }}>
                    {{ draft: 'Borrador', active: '● Activa', completed: 'Completada', cancelled: 'Cancelada' }[route.status] || route.status}
                  </span>
                </div>

                {route.stats && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Total', val: route.stats.total },
                      { label: '✅', val: route.stats.delivered, color: 'var(--accent)' },
                      { label: '❌', val: route.stats.failed, color: 'var(--danger)' },
                      { label: '⏳', val: route.stats.pending }
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ fontSize: 11, color: color || 'var(--muted)', fontWeight: 700 }}>
                        {label} {val}
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginLeft: 'auto' }}>
                      ${(route.stats.collectedAmount || 0).toLocaleString('es-CL')} / ${(route.stats.totalAmount || 0).toLocaleString('es-CL')}
                    </div>
                  </div>
                )}

                <button
                  onClick={e => { e.stopPropagation(); handleDeleteRoute(route); }}
                  style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--elim)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  🗑️ Cancelar ruta
                </button>
              </div>
            ))
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => setShowAddRoute(true)}
          style={{
            position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16,
            width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)',
            border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer',
            boxShadow: '0 4px 16px #00885540', zIndex: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >＋</button>

        {showAddRoute && (
          <AddRouteModal
            onClose={() => setShowAddRoute(false)}
            onCreated={async (route) => {
              setShowAddRoute(false);
              await loadRoutes();
              await loadRoute(route._id);
            }}
          />
        )}

        <Toast />
      </div>
    );
  }

  // ── SINGLE ROUTE VIEW ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title={`⚙️ ${selectedRoute?.routeCode}`}
        stats={stats}
        onBack={() => { setView('routes'); setSelectedRoute(null); setPackages([]); }}
        extra={
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            style={{
              background: optimizing ? 'var(--card2)' : '#00885512', border: '1px solid #00885530',
              borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700,
              color: 'var(--accent)', cursor: optimizing ? 'not-allowed' : 'pointer'
            }}
          >
            {optimizing ? '⏳ Optimizando…' : '🤖 Optimizar IA'}
          </button>
        }
      />

      {/* Progress bar */}
      <div style={{ height: 2, background: 'var(--border)', flexShrink: 0 }}>
        <div style={{
          height: 2, background: 'linear-gradient(90deg, var(--accent), var(--a2))',
          width: packages.length ? `${(packages.filter(p => ['entregado', 'no-entregado'].includes(p.status)).length / packages.filter(p => p.status !== 'eliminado').length * 100) || 0}%` : '0%',
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

      {/* Search */}
      {tab === 'l' && (
        <div style={{ padding: '8px 10px 4px', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar nombre, dirección, tracking…"
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

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: tab === 'm' ? 'block' : 'none', height: '100%' }}>
          <RouteMap packages={packages} onPkgClick={setEditPkg} />
        </div>

        {tab === 'l' && (
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
            {visible.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>🔍 Sin resultados</div>
            ) : (
              visible.map((pkg, i) => (
                <PackageCard
                  key={pkg._id}
                  pkg={pkg}
                  index={packages.filter(p => p.status !== 'eliminado').indexOf(pkg)}
                  onEdit={setEditPkg}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                />
              ))
            )}
          </div>
        )}

        {tab === 'r' && <AdminReport packages={packages} route={selectedRoute} />}
      </div>

      {/* FAB: add package */}
      {tab !== 'm' && (
        <button
          onClick={() => setShowAddPkg(true)}
          style={{
            position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16,
            width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)',
            border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer',
            boxShadow: '0 4px 16px #00885540', zIndex: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >＋</button>
      )}

      {editPkg && (
        <DeliveryModal
          pkg={editPkg}
          onClose={() => setEditPkg(null)}
          onSaved={refreshRoute}
        />
      )}

      {showAddPkg && (
        <AddPackageModal
          routeId={selectedRoute._id}
          onClose={() => setShowAddPkg(false)}
          onCreated={() => { setShowAddPkg(false); refreshRoute(); }}
        />
      )}

      <Toast />
    </div>
  );
}

function AdminReport({ packages, route }) {
  const active = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');
  const failed = active.filter(p => p.status === 'no-entregado');
  const total = active.reduce((s, p) => s + (p.price || 0), 0);
  const collected = delivered.reduce((s, p) => s + (p.price || 0), 0);

  return (
    <div style={{ padding: '14px 10px calc(50px + env(safe-area-inset-bottom))', overflowY: 'auto', height: '100%' }}>
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 14 }}>
        {[
          ['Ruta', route?.routeCode || '-'],
          ['Driver', route?.driverId?.name || 'Sin asignar'],
          ['Total paradas', active.length],
          ['Entregados', delivered.length],
          ['No entregados', failed.length],
          ['Pendientes', active.filter(p => p.status === 'pendiente').length],
          ['Eliminados', packages.filter(p => p.status === 'eliminado').length],
          ['Total ruta', '$' + total.toLocaleString('es-CL')],
          ['Cobrado', '$' + collected.toLocaleString('es-CL')],
          ['Por cobrar', '$' + (total - collected).toLocaleString('es-CL')]
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--muted)' }}>{label}</span>
            <span style={{ fontWeight: 700, color: label === 'Cobrado' ? 'var(--accent)' : 'var(--text)' }}>{val}</span>
          </div>
        ))}
      </div>

      {[
        { title: 'ENTREGADOS', items: delivered, color: 'var(--accent)', border: '#00885528' },
        { title: 'NO ENTREGADOS', items: failed, color: 'var(--danger)', border: '#cc224428' },
        { title: 'PENDIENTES', items: active.filter(p => p.status === 'pendiente'), color: 'var(--muted)', border: 'var(--border)' }
      ].map(({ title, items, color, border }) => items.length > 0 && (
        <div key={title}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', padding: '14px 0 7px', textTransform: 'uppercase' }}>
            {title} ({items.length})
          </div>
          {items.map(p => (
            <div key={p._id} style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.customerName} {p.customerLastName}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.address}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 5 }}>
                  ${(p.price || 0).toLocaleString('es-CL')}
                  {p.deliveredAt && ` · ${new Date(p.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
                </div>
                {p.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>📝 {p.note}</div>}
                {p.failReason && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>↳ {p.failReason}</div>}
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>#{p.trackingId}</div>
              </div>
              {p.photoUrl && (
                <img src={p.photoUrl} alt="foto" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', marginLeft: 10, cursor: 'pointer', flexShrink: 0 }} onClick={() => window.open(p.photoUrl, '_blank')} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
