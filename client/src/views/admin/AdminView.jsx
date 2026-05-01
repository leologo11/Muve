import React, { useState, useEffect, useMemo } from 'react';
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
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';
import PriceSettings from '../../components/PriceSettings.jsx';
import SectorMap from './SectorMap.jsx';
import AllPackagesView from './AllPackagesView.jsx';
import QuotesView from './QuotesView.jsx';
import CompaniesView from './CompaniesView.jsx';

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
  const [driverLocation, setDriverLocation] = useState(null);

  useEffect(() => { loadRoutes(); }, []);

  // Poll driver location every 20s while viewing an active route with a driver assigned
  useEffect(() => {
    if (!selectedRoute?._id || !selectedRoute?.driverId || selectedRoute.status !== 'active') {
      setDriverLocation(null);
      return;
    }
    const poll = () =>
      api.getDriverLocation(selectedRoute._id)
        .then(d => setDriverLocation(d.location ? { ...d.location, driverName: d.driverName } : null))
        .catch(() => {});
    poll();
    const timer = setInterval(poll, 20000);
    return () => clearInterval(timer);
  }, [selectedRoute?._id, selectedRoute?.driverId, selectedRoute?.status]);

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
    const code = window.prompt(
      `⚠️ ELIMINAR RUTA ${route.routeCode}\n\nEsto eliminará la ruta y TODOS sus paquetes permanentemente.\n\nEscribe CONFIRMAR para continuar:`
    );
    if (code !== 'CONFIRMAR') return;
    try {
      await api.permanentDeleteRoute(route._id);
      await loadRoutes();
      toast('🗑️ Ruta eliminada permanentemente');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleCancelRoute = async (route) => {
    if (!confirm(`¿Cancelar la ruta ${route.routeCode}? (solo cambia el estado, no elimina los datos)`)) return;
    try {
      await api.deleteRoute(route._id);
      await loadRoutes();
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleCompleteRoute = async () => {
    if (!confirm('¿Finalizar la ruta como completada? Esta acción marcará la ruta como cerrada.')) return;
    try {
      await api.updateRoute(selectedRoute._id, { status: 'completed' });
      const { route } = await api.getRoute(selectedRoute._id);
      setSelectedRoute(route);
      toast('✅ Ruta finalizada como completada');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const activePackages = useMemo(
    () => packages.filter(p => p.status !== 'eliminado'),
    [packages]
  );

  const allDone = useMemo(
    () => activePackages.length > 0 && activePackages.every(p => p.status !== 'pendiente') && selectedRoute?.status === 'active',
    [activePackages, selectedRoute?.status]
  );

  const addrCountMap = useMemo(() => {
    const map = {};
    activePackages.forEach(p => {
      const key = (p.address || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [activePackages]);

  const noGeoCount = useMemo(
    () => activePackages.filter(p => (!p.lat || !p.lng) && p.status === 'pendiente').length,
    [activePackages]
  );

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return packages.filter(p => {
      const matchQ = !q || [p.customerName, p.customerLastName, p.address, p.commune, p.customerPhone, p.trackingId].join(' ').toLowerCase().includes(q);
      const matchF = filter === 'sin-mapa'
        ? (!p.lat || !p.lng) && p.status === 'pendiente'
        : filter === 'todos' || p.status === filter;
      return matchQ && matchF;
    });
  }, [packages, search, filter]);

  const filteredRoutes = useMemo(() => {
    const q = routeSearch.toLowerCase();
    return routes.filter(r => {
      const matchQ = !q || [r.routeCode, r.name, r.clientCompany?.name, r.driverId?.name].filter(Boolean).join(' ').toLowerCase().includes(q);
      const matchF = routeFilter === 'all' || r.status === routeFilter;
      return matchQ && matchF;
    });
  }, [routes, routeSearch, routeFilter]);

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

  // ── COMPANIES VIEW ──
  if (view === 'companies') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header title="🏢 Empresas y Proveedores" onBack={() => setView('routes')} />
        <CompaniesView />
        <Toast />
      </div>
    );
  }

  // ── QUOTES VIEW ──
  if (view === 'quotes') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header title="💼 Cotizaciones" onBack={() => setView('routes')} />
        <QuotesView />
        <Toast />
      </div>
    );
  }

  // ── ALL PACKAGES VIEW ──
  if (view === 'allPackages') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header title="📦 Todos los paquetes" onBack={() => setView('routes')} />
        <AllPackagesView />
        <Toast />
      </div>
    );
  }

  // ── SECTOR MAP VIEW ──
  if (view === 'zones') {
    return <ZonesView onBack={() => setView('routes')} />;
  }

  // ── PRICES VIEW (legacy) ──
  if (view === 'prices') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header title="💰 Precios por Comuna" onBack={() => setView('routes')} />
        <PriceSettings />
        <Toast />
      </div>
    );
  }

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
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button onClick={() => setView('allPackages')} style={{ background: '#00885514', border: '1px solid #00885530', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}>
                📦 Paquetes
              </button>
              <QuotesBadgeBtn onClick={() => setView('quotes')} />
              <button onClick={() => setView('zones')} style={{ background: '#5c35cc14', border: '1px solid #5c35cc30', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#5c35cc', cursor: 'pointer' }}>
                🗺 Zonas
              </button>
              <button onClick={() => setView('invoices')} style={{ background: '#fff3e0', border: '1px solid #f57c0030', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#f57c00', cursor: 'pointer' }}>
                💳 Cobros
              </button>
              <button onClick={() => setView('companies')} style={{ background: '#0050780e', border: '1px solid #00507820', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#005078', cursor: 'pointer' }}>
                🏢 Empresas
              </button>
              <button onClick={() => setView('users')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>
                👥 Usuarios
              </button>
              <ResetDataBtn onDone={() => { setRoutes([]); setSelectedRoute(null); }} />
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
                onCancel={handleCancelRoute}
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

      {/* Driver info banner */}
      {selectedRoute?.driverId && (
        <div style={{ background: '#0077aa08', borderBottom: '1px solid #0077aa1a', padding: '7px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14 }}>🚗</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0077aa' }}>{selectedRoute.driverId.name}</span>
          {selectedRoute.driverId.phone && (
            <>
              <span style={{ color: 'var(--border)', fontSize: 14 }}>·</span>
              <a href={`tel:${selectedRoute.driverId.phone}`} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none', fontWeight: 600 }}>
                📞 {selectedRoute.driverId.phone}
              </a>
            </>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#0077aa14', color: '#0077aa', border: '1px solid #0077aa20' }}>
            {new Date(selectedRoute.date).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      )}

      <div style={{ height: 2, background: 'var(--border)', flexShrink: 0 }}>
        <div style={{
          height: 2, background: 'linear-gradient(90deg, var(--accent), var(--a2))',
          width: activePackages.length ? `${(packages.filter(p => ['entregado', 'no-entregado'].includes(p.status)).length / activePackages.length * 100) || 0}%` : '0%',
          transition: 'width .5s'
        }} />
      </div>

      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[['m', '🗺 MAPA'], ['l', '📋 LISTA'], ['t', '📝 TABLA'], ['r', '📊 INFO']].map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); if (filter === 'sin-mapa') setFilter('todos'); }} style={{
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
            {noGeoCount > 0 && (
              <button onClick={() => setFilter(filter === 'sin-mapa' ? 'todos' : 'sin-mapa')} style={{
                flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                cursor: 'pointer',
                border: `1px solid ${filter === 'sin-mapa' ? '#d4650a' : '#d4650a50'}`,
                background: filter === 'sin-mapa' ? '#d4650a' : '#d4650a12',
                color: filter === 'sin-mapa' ? '#fff' : '#d4650a'
              }}>
                📍 Sin mapa ({noGeoCount})
              </button>
            )}
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
            driverLocation={driverLocation}
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
                sameAddressCount={addrCountMap[(pkg.address || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')] || 1}
              />
            ))}
          </div>
        )}

        {tab === 't' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {noGeoCount > 0 && (
              <div style={{ background: '#d4650a10', borderBottom: '1px solid #d4650a28', padding: '7px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13 }}>📍</span>
                <span style={{ fontSize: 12, color: '#d4650a', fontWeight: 600 }}>
                  {noGeoCount} paquete{noGeoCount > 1 ? 's' : ''} sin geocodificar — borde naranja en la tabla
                </span>
              </div>
            )}
            <PackageTable packages={packages} onUpdate={handlePkgUpdate} />
          </div>
        )}

        {tab === 'r' && (
          <AdminReport
            packages={packages}
            route={selectedRoute}
            geocoding={geocoding}
            onGeocode={handleGeocode}
            onRefresh={refreshRoute}
            onRouteUpdate={updated => setSelectedRoute(prev => ({ ...prev, ...updated }))}
            onReopen={async () => {
              try {
                await api.updateRoute(selectedRoute._id, { status: 'active' });
                const { route } = await api.getRoute(selectedRoute._id);
                setSelectedRoute(route);
                toast('🔓 Ruta reabierta como activa');
              } catch (err) { toast('❌ ' + err.message); }
            }}
            onDelete={async () => {
              const code = window.prompt(`⚠️ ELIMINAR RUTA ${selectedRoute.routeCode}\n\nSe eliminarán la ruta y TODOS sus paquetes permanentemente.\n\nEscribe CONFIRMAR para continuar:`);
              if (code !== 'CONFIRMAR') return;
              try {
                await api.permanentDeleteRoute(selectedRoute._id);
                toast('🗑️ Ruta eliminada');
                setView('routes');
                setSelectedRoute(null);
                setPackages([]);
                await loadRoutes();
              } catch (err) { toast('❌ ' + err.message); }
            }}
          />
        )}
      </div>

      {allDone && (
        <div style={{ position: 'fixed', bottom: 'calc(90px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 500, animation: 'scaleIn .3s var(--ease-spring) both' }}>
          <button
            onClick={handleCompleteRoute}
            style={{
              padding: '14px 28px', borderRadius: 'var(--r-full)', border: 'none',
              background: 'linear-gradient(135deg, #008855, #00aa66)',
              color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 6px 24px #00885550, 0 2px 8px #00000020',
              letterSpacing: '-.2px'
            }}
          >
            ✅ Finalizar ruta
          </button>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 400 }}>
        <button onClick={() => setShowImport(true)} title="Importar paquetes con IA (Excel, CSV, foto)" style={{ width: 52, height: 52, borderRadius: '50%', background: '#9c27b0', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 16px #9c27b040', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</button>
        {tab !== 'm' && <button onClick={() => setShowAddPkg(true)} style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px #00885540', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>}
      </div>

      {editPkg && <DeliveryModal pkg={editPkg} route={selectedRoute} onClose={() => setEditPkg(null)} onSaved={refreshRoute} />}
      {showAddPkg && <AddPackageModal routeId={selectedRoute._id} onClose={() => setShowAddPkg(false)} onCreated={() => { setShowAddPkg(false); refreshRoute(); }} />}
      {showImport && <ImportModal routeId={selectedRoute._id} onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); refreshRoute(); }} />}
      <Toast />
    </div>
  );
}

// ── Quotes button with live "submitted" badge ──
function QuotesBadgeBtn({ onClick }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    api.getQuotes()
      .then(qs => setCount(qs.filter(q => q.status === 'submitted').length))
      .catch(() => {});
  }, []);
  return (
    <button onClick={onClick} style={{ position: 'relative', background: '#f57c0014', border: '1px solid #f57c0030', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#f57c00', cursor: 'pointer' }}>
      💼 Cotizaciones
      {count > 0 && (
        <span style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#cc2244', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Route card in list ──
function RouteCard({ route, onClick, onStatusChange, onCancel, onDelete }) {
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
  const canReopen = route.status === 'completed' || route.status === 'cancelled';

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
        {!['completed'].includes(route.status) && (
          <button onClick={e => { e.stopPropagation(); onCancel(route); }} style={actBtn('#f57c00')}>✗ Cancelar</button>
        )}
        {canReopen && (
          <button onClick={e => { e.stopPropagation(); onStatusChange(route, 'active'); }} style={actBtn('var(--accent)')}>🔓 Reabrir</button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(route); }} style={actBtn('var(--danger)')}>🗑️ Eliminar</button>
      </div>
    </div>
  );
}

function actBtn(color) {
  return { padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${color}30`, background: `${color}12`, color };
}

// ── Info / Report tab ──
function AdminReport({ packages, route, geocoding, onGeocode, onRouteUpdate, onReopen, onDelete, onRefresh }) {
  const [editingRoute, setEditingRoute] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tariffs, setTariffs] = React.useState([]);
  const [drivers, setDrivers] = React.useState([]);
  const [geocodingStart, setGeocodingStart] = useState(false);
  const [shareToken, setShareToken] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareRevoked, setShareRevoked] = useState(false);

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const data = await api.generateShareLink(route._id);
      setShareToken(data.shareToken);
      setShareRevoked(false);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setShareLoading(false); }
  };

  const handleRevokeShare = async () => {
    if (!confirm('¿Revocar el enlace? Las personas con el enlace actual ya no podrán acceder.')) return;
    try {
      await api.revokeShareLink(route._id);
      setShareToken(null);
      setShareRevoked(true);
      toast('✅ Enlace revocado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const shareUrl = shareToken ? `${window.location.origin}/route/${shareToken}` : null;

  const copyShare = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => toast('📋 Enlace copiado'));
  };

  const handleGeocodeStart = async () => {
    if (!route?.startPoint?.address) return;
    setGeocodingStart(true);
    try {
      const updated = await api.updateRoute(route._id, { startPoint: { address: route.startPoint.address } });
      onRouteUpdate(updated);
      if (updated.startPoint?.lat) toast('✅ Punto de inicio ubicado en el mapa');
      else toast('⚠ No se encontró la dirección exacta — intenta editarla');
    } catch (err) { toast('❌ ' + err.message); }
    finally { setGeocodingStart(false); }
  };

  useEffect(() => {
    api.getTariffs().then(setTariffs).catch(() => {});
    api.getUsers().then(u => setDrivers(u.filter(x => x.role === 'driver' && x.active))).catch(() => {});
  }, []);

  useEffect(() => {
    setForm({
      name: route?.name || '',
      driverId: route?.driverId?._id || (typeof route?.driverId === 'string' ? route.driverId : '') || '',
      tariffId: route?.tariffId?._id || route?.tariffId || '',
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
    const prevDriverId = route?.driverId?._id || (typeof route?.driverId === 'string' ? route.driverId : '') || '';
    const driverChanged = form.driverId !== prevDriverId;
    try {
      const updated = await api.updateRoute(route._id, {
        name: form.name,
        driverId: form.driverId || null,
        tariffId: form.tariffId || null,
        clientCompany: form.clientCompany,
        invoice: { ...form.invoice, amount: form.invoice.amount !== '' ? Number(form.invoice.amount) : undefined, invoiceDate: form.invoice.invoiceDate || undefined },
        startPoint: { address: form.startPoint.address || undefined, lat: form.startPoint.lat !== '' ? Number(form.startPoint.lat) : undefined, lng: form.startPoint.lng !== '' ? Number(form.startPoint.lng) : undefined }
      });
      onRouteUpdate(updated);
      setEditingRoute(false);
      toast('✅ Ruta actualizada');
      // Refresh fully when driver changes so banner populates name/phone correctly
      if (driverChanged && onRefresh) onRefresh();
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
  const noCoordsPackages = active.filter(p => !p.lat || !p.lng);
  const noCoords = noCoordsPackages.length;

  if (!form) return null;

  return (
    <div style={{ padding: '14px 10px calc(80px + env(safe-area-inset-bottom))', overflowY: 'auto', height: '100%' }}>

      {/* Geocode alert — shows exactly which packages need fixing */}
      {noCoords > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #f57c0040', borderRadius: 13, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#d4650a', fontWeight: 700 }}>
              📍 {noCoords} paquete{noCoords > 1 ? 's' : ''} sin coordenadas
            </span>
            <button
              onClick={onGeocode}
              disabled={geocoding}
              style={{ padding: '7px 14px', borderRadius: 20, border: 'none', background: geocoding ? 'var(--border)' : '#f57c00', color: '#fff', fontSize: 12, fontWeight: 700, cursor: geocoding ? 'not-allowed' : 'pointer', flexShrink: 0 }}
            >
              {geocoding ? '⏳ Geocodificando…' : '🗺️ Geocodificar ruta'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#b34a00', marginBottom: 8, lineHeight: 1.4 }}>
            Estos paquetes no aparecen en el mapa. Corrígelos en la pestaña TABLA (clic en la dirección) o llama al cliente:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {noCoordsPackages.map((p, i) => (
              <div key={p._id} style={{ background: '#fff', border: '1px solid #f57c0030', borderRadius: 9, padding: '8px 11px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#f57c00', minWidth: 18 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {p.customerName} {p.customerLastName}
                  </div>
                  <div style={{ fontSize: 11, color: '#b34a00', marginTop: 2, fontWeight: 600 }}>
                    {p.address || '—'}{p.commune ? `, ${p.commune}` : ''}{p.aptFloor ? ` · ${p.aptFloor}` : ''}
                    {p.address && !/\d/.test(p.address.trim()) && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#cc2244', background: '#cc224412', border: '1px solid #cc224428', borderRadius: 20, padding: '1px 5px' }}>
                        ⚠ Falta número
                      </span>
                    )}
                  </div>
                  {p.customerPhone && (
                    <a href={`tel:${p.customerPhone}`} style={{ fontSize: 11, color: '#008855', fontWeight: 600, textDecoration: 'none', marginTop: 2, display: 'block' }}>
                      📞 {p.customerPhone}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
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

            <Label>Driver asignado</Label>
            <select value={form.driverId} onChange={e => set('driverId', e.target.value)} style={inp}>
              <option value="">Sin driver</option>
              {drivers.map(d => (
                <option key={d._id} value={d._id}>{d.name}{d.phone ? ` · ${d.phone}` : ''}</option>
              ))}
            </select>

            <Label>Configuración de precios</Label>
            <select value={form.tariffId} onChange={e => set('tariffId', e.target.value)} style={inp}>
              <option value="">Sin configuración de precios</option>
              {tariffs.map(t => <option key={t._id} value={t._id}>{t.name}{t.description ? ` — ${t.description}` : ''}</option>)}
            </select>

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
            <Label>Dirección bodega / bodega de retiro</Label>
            <AddressAutocomplete
              value={form.startPoint.address}
              onChange={v => setStart('address', v)}
              onSelect={({ address, lat, lng }) => setForm(f => ({ ...f, startPoint: { address, lat, lng } }))}
              placeholder="Av. Vitacura 2939, Vitacura…"
              dropdownFixed
            />
            {form.startPoint.lat && form.startPoint.lng && (
              <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>✓ Coordenadas listas — aparecerá en el mapa como punto #1</div>
            )}

            <button onClick={saveRoute} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', marginTop: 14, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Guardando…' : '✓ Guardar cambios'}
            </button>
          </div>
        ) : (
          <div>
            {/* Driver — always shown; "Asignar" button opens edit form */}
            {route?.driverId ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '9px 12px', background: '#0077aa08', border: '1px solid #0077aa20', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0077aa' }}>🚗 {route.driverId.name}</div>
                  {route.driverId.phone && (
                    <a href={`tel:${route.driverId.phone}`} style={{ fontSize: 11, color: '#008855', fontWeight: 600, textDecoration: 'none', marginTop: 2, display: 'block' }}>
                      📞 {route.driverId.phone}
                    </a>
                  )}
                </div>
                <button onClick={() => setEditingRoute(true)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', cursor: 'pointer', fontWeight: 700 }}>
                  Cambiar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '9px 12px', background: '#f57c0008', border: '1px solid #f57c0028', borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: '#f57c00', fontWeight: 600 }}>⚠ Sin driver asignado</span>
                <button onClick={() => setEditingRoute(true)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                  + Asignar driver
                </button>
              </div>
            )}

            {route?.name && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{route.name}</div>}
            {route?.tariffId && (
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 6 }}>
                💰 Config: {route.tariffId?.name || route.tariffId}
              </div>
            )}
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
            {route?.startPoint?.address && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>📍 Inicio: {route.startPoint.address}</span>
                {(!route.startPoint?.lat || !route.startPoint?.lng) && (
                  <button
                    onClick={handleGeocodeStart}
                    disabled={geocodingStart}
                    style={{ padding: '3px 10px', borderRadius: 20, border: 'none', background: '#f57c00', color: '#fff', fontSize: 10, fontWeight: 700, cursor: geocodingStart ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                  >
                    {geocodingStart ? '⏳…' : '🗺 Ubicar'}
                  </button>
                )}
                {route.startPoint?.lat && route.startPoint?.lng && (
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>✓ en mapa</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share link card */}
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 10 }}>🔗 ENLACE PARA EMPRESA</div>
        {shareUrl ? (
          <div>
            <div style={{ background: '#e8f5e9', border: '1px solid #00885530', borderRadius: 10, padding: '9px 12px', marginBottom: 8, fontSize: 11, color: '#005a30', wordBreak: 'break-all', fontFamily: 'monospace' }}>
              {shareUrl}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={copyShare} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📋 Copiar enlace</button>
              <a href={shareUrl} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>👁 Ver</a>
              <button onClick={handleRevokeShare} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid #cc224430', background: 'none', color: '#cc2244', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🗑️</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.4 }}>
              Genera un enlace para que la empresa vea el estado de la ruta en tiempo real sin necesidad de iniciar sesión. Solo verán el progreso total, no los precios por paquete.
            </div>
            {shareRevoked && <div style={{ fontSize: 11, color: '#cc2244', marginBottom: 8 }}>✓ Enlace anterior revocado</div>}
            <button
              onClick={handleShare}
              disabled={shareLoading}
              style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', background: shareLoading ? 'var(--border)' : '#0077aa', color: '#fff', fontSize: 13, fontWeight: 700, cursor: shareLoading ? 'not-allowed' : 'pointer' }}
            >
              {shareLoading ? '⏳ Generando…' : '🔗 Generar enlace de seguimiento'}
            </button>
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

      {/* Reopen completed / cancelled route */}
      {(route?.status === 'completed' || route?.status === 'cancelled') && onReopen && (
        <div style={{ marginTop: 16, padding: '13px 14px', background: '#00885508', border: '1px solid #00885530', borderRadius: 13 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, letterSpacing: 1 }}>🔓 REABRIR RUTA</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Vuelve la ruta a estado "Activa" para poder editarla, agregar paquetes o corregir datos.
          </div>
          <button
            onClick={onReopen}
            style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid #00885550', background: '#00885512', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            🔓 Reabrir como activa
          </button>
        </div>
      )}

      {/* Delete route zone */}
      {onDelete && (
        <div style={{ marginTop: 16, padding: '14px', background: '#cc224408', border: '1px solid #cc224430', borderRadius: 13 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#cc2244', marginBottom: 8, letterSpacing: 1 }}>⚠️ ZONA PELIGROSA</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Eliminar la ruta borrará permanentemente todos los datos. Esta acción no se puede deshacer.
          </div>
          <button
            onClick={onDelete}
            style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid #cc224450', background: '#cc224412', color: '#cc2244', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            🗑️ Eliminar ruta permanentemente
          </button>
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', margin: '8px 0 3px' }}>{children}</div>;
}

const inp = { width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, padding: '9px 12px', outline: 'none', display: 'block', WebkitAppearance: 'none', boxSizing: 'border-box' };

// ── ResetDataBtn ──────────────────────────────────────────────────────────────
function ResetDataBtn({ onDone }) {
  const [busy, setBusy] = React.useState(false);

  const handleReset = async () => {
    const confirmed = window.confirm(
      '⚠️ BORRAR TODO\n\nEsto eliminará:\n• Todas las rutas\n• Todos los paquetes\n• Cotizaciones\n• Tarifas\n• Zonas y precios\n\nLos usuarios NO se borran.\n\n¿Confirmar?'
    );
    if (!confirmed) return;
    const reconfirm = window.confirm('¿Estás seguro? Esta acción no se puede deshacer.');
    if (!reconfirm) return;

    setBusy(true);
    try {
      const result = await api.resetAllData();
      toast(`🗑️ Listo — ${result.deleted.routes} rutas, ${result.deleted.packages} paquetes eliminados`);
      onDone?.();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={busy}
      style={{ background: '#cc224408', border: '1px solid #cc224430', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#cc2244', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
    >
      {busy ? '⏳…' : '🗑️ Reset DB'}
    </button>
  );
}

// ── ZonesView ─────────────────────────────────────────────────────────────────
function ZonesView({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="🗺 Zonas y precios" onBack={onBack} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SectorMap />
      </div>
      <Toast />
    </div>
  );
}
