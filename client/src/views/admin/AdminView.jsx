import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import Header from '../../components/Header.jsx';
import RouteMap from '../../components/RouteMap.jsx';
import PackageCard from '../../components/PackageCard.jsx';
import PackageTable from './PackageTable.jsx';
import DeliveryModal from '../../components/DeliveryModal.jsx';
import Toast, { toast } from '../../components/Toast.jsx';
import UserManager from './UserManager.jsx';
import InvoiceView from './InvoiceView.jsx';
import AddPackageModal from './AddPackageModal.jsx';
import AddRouteModal from './AddRouteModal.jsx';
import ImportModal from './ImportModal.jsx';

const STATUS_META = {
  draft:      { label: 'Borrador',   color: 'var(--muted)',   bg: 'var(--card2)' },
  active:     { label: '● Activa',   color: 'var(--accent)',  bg: '#00885512' },
  paused:     { label: '⏸ Pausada',  color: '#f57c00',        bg: '#f57c0012' },
  completed:  { label: '✓ Completada', color: '#0077aa',      bg: '#0077aa12' },
  cancelled:  { label: 'Cancelada',  color: 'var(--danger)',  bg: '#cc224412' }
};

export default function AdminView() {
  const [view, setView] = useState('routes');
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [packages, setPackages] = useState([]);
  const [tab, setTab] = useState('m');
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [routeSearch, setRouteSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('all');
  const [editPkg, setEditPkg] = useState(null);
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [routeName, setRouteName] = useState('');

  useEffect(() => { loadRoutes(); }, []);

  const loadRoutes = async () => {
    try { setRoutes(await api.getRoutes()); }
    catch (err) { toast('❌ ' + err.message); }
    finally { setLoading(false); }
  };

  const loadRoute = async (id) => {
    try {
      const { route, packages } = await api.getRoute(id);
      setSelectedRoute(route);
      setPackages(packages);
      setRouteName(route.name || '');
      setView('route');
      setTab('m');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const refreshRoute = async () => {
    if (!selectedRoute) return;
    const { route, packages } = await api.getRoute(selectedRoute._id);
    setSelectedRoute(route);
    setPackages(packages);
  };

  const saveRouteName = async () => {
    setEditingName(false);
    if (routeName.trim() === (selectedRoute?.name || '')) return;
    try {
      const updated = await api.updateRoute(selectedRoute._id, { name: routeName.trim() });
      setSelectedRoute(prev => ({ ...prev, name: updated.name }));
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handlePkgUpdate = (updated) => {
    setPackages(prev => prev.map(p => p._id === updated._id ? { ...p, ...updated } : p));
  };

  const handleStatusChange = async (pkg, newStatus) => {
    try {
      const updated = await api.updatePackage(pkg._id, { status: newStatus });
      setPackages(prev => prev.map(p => p._id === pkg._id ? { ...p, ...updated } : p));
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleDelete = async (pkg) => {
    if (!confirm(`¿Eliminar a ${pkg.customerName}?`)) return;
    try {
      await api.deletePackage(pkg._id);
      setPackages(prev => prev.map(p => p._id === pkg._id ? { ...p, status: 'eliminado' } : p));
      toast('🗑️ Eliminado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleRestore = async (pkg) => {
    try {
      const updated = await api.restorePackage(pkg._id);
      setPackages(prev => prev.map(p => p._id === pkg._id ? { ...p, ...updated } : p));
      toast('↩ Restaurado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const { packages: optimized, distanceKm } = await api.optimizeRoute(selectedRoute._id);
      setPackages(optimized);
      toast(`🗺️ Ruta optimizada${distanceKm ? ` · ${distanceKm} km` : ''}`);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setOptimizing(false); }
  };

  const handleGeocode = async () => {
    setGeocoding(true);
    try {
      const { geocoded, total } = await api.geocodeRoute(selectedRoute._id);
      await refreshRoute();
      toast(`🗺️ Geocodificados ${geocoded}/${total} paquetes`);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setGeocoding(false); }
  };

  const handleRouteStatus = async (route, newStatus) => {
    try {
      await api.updateRoute(route._id, { status: newStatus });
      await loadRoutes();
      toast('✅ Estado actualizado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleDeleteRoute = async (route) => {
    if (!confirm(`¿Cancelar la ruta ${route.routeCode}?`)) return;
    try {
      await api.deleteRoute(route._id);
      await loadRoutes();
    } catch (err) { toast('❌ ' + err.message); }
  };

  const activePackages = packages.filter(p => p.status !== 'eliminado');

  const visible = packages.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || [p.customerName, p.customerLastName, p.address, p.commune, p.customerPhone, p.trackingId].join(' ').toLowerCase().includes(q);
    const matchF = filter === 'todos' || p.status === filter;
    return matchQ && matchF;
  });

  const filteredRoutes = routes.filter(r => {
    const q = routeSearch.toLowerCase();
    const matchQ = !q || [r.routeCode, r.name, r.clientCompany?.name, r.driverId?.name].filter(Boolean).join(' ').toLowerCase().includes(q);
    const matchF = routeFilter === 'all' || r.status === routeFilter;
    return matchQ && matchF;
  });

  const invBadge = (() => {
    const inv = selectedRoute?.invoice;
    if (!inv || inv.status === 'none') return null;
    if (inv.status === 'paid') return { label: '💳', value: 'Pagada', color: 'var(--accent)' };
    if (inv.status === 'pending') return { label: '💳', value: 'Por cobrar', color: '#f57c00' };
    if (inv.status === 'net30' || inv.status === 'overdue') {
      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      if (!due) return { label: '💳', value: 'Neto 30', color: '#f57c00' };
      const days = Math.ceil((due - Date.now()) / 86400000);
      return { label: '💳', value: days < 0 ? `Vencida ${Math.abs(days)}d` : `${days}d`, color: days <= 7 ? 'var(--danger)' : '#f57c00' };
    }
    return null;
  })();

  const stats = selectedRoute ? [
    { label: 'Entregadas', value: packages.filter(p => p.status === 'entregado').length, color: 'var(--accent)' },
    { label: 'No entregadas', value: packages.filter(p => p.status === 'no-entregado').length, color: 'var(--danger)' },
    { label: 'Pendientes', value: packages.filter(p => p.status === 'pendiente').length },
    { label: 'Cobrado', value: '$' + packages.filter(p => p.status === 'entregado').reduce((s, p) => s + (p.price || 0), 0).toLocaleString('es-CL'), color: 'var(--accent)' },
    { label: 'Total', value: '$' + activePackages.reduce((s, p) => s + (p.price || 0), 0).toLocaleString('es-CL') },
    ...(invBadge ? [invBadge] : [])
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

  // ── INVOICE VIEW ──
  if (view === 'invoices') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <InvoiceView onBack={() => setView('routes')} />
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
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => setView('invoices')} style={{ background: '#fff3e0', border: '1px solid #f57c0030', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#f57c00', cursor: 'pointer' }}>
                💳 Cobros
              </button>
              <button onClick={() => setView('users')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>
                👥 Usuarios
              </button>
            </div>
          }
        />

        {/* Search + filter strip */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '8px 10px 6px', flexShrink: 0 }}>
          <input
            value={routeSearch}
            onChange={e => setRouteSearch(e.target.value)}
            placeholder="🔍 Buscar por ID ruta, empresa, driver…"
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 22, padding: '8px 14px', fontSize: 13, outline: 'none', marginBottom: 7 }}
          />
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
            {[['all', 'Todas'], ['active', '● Activas'], ['paused', '⏸ Pausadas'], ['draft', 'Borrador'], ['completed', '✓ Completadas']].map(([val, lbl]) => (
              <button key={val} onClick={() => setRouteFilter(val)} style={{
                flexShrink: 0, padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: routeFilter === val ? 'var(--accent)' : 'var(--card2)',
                color: routeFilter === val ? '#fff' : 'var(--muted)'
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px calc(90px + env(safe-area-inset-bottom))' }}>
          {filteredRoutes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <p style={{ fontSize: 14 }}>{routes.length === 0 ? 'No hay rutas. Crea la primera.' : 'Sin resultados para ese filtro.'}</p>
            </div>
          ) : (
            filteredRoutes.map(route => (
              <RouteCard
                key={route._id}
                route={route}
                onClick={() => loadRoute(route._id)}
                onStatusChange={handleRouteStatus}
                onDelete={handleDeleteRoute}
              />
            ))
          )}
        </div>

        <button
          onClick={() => setShowAddRoute(true)}
          style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16, width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px #00885540', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >＋</button>

        {showAddRoute && (
          <AddRouteModal
            onClose={() => setShowAddRoute(false)}
            onCreated={async (route) => { setShowAddRoute(false); await loadRoutes(); await loadRoute(route._id); }}
          />
        )}
        <Toast />
      </div>
    );
  }

  // ── SINGLE ROUTE VIEW ──
  const routeTitle = editingName ? (
    <input
      value={routeName}
      onChange={e => setRouteName(e.target.value)}
      onBlur={saveRouteName}
      onKeyDown={e => { if (e.key === 'Enter') saveRouteName(); if (e.key === 'Escape') setEditingName(false); }}
      autoFocus
      style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 6px', outline: 'none', maxWidth: 155 }}
    />
  ) : (
    <span onClick={() => { setRouteName(selectedRoute?.name || ''); setEditingName(true); }} style={{ cursor: 'text' }}>
      ⚙️ {selectedRoute?.name || selectedRoute?.routeCode} <span style={{ fontSize: 11, color: 'var(--muted)' }}>✏️</span>
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title={routeTitle}
        stats={stats}
        onBack={() => { setView('routes'); setSelectedRoute(null); setPackages([]); setEditingName(false); setTab('m'); }}
        extra={
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            style={{ background: optimizing ? 'var(--card2)' : '#00885512', border: '1px solid #00885530', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', cursor: optimizing ? 'not-allowed' : 'pointer' }}
          >
            {optimizing ? '⏳…' : '🤖 IA'}
          </button>
        }
      />

      <div style={{ height: 2, background: 'var(--border)', flexShrink: 0 }}>
        <div style={{
          height: 2, background: 'linear-gradient(90deg, var(--accent), var(--a2))',
          width: activePackages.length ? `${(packages.filter(p => ['entregado', 'no-entregado'].includes(p.status)).length / activePackages.length * 100) || 0}%` : '0%',
          transition: 'width .5s'
        }} />
      </div>

      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[['m', '🗺 MAPA'], ['l', '📋 LISTA'], ['t', '📝 TABLA'], ['r', '📊 INFO']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700,
            letterSpacing: .5, border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t ? 'var(--accent)' : 'var(--muted)',
            borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`
          }}>{label}</button>
        ))}
      </div>

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
          <RouteMap
            packages={packages}
            onPkgClick={setEditPkg}
            onPkgDelete={handleDelete}
            onPkgRestore={handleRestore}
            startPoint={selectedRoute?.startPoint}
            visible={tab === 'm'}
          />
        </div>

        {tab === 'l' && (
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
            {visible.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>🔍 Sin resultados</div>
            ) : visible.map(pkg => (
              <PackageCard
                key={pkg._id}
                pkg={pkg}
                index={activePackages.indexOf(pkg)}
                onEdit={setEditPkg}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onRestore={handleRestore}
              />
            ))}
          </div>
        )}

        {tab === 't' && <PackageTable packages={packages} onUpdate={handlePkgUpdate} />}

        {tab === 'r' && (
          <AdminReport
            packages={packages}
            route={selectedRoute}
            geocoding={geocoding}
            onGeocode={handleGeocode}
            onRouteUpdate={updated => setSelectedRoute(prev => ({ ...prev, ...updated }))}
          />
        )}
      </div>

      {tab !== 'm' && (
        <div style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 400 }}>
          <button onClick={() => setShowImport(true)} style={{ width: 52, height: 52, borderRadius: '50%', background: '#9c27b0', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 16px #9c27b040', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</button>
          <button onClick={() => setShowAddPkg(true)} style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px #00885540', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>
        </div>
      )}

      {editPkg && <DeliveryModal pkg={editPkg} route={selectedRoute} onClose={() => setEditPkg(null)} onSaved={refreshRoute} />}
      {showAddPkg && <AddPackageModal routeId={selectedRoute._id} onClose={() => setShowAddPkg(false)} onCreated={() => { setShowAddPkg(false); refreshRoute(); }} />}
      {showImport && <ImportModal routeId={selectedRoute._id} onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); refreshRoute(); }} />}
      <Toast />
    </div>
  );
}

// ── Route card in list ──
function RouteCard({ route, onClick, onStatusChange, onDelete }) {
  const inv = route.invoice;
  const daysLeft = inv?.status === 'net30' && inv?.dueDate
    ? Math.ceil((new Date(inv.dueDate) - Date.now()) / 86400000) : null;
  const invBadge = inv?.status === 'paid' ? { text: '💳 Pagada', color: 'var(--accent)' }
    : inv?.status === 'net30' ? { text: daysLeft < 0 ? '💳 Vencida' : `💳 ${daysLeft}d`, color: daysLeft != null && daysLeft <= 7 ? 'var(--danger)' : '#f57c00' }
    : inv?.status === 'pending' ? { text: '💳 Por cobrar', color: '#f57c00' }
    : inv?.status === 'overdue' ? { text: '💳 Vencida', color: 'var(--danger)' } : null;

  const meta = STATUS_META[route.status] || STATUS_META.draft;

  const nextStatus = { draft: 'active', active: 'paused', paused: 'active', completed: null, cancelled: null }[route.status];
  const nextLabel = { draft: '▶ Activar', active: '⏸ Pausar', paused: '▶ Reactivar' }[route.status];

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: '13px 14px', marginBottom: 10, boxShadow: '0 1px 4px #0000000a' }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={onClick}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{route.name || route.routeCode}</div>
          {route.name && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{route.routeCode}</div>}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {new Date(route.date).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {route.driverId && ` · 🚗 ${route.driverId.name}`}
          </div>
          {route.clientCompany?.name && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              🏢 {route.clientCompany.name}{route.clientCompany.contactPerson ? ` · ${route.clientCompany.contactPerson}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, ml: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
            {meta.label}
          </span>
          {invBadge && <span style={{ fontSize: 10, fontWeight: 700, color: invBadge.color }}>{invBadge.text}</span>}
        </div>
      </div>

      {/* Stats */}
      {route.stats && (
        <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap', cursor: 'pointer' }} onClick={onClick}>
          {[
            { label: 'Total', val: route.stats.total },
            { label: '✅', val: route.stats.delivered, color: 'var(--accent)' },
            { label: '❌', val: route.stats.failed, color: 'var(--danger)' },
            { label: '⏳', val: route.stats.pending }
          ].map(({ label, val, color }) => (
            <div key={label} style={{ fontSize: 11, color: color || 'var(--muted)', fontWeight: 700 }}>{label} {val}</div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginLeft: 'auto' }}>
            ${(route.stats.collectedAmount || 0).toLocaleString('es-CL')} / ${(route.stats.totalAmount || 0).toLocaleString('es-CL')}
          </div>
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={onClick} style={actBtn('var(--accent)')}>📂 Abrir ruta</button>
        {nextStatus && nextLabel && (
          <button onClick={e => { e.stopPropagation(); onStatusChange(route, nextStatus); }} style={actBtn('#f57c00')}>{nextLabel}</button>
        )}
        {route.status === 'active' && (
          <button onClick={e => { e.stopPropagation(); onStatusChange(route, 'completed'); }} style={actBtn('#0077aa')}>✓ Cerrar ruta</button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(route); }} style={actBtn('var(--danger)')}>🗑️ Cancelar</button>
      </div>
    </div>
  );
}

function actBtn(color) {
  return { padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${color}30`, background: `${color}12`, color };
}

// ── Info / Report tab ──
function AdminReport({ packages, route, geocoding, onGeocode, onRouteUpdate }) {
  const [editingRoute, setEditingRoute] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: route?.name || '',
      clientCompany: { name: route?.clientCompany?.name || '', contactPerson: route?.clientCompany?.contactPerson || '', contactPhone: route?.clientCompany?.contactPhone || '' },
      invoice: {
        status: route?.invoice?.status || 'none',
        amount: route?.invoice?.amount ?? '',
        invoiceDate: route?.invoice?.invoiceDate ? new Date(route.invoice.invoiceDate).toISOString().slice(0, 10) : '',
        notes: route?.invoice?.notes || ''
      },
      startPoint: { address: route?.startPoint?.address || '', lat: route?.startPoint?.lat ?? '', lng: route?.startPoint?.lng ?? '' }
    });
  }, [route]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCompany = (k, v) => setForm(f => ({ ...f, clientCompany: { ...f.clientCompany, [k]: v } }));
  const setInvoice = (k, v) => setForm(f => ({ ...f, invoice: { ...f.invoice, [k]: v } }));
  const setStart = (k, v) => setForm(f => ({ ...f, startPoint: { ...f.startPoint, [k]: v } }));

  const saveRoute = async () => {
    setSaving(true);
    try {
      const updated = await api.updateRoute(route._id, {
        name: form.name,
        clientCompany: form.clientCompany,
        invoice: { ...form.invoice, amount: form.invoice.amount !== '' ? Number(form.invoice.amount) : undefined, invoiceDate: form.invoice.invoiceDate || undefined },
        startPoint: { address: form.startPoint.address || undefined, lat: form.startPoint.lat !== '' ? Number(form.startPoint.lat) : undefined, lng: form.startPoint.lng !== '' ? Number(form.startPoint.lng) : undefined }
      });
      onRouteUpdate(updated);
      setEditingRoute(false);
      toast('✅ Ruta actualizada');
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const active = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');
  const failed = active.filter(p => p.status === 'no-entregado');
  const total = active.reduce((s, p) => s + (p.price || 0), 0);
  const collected = delivered.reduce((s, p) => s + (p.price || 0), 0);
  const inv = route?.invoice;
  const dueDate = inv?.dueDate ? new Date(inv.dueDate) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - Date.now()) / 86400000) : null;
  const noCoords = active.filter(p => !p.lat || !p.lng).length;

  if (!form) return null;

  return (
    <div style={{ padding: '14px 10px calc(80px + env(safe-area-inset-bottom))', overflowY: 'auto', height: '100%' }}>

      {/* Geocode alert */}
      {noCoords > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #f57c0033', borderRadius: 12, padding: '11px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#f57c00', fontWeight: 600 }}>⚠️ {noCoords} paquete{noCoords > 1 ? 's' : ''} sin coordenadas (no aparece{noCoords > 1 ? 'n' : ''} en el mapa)</span>
          <button
            onClick={onGeocode}
            disabled={geocoding}
            style={{ padding: '6px 12px', borderRadius: 20, border: 'none', background: '#f57c00', color: '#fff', fontSize: 11, fontWeight: 700, cursor: geocoding ? 'not-allowed' : 'pointer', flexShrink: 0, marginLeft: 8 }}
          >
            {geocoding ? '⏳…' : '🗺️ Geocodificar'}
          </button>
        </div>
      )}

      {/* Route info card */}
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)' }}>INFO DE RUTA</div>
          <button onClick={() => setEditingRoute(v => !v)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>
            {editingRoute ? '✕ Cancelar' : '✏️ Editar'}
          </button>
        </div>

        {editingRoute ? (
          <div>
            <Label>Nombre de ruta</Label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Ruta Lunes Norte" style={inp} />

            <div style={{ margin: '14px 0 4px', fontSize: 11, fontWeight: 700, color: '#005078', letterSpacing: 1 }}>🏢 EMPRESA CLIENTE</div>
            <Label>Nombre empresa</Label>
            <input value={form.clientCompany.name} onChange={e => setCompany('name', e.target.value)} placeholder="Importadora ABC" style={inp} />
            <Label>Responsable / Contacto</Label>
            <input value={form.clientCompany.contactPerson} onChange={e => setCompany('contactPerson', e.target.value)} placeholder="Nombre contacto" style={inp} />
            <Label>Teléfono WhatsApp</Label>
            <input value={form.clientCompany.contactPhone} onChange={e => setCompany('contactPhone', e.target.value)} placeholder="+56 9 xxxx xxxx" style={inp} />

            <div style={{ margin: '14px 0 4px', fontSize: 11, fontWeight: 700, color: '#f57c00', letterSpacing: 1 }}>💳 FACTURA / PAGO</div>
            <Label>Estado de pago</Label>
            <select value={form.invoice.status} onChange={e => setInvoice('status', e.target.value)} style={inp}>
              <option value="none">Sin factura</option>
              <option value="pending">Pendiente de cobro</option>
              <option value="net30">Crédito 30 días (Neto 30)</option>
              <option value="paid">Pagada ✓</option>
              <option value="overdue">Vencida</option>
            </select>
            {form.invoice.status !== 'none' && (<>
              <Label>Monto (CLP)</Label>
              <input type="number" value={form.invoice.amount} onChange={e => setInvoice('amount', e.target.value)} placeholder="0" style={inp} />
              <Label>Fecha de factura</Label>
              <input type="date" value={form.invoice.invoiceDate} onChange={e => setInvoice('invoiceDate', e.target.value)} style={inp} />
              <Label>Notas</Label>
              <input value={form.invoice.notes} onChange={e => setInvoice('notes', e.target.value)} placeholder="Notas de pago" style={inp} />
            </>)}

            <div style={{ margin: '14px 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>📍 PUNTO DE INICIO</div>
            <Label>Dirección bodega</Label>
            <input value={form.startPoint.address} onChange={e => setStart('address', e.target.value)} placeholder="Av. Vitacura 2939, Vitacura" style={inp} />

            <button onClick={saveRoute} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', marginTop: 14, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Guardando…' : '✓ Guardar cambios'}
            </button>
          </div>
        ) : (
          <div>
            {route?.name && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{route.name}</div>}
            {route?.clientCompany?.name ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>🏢 {route.clientCompany.name}</div>
                {route.clientCompany.contactPerson && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>👤 {route.clientCompany.contactPerson}</div>}
                {route.clientCompany.contactPhone && (
                  <a href={`https://wa.me/${route.clientCompany.contactPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola, te contacto desde Routiflow 🚚')}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#128c3a', fontWeight: 600, display: 'block', marginTop: 1 }}>
                    💬 {route.clientCompany.contactPhone}
                  </a>
                )}
              </div>
            ) : <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Sin empresa cliente asignada</div>}

            {inv && inv.status !== 'none' && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: inv.status === 'paid' ? '#e8f5e9' : inv.status === 'overdue' ? '#fce4ec' : '#fff8e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: inv.status === 'paid' ? 'var(--accent)' : inv.status === 'overdue' ? 'var(--danger)' : '#f57c00' }}>
                    💳 {{ pending: 'Por cobrar', net30: 'Neto 30', paid: 'Pagada ✓', overdue: 'Vencida' }[inv.status]}
                  </span>
                  {inv.amount ? <span style={{ fontSize: 13, fontWeight: 700 }}>${Number(inv.amount).toLocaleString('es-CL')}</span> : null}
                </div>
                {daysLeft !== null && inv.status !== 'paid' && (
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: daysLeft < 0 ? 'var(--danger)' : daysLeft <= 7 ? '#e65100' : '#f57c00' }}>
                    {daysLeft < 0 ? `⚠️ Vencida hace ${Math.abs(daysLeft)} días` : `⏳ Vence en ${daysLeft} días`}
                  </div>
                )}
                {inv.notes && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{inv.notes}</div>}
              </div>
            )}
            {route?.startPoint?.address && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>📍 Inicio: {route.startPoint.address}</div>}
          </div>
        )}
      </div>

      {/* Delivery stats */}
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 14 }}>
        {[
          ['Ruta', route?.routeCode],
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
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
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
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', padding: '14px 0 7px' }}>{title} ({items.length})</div>
          {items.map(p => (
            <div key={p._id} style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.customerName} {p.customerLastName}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.address}{p.aptFloor ? `, ${p.aptFloor}` : ''}{p.commune ? `, ${p.commune}` : ''}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 5 }}>
                  ${(p.price || 0).toLocaleString('es-CL')}
                  {p.deliveredAt && ` · ${new Date(p.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
                </div>
                {p.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>📝 {p.note}</div>}
                {p.failReason && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>↳ {p.failReason}</div>}
              </div>
              {(p.photoUrl || p.photo2Url) && (
                <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                  {p.photoUrl && <img src={p.photoUrl} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(p.photoUrl, '_blank')} />}
                  {p.photo2Url && <img src={p.photo2Url} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(p.photo2Url, '_blank')} />}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', margin: '8px 0 3px' }}>{children}</div>;
}

const inp = { width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, padding: '9px 12px', outline: 'none', display: 'block', WebkitAppearance: 'none', boxSizing: 'border-box' };
