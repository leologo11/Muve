import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../api/index.js';
import Header from '../../components/Header.jsx';
import RouteMap from '../../components/RouteMap.jsx';
import PackageCard from '../../components/PackageCard.jsx';
import PackageTable from './PackageTable.jsx';
import DeliveryModal from '../../components/DeliveryModal.jsx';
import Toast, { toast } from '../../components/Toast.jsx';
import UserManager from './UserManager.jsx';
import InvoiceView from './InvoiceView.jsx';
import AddRouteModal from './AddRouteModal.jsx';
import PoolAssignModal from './PoolAssignModal.jsx';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';
import PriceSettings from '../../components/PriceSettings.jsx';
import SectorMap from './SectorMap.jsx';
import AllPackagesView from './AllPackagesView.jsx';
import QuotesView from './QuotesView.jsx';
import CompaniesView from './CompaniesView.jsx';
import CredentialsView from './CredentialsView.jsx';
import MovePricingView from './MovePricingView.jsx';
import GeneralMapView from './GeneralMapView.jsx';
import AnalyticsView from './AnalyticsView.jsx';
import PresupuestoView from './PresupuestoView.jsx';
import PruebaView from '../public/PruebaView.jsx';

const STATUS_META = {
  draft:      { label: 'Borrador',   color: 'var(--muted)',   bg: 'var(--card2)' },
  active:     { label: '● Activa',   color: 'var(--accent)',  bg: '#0052FF12' },
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
  const [routeDriverFilter, setRouteDriverFilter] = useState('');
  const [editPkg, setEditPkg] = useState(null);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [showPoolAssign, setShowPoolAssign] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [driverLocation, setDriverLocation] = useState(null);
  const [routeDrivers, setRouteDrivers] = useState([]);

  useEffect(() => {
    loadRoutes();
    api.getUsers()
      .then(users => setRouteDrivers(users.filter(u => u.role === 'driver' && u.active !== false)))
      .catch(() => {});
  }, []);

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

  // Poll for new submitted quotes every 30s and notify admin
  const knownQuoteIds = useRef(null);
  useEffect(() => {
    const poll = async () => {
      try {
        const quotes = await api.getQuotes();
        const submitted = quotes.filter(q => q.status === 'submitted');
        const currentIds = new Set(submitted.map(q => q._id || q.id));
        if (knownQuoteIds.current === null) {
          knownQuoteIds.current = currentIds;
          return;
        }
        const fresh = submitted.filter(q => !knownQuoteIds.current.has(q._id || q.id));
        knownQuoteIds.current = currentIds;
        if (!fresh.length) return;
        const msg = fresh.length === 1
          ? `Nueva cotización de ${fresh[0].contactPerson || 'cliente'}`
          : `${fresh.length} nuevas cotizaciones recibidas`;
        toast('💼 ' + msg);
        if (Notification?.permission === 'granted') {
          new Notification('MUVE — Nueva cotización', { body: msg, icon: '/logo_reducido.png' });
        } else if (Notification?.permission === 'default') {
          Notification.requestPermission();
        }
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 30000);
    return () => clearInterval(timer);
  }, []);

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
    if (!confirm(`Quitar a ${pkg.customerName || 'este paquete'} de esta ruta?\n\nEl paquete NO se borra del sistema. Quedara sin ruta en Paquetes.`)) return;
    try {
      await api.updatePackage(pkg._id, { routeId: null });
      setPackages(prev => prev.filter(p => p._id !== pkg._id));
      toast('Paquete quitado de la ruta');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleMovePackageToRoute = async (pkg, targetRouteId) => {
    const target = routes.find(r => String(r._id || r.id) === String(targetRouteId));
    if (!targetRouteId || !target) return;
    if (!confirm(`Mover ${pkg.trackingId || pkg.customerName || 'este paquete'} a ${target.routeCode}${target.driverId?.name ? ` (${target.driverId.name})` : ''}?`)) return;
    try {
      await api.updatePackage(pkg._id, { routeId: targetRouteId });
      setPackages(prev => prev.filter(p => p._id !== pkg._id));
      toast('Paquete movido a otra ruta');
      loadRoutes();
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

  const handleRouteDriverChange = async (route, driverId) => {
    try {
      await api.updateRoute(route._id || route.id, { driverId: driverId || null });
      const driversById = new Map(routeDrivers.map(d => [String(d._id || d.id), d]));
      const driver = driverId ? driversById.get(String(driverId)) : null;
      setRoutes(prev => prev.map(r => String(r._id || r.id) === String(route._id || route.id)
        ? { ...r, driverId: driver ? { _id: driver._id || driver.id, id: driver._id || driver.id, name: driver.name, phone: driver.phone } : null }
        : r
      ));
      toast(driver ? `Driver asignado: ${driver.name}` : 'Ruta sin driver');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleDeleteRoute = async (route) => {
    const code = window.prompt(
      `⚠️ ELIMINAR RUTA ${route.routeCode}\n\nLa ruta se eliminará permanentemente.\nLos paquetes NO se borran — quedan libres en el pool sin ruta asignada.\n\nEscribe CONFIRMAR para continuar:`
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
      const key = (p.address || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
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
      const matchF = routeFilter === 'all' ? r.status !== 'cancelled' : r.status === routeFilter;
      const matchDriver = !routeDriverFilter || r.driverId?.name === routeDriverFilter;
      return matchQ && matchF && matchDriver;
    });
  }, [routes, routeSearch, routeFilter, routeDriverFilter]);

  const routeDriverNames = useMemo(() => (
    [...new Set(routes.map(r => r.driverId?.name).filter(Boolean))].sort()
  ), [routes]);

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
        <div style={{ display: 'flex', alignItems: 'center', padding: 'max(10px,env(safe-area-inset-top)) 14px 10px', borderBottom: '1px solid var(--border)', background: '#fff', gap: 10, flexShrink: 0 }}>
          <button onClick={() => setView('routes')} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '2px 6px' }}>←</button>
          <span style={{ fontSize: 15, fontWeight: 900, flex: 1 }}>💼 Cotizaciones</span>
          <button onClick={() => setView('presupuesto')} style={{ border: '1px solid #0369a1', background: '#e0f2fe', borderRadius: 9, padding: '6px 11px', fontSize: 12, fontWeight: 800, cursor: 'pointer', color: '#0369a1', whiteSpace: 'nowrap' }}>
            📄 Generar presupuesto
          </button>
        </div>
        <QuotesView />
        <Toast />
      </div>
    );
  }

  if (view === 'credentials') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header title="Credenciales API" onBack={() => setView('routes')} />
        <CredentialsView />
        <Toast />
      </div>
    );
  }

  if (view === 'movePricing') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header title="🚛 Precios Fletes y Mudanzas" onBack={() => setView('routes')} />
        <MovePricingView />
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

  // ── GENERAL MAP VIEW ──
  if (view === 'generalMap') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header title="🗺 Mapa General de Paquetes" onBack={() => setView('routes')} />
        <GeneralMapView />
        <Toast />
      </div>
    );
  }

  // ── ANALYTICS VIEW ──
  if (view === 'analytics') {
    return <AnalyticsView onBack={() => setView('routes')} />;
  }

  // ── PRESUPUESTO VIEW ──
  if (view === 'presupuesto') {
    return <PresupuestoView onBack={() => setView('routes')} />;
  }

  // ── AI TRAINING VIEW ──
  if (view === 'aiTraining') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header title="🤖 Entrenamiento IA — Cotizador" onBack={() => setView('routes')} />
        <PruebaView />
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
            <AdminMainMenu
              setView={setView}
              onResetDone={() => { setRoutes([]); setSelectedRoute(null); }}
            />
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
            {[['all', 'Todas'], ['active', '● Activas'], ['paused', '⏸ Pausadas'], ['draft', 'Borrador'], ['completed', '✓ Completadas'], ['cancelled', '✕ Canceladas']].map(([val, lbl]) => (
              <button key={val} onClick={() => setRouteFilter(val)} style={{
                flexShrink: 0, padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: routeFilter === val ? 'var(--accent)' : 'var(--card2)',
                color: routeFilter === val ? '#fff' : 'var(--muted)'
              }}>{lbl}</button>
            ))}
            {routeDriverNames.length > 0 && (
              <select
                value={routeDriverFilter}
                onChange={e => setRouteDriverFilter(e.target.value)}
                style={{
                  flexShrink: 0,
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  border: routeDriverFilter ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: routeDriverFilter ? '#0052FF12' : 'var(--card2)',
                  color: routeDriverFilter ? 'var(--accent)' : 'var(--muted)',
                  outline: 'none',
                }}
              >
                <option value="">Todos los drivers</option>
                {routeDriverNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
            {(routeFilter !== 'all' || routeDriverFilter || routeSearch) && (
              <button
                onClick={() => { setRouteFilter('all'); setRouteDriverFilter(''); setRouteSearch(''); }}
                style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Limpiar
              </button>
            )}
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
                drivers={routeDrivers}
                onClick={() => loadRoute(route._id)}
                onStatusChange={handleRouteStatus}
                onDriverChange={handleRouteDriverChange}
                onCancel={handleCancelRoute}
                onDelete={handleDeleteRoute}
              />
            ))
          )}
        </div>

        <button
          onClick={() => setShowAddRoute(true)}
          style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16, width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px #0052FF40', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
            style={{ background: optimizing ? 'var(--card2)' : '#0052FF12', border: '1px solid #0052FF30', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', cursor: optimizing ? 'not-allowed' : 'pointer' }}
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
                sameAddressCount={addrCountMap[(pkg.address || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')] || 1}
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
            <PackageTable
              packages={packages}
              onUpdate={handlePkgUpdate}
              onDelete={handleDelete}
              onMoveRoute={handleMovePackageToRoute}
              routeOptions={routes.filter(r => ['draft', 'active'].includes(r.status))}
              currentRouteId={selectedRoute?._id || selectedRoute?.id}
            />
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
              background: 'linear-gradient(135deg, #0052FF, #00DAFF)',
              color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 6px 24px #0052FF50, 0 2px 8px #00000020',
              letterSpacing: '-.2px'
            }}
          >
            ✅ Finalizar ruta
          </button>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 400 }}>
        <button
          onClick={() => setShowPoolAssign(true)}
          title="Asignar paquetes del pool a esta ruta"
          style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 16px #0052FF40', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          📦
        </button>
      </div>

      {editPkg && <DeliveryModal pkg={editPkg} route={selectedRoute} onClose={() => setEditPkg(null)} onSaved={refreshRoute} />}
      {showPoolAssign && (
        <PoolAssignModal
          route={selectedRoute}
          onClose={() => setShowPoolAssign(false)}
          onAssigned={() => { setShowPoolAssign(false); refreshRoute(); }}
        />
      )}
      <Toast />
    </div>
  );
}

// ── Quotes button with live "submitted" badge ──
function AdminMainMenu({ setView, onResetDone }) {
  const [open, setOpen] = useState(false);
  const go = (nextView) => {
    setOpen(false);
    setView(nextView);
  };
  const items = [
    { label: 'Paquetes', desc: 'Ver, mover e importar paquetes', view: 'allPackages', color: 'var(--accent)', bg: '#0052FF14' },
    { label: 'Mapa general', desc: 'Mapa, filtros y zonas de entrega', view: 'generalMap', color: '#16a34a', bg: '#22c55e14' },
    { label: 'Zonas', desc: 'Sectores y mapa de comunas', view: 'zones', color: '#5c35cc', bg: '#5c35cc14' },
    { label: 'Cobros', desc: 'Facturas y rutas por cobrar', view: 'invoices', color: '#f57c00', bg: '#fff3e0' },
    { label: 'Empresas', desc: 'Clientes, proveedores y contactos', view: 'companies', color: '#005078', bg: '#0050780e' },
    { label: 'Usuarios', desc: 'Admin, drivers y empresas', view: 'users', color: 'var(--muted)', bg: 'var(--card2)' },
    { label: 'Precios', desc: 'Fletes, mudanzas e items', view: 'movePricing', color: 'var(--accent)', bg: '#0052FF12' },
    { label: 'Precios comuna', desc: 'Tarifas de paquetería por comuna', view: 'prices', color: '#0e7490', bg: '#0e749012' },
    { label: 'API Keys',   desc: 'Credenciales de integracion',             view: 'credentials', color: '#fff', bg: 'linear-gradient(135deg, #0052FF 0%, #00DAFF 100%)' },
    { label: 'Analytics',    desc: 'Funnel de visitas del cotizador público',  view: 'analytics',   color: '#7C3AED', bg: '#7c3aed10' },
    { label: 'Presupuestos', desc: 'Generar presupuesto PDF con ítems y precios', view: 'presupuesto', color: '#0369a1', bg: '#e0f2fe' },
    { label: 'Entrena IA', desc: 'Revisar y corregir cotizaciones del cotizador público', view: 'aiTraining', color: '#7C3AED', bg: '#7c3aed10' },
  ];

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, minHeight: 34,
          border: '1px solid #0052FF30', borderRadius: 10, padding: '7px 11px',
          background: '#0052FF12', color: 'var(--accent)', fontSize: 12,
          fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>☰</span>
        Menu
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(15,23,42,.34)', display: 'flex',
            justifyContent: 'flex-end', alignItems: 'flex-start',
            padding: 'max(12px, env(safe-area-inset-top)) 10px 10px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(390px, calc(100vw - 20px))',
              maxHeight: 'calc(100dvh - 24px)',
              overflowY: 'auto',
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 18,
              boxShadow: '0 20px 70px rgba(15,23,42,.28)',
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>Menu admin</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Todas las opciones en un solo lugar</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menu"
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card2)',
                  color: 'var(--muted)', fontSize: 18, fontWeight: 800, cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <QuotesBadgeBtn onClick={() => go('quotes')} wide />
              {items.map(item => (
                <button
                  key={item.view}
                  onClick={() => go(item.view)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    background: item.bg,
                    color: item.color === '#fff' ? '#fff' : 'var(--text)',
                    padding: '11px 12px',
                    cursor: 'pointer',
                    boxShadow: item.color === '#fff' ? '0 8px 18px #0052ff24' : 'none',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, color: item.color }}>{item.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: item.color === '#fff' ? 'rgba(255,255,255,.86)' : 'var(--muted)', marginTop: 2 }}>
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DemoModeBtn onDone={() => { setOpen(false); onResetDone?.(); }} wide />
              <ResetDataBtn onDone={() => { setOpen(false); onResetDone?.(); }} wide />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuotesBadgeBtn({ onClick, wide = false }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    api.getQuotes()
      .then(qs => setCount(qs.filter(q => q.status === 'submitted').length))
      .catch(() => {});
  }, []);
  return (
    <button onClick={onClick} style={{ position: 'relative', background: '#f57c0014', border: '1px solid #f57c0030', borderRadius: wide ? 12 : 8, padding: wide ? '11px 12px' : '4px 10px', fontSize: wide ? 13 : 11, fontWeight: wide ? 900 : 700, color: '#f57c00', cursor: 'pointer', width: wide ? '100%' : 'auto', textAlign: wide ? 'left' : 'center' }}>
      💼 Cotizaciones
      {wide && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>Solicitudes enviadas por clientes</div>}
      {count > 0 && (
        <span style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#cc2244', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Route card in list ──
function RouteCard({ route, drivers = [], onClick, onStatusChange, onDriverChange, onCancel, onDelete }) {
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
  const driverName = route.driverId?.name;

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: route.status === 'active' && driverName ? '1px solid #0077aa40' : '1px solid var(--border)', padding: '13px 14px', marginBottom: 10, boxShadow: '0 1px 4px #0000000a', cursor: 'pointer' }} onClick={onClick}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{route.name || route.routeCode}</div>
          {route.name && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{route.routeCode}</div>}
          <select
            value={route.driverId?._id || route.driverId?.id || ''}
            onClick={e => e.stopPropagation()}
            onChange={e => {
              e.stopPropagation();
              onDriverChange?.(route, e.target.value);
            }}
            style={{
              marginTop: 5,
              maxWidth: 220,
              padding: '3px 8px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 800,
              outline: 'none',
              background: driverName ? (route.status === 'active' ? '#0077aa12' : '#64748b10') : '#f59e0b12',
              color: driverName ? (route.status === 'active' ? '#0077aa' : 'var(--muted)') : '#b45309',
              border: `1px solid ${driverName ? (route.status === 'active' ? '#0077aa30' : '#64748b20') : '#f59e0b30'}`,
              cursor: 'pointer',
            }}
          >
            <option value="">Sin driver</option>
            {drivers.map(d => (
              <option key={d._id || d.id} value={d._id || d.id}>
                {d.name}
              </option>
            ))}
          </select>
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
        <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
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
        <button onClick={e => { e.stopPropagation(); onClick(); }} style={actBtn('var(--accent)')}>📂 Abrir ruta</button>
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

function MiniMoney({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 800, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color, fontWeight: 900 }}>${Number(value || 0).toLocaleString('es-CL')}</div>
    </div>
  );
}

// ── Info / Report tab ──
function isPayableForDriver(pkg) {
  if (pkg.deliveryMeta?.payStatus === 'rejected') return false;
  if (pkg.status === 'entregado') return true;
  if (pkg.status === 'no-entregado') return Boolean(pkg.failReason);
  if (pkg.status === 'devuelto') return Boolean(pkg.failReason || pkg.note);
  return false;
}

function AdminReport({ packages, route, geocoding, onGeocode, onRouteUpdate, onReopen, onDelete, onRefresh }) {
  const [editingRoute, setEditingRoute] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tariffs, setTariffs] = React.useState([]);
  const [drivers, setDrivers] = React.useState([]);
  const [clientCompanies, setClientCompanies] = React.useState([]);
  const [geocodingStart, setGeocodingStart] = useState(false);
  const [shareToken, setShareToken] = useState(route?.shareToken || null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareRevoked, setShareRevoked] = useState(false);
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const [selectedCos, setSelectedCos] = useState(new Set());

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
    api.getCompanies().then(list => setClientCompanies(list.filter(c => c.active !== false))).catch(() => {});
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
      driverPayout: route?.driverPayout ?? '',
      driverSettlement: {
        status: route?.driverSettlement?.status || 'pending',
        mode: route?.driverSettlement?.mode || 'proportional_delivered',
        adjustment: route?.driverSettlement?.adjustment ?? 0,
        approvedAmount: route?.driverSettlement?.approvedAmount ?? '',
        note: route?.driverSettlement?.note || ''
      },
      startPoint: { address: route?.startPoint?.address || '', lat: route?.startPoint?.lat ?? '', lng: route?.startPoint?.lng ?? '' }
    });
  }, [route]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCompany = (k, v) => setForm(f => ({ ...f, clientCompany: { ...f.clientCompany, [k]: v } }));
  const setInvoice = (k, v) => setForm(f => ({ ...f, invoice: { ...f.invoice, [k]: v } }));
  const setSettlement = (k, v) => setForm(f => ({ ...f, driverSettlement: { ...f.driverSettlement, [k]: v } }));
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
        driverPayout: form.driverPayout !== '' ? Number(form.driverPayout) : null,
        driverSettlement: {
          ...form.driverSettlement,
          adjustment: Number(form.driverSettlement.adjustment || 0),
          approvedAmount: form.driverSettlement.approvedAmount !== '' ? Number(form.driverSettlement.approvedAmount) : undefined,
        },
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
  const pending = active.filter(p => p.status === 'pendiente');

  const routeCompanies = React.useMemo(() => {
    const map = {};
    active.forEach(p => {
      if (!p.companyId) return;
      if (!map[p.companyId]) {
        const co = clientCompanies.find(c => c._id === p.companyId);
        map[p.companyId] = { id: p.companyId, name: co?.name || 'Sin empresa', count: 0 };
      }
      map[p.companyId].count++;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [active, clientCompanies]);
  const payable = active.filter(isPayableForDriver);
  const total = active.reduce((s, p) => s + (p.price || 0), 0);
  const collected = delivered.reduce((s, p) => s + (p.price || 0), 0);
  const driverSettlement = route?.driverSettlement || {};
  const driverBase = Number(route?.driverPayout || driverSettlement.baseAmount || 0);
  const driverUnitValue = active.length ? Math.round(driverBase / active.length) : 0;
  const unpaidDriverPackages = active.filter(p => !isPayableForDriver(p));
  const deliveredRatio = active.length ? payable.length / active.length : 0;
  const suggestedDriverPay = driverSettlement.mode === 'fixed'
    ? driverBase
    : driverSettlement.mode === 'manual'
      ? Number(driverSettlement.approvedAmount || driverBase || 0)
      : Math.round(driverBase * deliveredRatio);
  const driverDiscount = driverSettlement.mode === 'proportional_delivered'
    ? Math.max(0, driverBase - suggestedDriverPay)
    : 0;
  const driverAdjustment = Number(driverSettlement.adjustment || 0);
  const driverFinal = Math.max(0, Number(driverSettlement.approvedAmount || suggestedDriverPay + driverAdjustment || 0));
  const companyMargin = total - driverFinal;
  const inv = route?.invoice;
  const dueDate = inv?.dueDate ? new Date(inv.dueDate) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - Date.now()) / 86400000) : null;
  const noCoordsPackages = active.filter(p => !p.lat || !p.lng);
  const noCoords = noCoordsPackages.length;

  if (!form) return null;

  const saveDriverSettlement = async (patch = {}) => {
    const next = {
      ...form.driverSettlement,
      ...patch,
      mode: patch.mode || form.driverSettlement.mode,
      adjustment: Number((patch.adjustment ?? form.driverSettlement.adjustment) || 0),
      baseAmount: driverBase,
      calculatedAmount: suggestedDriverPay,
      driverUnitValue,
      discountAmount: driverDiscount,
      approvedAmount: patch.approvedAmount !== undefined
        ? Number(patch.approvedAmount || 0)
        : (form.driverSettlement.approvedAmount !== '' ? Number(form.driverSettlement.approvedAmount) : driverFinal),
      delivered: delivered.length,
      payable: payable.length,
      failed: failed.length,
      pending: pending.length,
      discountedPackages: unpaidDriverPackages.length,
      totalPackages: active.length,
      updatedAt: new Date().toISOString(),
    };
    if (next.status === 'paid' && !next.paidAt) next.paidAt = new Date().toISOString();
    try {
      const updated = await api.updateRoute(route._id, {
        driverPayout: driverBase || null,
        driverSettlement: next,
      });
      onRouteUpdate(updated);
      setForm(f => ({ ...f, driverSettlement: { ...f.driverSettlement, ...next } }));
      toast('Liquidacion de driver actualizada');
    } catch (err) { toast('Error: ' + err.message); }
  };

  const reviewPackagePay = async (pkg, payStatus) => {
    try {
      await api.updatePackage(pkg._id, {
        deliveryMeta: {
          ...(pkg.deliveryMeta || {}),
          payStatus,
          payReviewedAt: new Date().toISOString(),
        }
      });
      toast(payStatus === 'rejected' ? 'Pago del paquete rechazado' : 'Pago del paquete aprobado');
      onRefresh?.();
    } catch (err) { toast('Error: ' + err.message); }
  };

  const handlePrintPDF = () => {
    const delivered = packages.filter(p => p.status === 'entregado');
    const failed    = packages.filter(p => p.status === 'no-entregado');
    const pending   = packages.filter(p => p.status === 'pendiente');
    const billed    = [...delivered, ...failed];
    const total     = billed.reduce((s, p) => s + Number(p.price || 0), 0);
    const pendingAmt= pending.reduce((s, p) => s + Number(p.price || 0), 0);
    const fmt = n => Number(n || 0).toLocaleString('es-CL');
    const dateStr = route.date ? new Date(route.date + 'T12:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
    const client = route.clientCompany?.name || route.companyName || '';

    const pkgRows = (list, color, badge) => list.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.customerName || ''} ${p.customerLastName || ''}</td>
        <td>${p.address || ''}${p.commune ? ', ' + p.commune : ''}${p.aptFloor ? ' · ' + p.aptFloor : ''}</td>
        <td>${p.trackingId || ''}</td>
        <td style="text-align:center"><span style="background:${color}20;color:${color};border:1px solid ${color}40;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">${badge}</span></td>
        <td style="text-align:right;font-weight:700">$${fmt(p.price)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Liquidación ${route.routeCode} · MUVE</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;background:#fff;padding:36px;font-size:13px;line-height:1.5}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:3px solid #0052FF;margin-bottom:24px}
.logo{font-size:28px;font-weight:900;color:#0052FF;letter-spacing:-1px}.logo span{color:#00DAFF}
.doc-title{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.8px;text-align:right}
.doc-number{font-size:22px;font-weight:900;color:#0052FF;text-align:right}
.doc-date{font-size:11px;color:#64748b;text-align:right}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
.card-label{font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px}
.card-value{font-size:14px;font-weight:700;color:#1e293b}
.card-sub{font-size:11px;color:#64748b;margin-top:2px}
h3{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin:18px 0 8px}
table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:12px}
thead tr{background:#0052FF}
thead th{padding:8px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;text-align:left}
tbody tr:nth-child(even){background:#f8fafc}
tbody td{padding:8px 10px;border-bottom:1px solid #e2e8f0}
.totals{display:flex;justify-content:flex-end;margin-top:20px}
.totals-box{width:260px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
.t-row{display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid #e2e8f0;font-size:12px}
.t-row:last-child{background:#0052FF;color:#fff;font-size:15px;font-weight:900;border-bottom:none}
.t-row.pending{color:#94a3b8}
.note{font-size:10px;color:#94a3b8;margin-top:6px;text-align:right}
.footer{margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
@media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <div><div class="logo">MU<span>VE</span></div><div style="font-size:10px;color:#64748b;margin-top:2px">Logística y Delivery · Chile</div></div>
  <div>
    <div class="doc-title">Liquidación de Ruta</div>
    <div class="doc-number">${route.routeCode}</div>
    <div class="doc-date">${dateStr}</div>
  </div>
</div>
<div class="info-grid">
  <div class="card"><div class="card-label">Cliente</div><div class="card-value">${client || '—'}</div>${route.clientCompany?.contactPerson ? `<div class="card-sub">${route.clientCompany.contactPerson}</div>` : ''}</div>
  <div class="card"><div class="card-label">Ruta</div><div class="card-value">${route.routeCode}${route.name ? ' · ' + route.name : ''}</div><div class="card-sub">${route.driverId?.name ? '🚗 ' + route.driverId.name : 'Sin driver'}</div></div>
</div>
${delivered.length ? `<h3>✅ Entregados (${delivered.length})</h3>
<table><thead><tr><th>#</th><th>Cliente</th><th>Dirección</th><th>Tracking</th><th>Estado</th><th style="text-align:right">Precio</th></tr></thead>
<tbody>${pkgRows(delivered, '#16a34a', 'Entregado')}</tbody></table>` : ''}
${failed.length ? `<h3>❌ No entregados — cobro por intento (${failed.length})</h3>
<table><thead><tr><th>#</th><th>Cliente</th><th>Dirección</th><th>Tracking</th><th>Estado</th><th style="text-align:right">Precio</th></tr></thead>
<tbody>${pkgRows(failed, '#ef4444', 'No entregado')}</tbody></table>` : ''}
${pending.length ? `<h3>⏳ Pendientes — sin cobrar aún (${pending.length})</h3>
<table><thead><tr><th>#</th><th>Cliente</th><th>Dirección</th><th>Tracking</th><th>Estado</th><th style="text-align:right">Precio ref.</th></tr></thead>
<tbody>${pkgRows(pending, '#94a3b8', 'Pendiente')}</tbody></table>` : ''}
<div class="totals"><div class="totals-box">
  <div class="t-row"><span>Entregados (${delivered.length})</span><span>$${fmt(delivered.reduce((s,p)=>s+Number(p.price||0),0))}</span></div>
  ${failed.length ? `<div class="t-row"><span>No entregados — cobro (${failed.length})</span><span>$${fmt(failed.reduce((s,p)=>s+Number(p.price||0),0))}</span></div>` : ''}
  ${pending.length ? `<div class="t-row pending"><span>Pendientes (${pending.length})</span><span>$${fmt(pendingAmt)}</span></div>` : ''}
  <div class="t-row"><span>TOTAL A COBRAR</span><span>$${fmt(total)}</span></div>
</div></div>
${total ? `<div class="note">* Los paquetes "No entregados" se cobran porque el repartidor se presentó en la dirección.</div>` : ''}
<div class="footer"><span>Generado por MUVE · ${new Date().toLocaleDateString('es-CL')}</span><span>📞 Consultas: ${route.clientCompany?.contactPhone || '—'}</span></div>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { toast('⚠ Permite popups para generar el PDF'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  };

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
                    <a href={`tel:${p.customerPhone}`} style={{ fontSize: 11, color: '#0052FF', fontWeight: 600, textDecoration: 'none', marginTop: 2, display: 'block' }}>
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
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handlePrintPDF} style={{ background: '#0052FF10', border: '1px solid #0052FF40', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}>
              📄 Liquidación
            </button>
            <button onClick={() => setEditingRoute(v => !v)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>
              {editingRoute ? '✕ Cancelar' : '✏️ Editar'}
            </button>
          </div>
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

            <div style={{ margin: '14px 0 6px', padding: '11px 13px', background: '#00507808', border: '1px solid #00507820', borderRadius: 11 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#005078', marginBottom: 10 }}>🏢 EMPRESA CLIENTE</div>

              {/* Selector de empresas registradas — auto-llena los campos */}
              {clientCompanies.length > 0 && (
                <>
                  <Label>Seleccionar empresa registrada</Label>
                  <select
                    value={clientCompanies.find(c => c.name === form.clientCompany.name)?._id || ''}
                    onChange={e => {
                      const c = clientCompanies.find(x => x._id === e.target.value);
                      if (c) setForm(f => ({ ...f, clientCompany: { name: c.name, contactPerson: c.contactPerson || '', contactPhone: c.contactPhone || '' } }));
                      else setForm(f => ({ ...f, clientCompany: { name: '', contactPerson: '', contactPhone: '' } }));
                    }}
                    style={{ ...inp, marginBottom: 10 }}
                  >
                    <option value="">— Elegir empresa registrada —</option>
                    {clientCompanies.map(c => (
                      <option key={c._id} value={c._id}>{c.name}{c.contactPerson ? ` · ${c.contactPerson}` : ''}</option>
                    ))}
                  </select>
                </>
              )}

              <Label>Nombre empresa</Label>
              <input value={form.clientCompany.name} onChange={e => setCompany('name', e.target.value)} placeholder="Importadora ABC" style={inp} />
              <Label>Responsable / Contacto</Label>
              <input value={form.clientCompany.contactPerson} onChange={e => setCompany('contactPerson', e.target.value)} placeholder="Nombre y apellido" style={inp} />
              <Label>Teléfono WhatsApp</Label>
              <input value={form.clientCompany.contactPhone} onChange={e => setCompany('contactPhone', e.target.value)} placeholder="+56 9 xxxx xxxx" style={inp} />
            </div>

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

            <div style={{ margin: '14px 0 8px', padding: '12px 14px', background: '#0052FF08', border: '1px solid #0052FF25', borderRadius: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, marginBottom: 6 }}>📍 PUNTO DE INICIO / DIRECCIÓN DE RETIRO</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Desde aquí parte el repartidor. Será el punto nº1 y el origen para la optimización de ruta.</div>
              <AddressAutocomplete
                value={form.startPoint.address}
                onChange={v => setStart('address', v)}
                onSelect={({ address, lat, lng }) => setForm(f => ({ ...f, startPoint: { address, lat, lng } }))}
                placeholder="Ej: Av. Vitacura 2939, Vitacura…"
                dropdownFixed
              />
              {form.startPoint.lat && form.startPoint.lng
                ? <div style={{ fontSize: 11, color: '#16a34a', marginTop: 6, fontWeight: 600 }}>✓ Coordenadas listas — se usará como origen en la optimización</div>
                : form.startPoint.address
                  ? <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>⚠ Selecciona una sugerencia del listado para obtener coordenadas exactas</div>
                  : null
              }
            </div>

            <div style={{ margin: '14px 0 4px', fontSize: 11, fontWeight: 700, color: '#0077aa', letterSpacing: 1 }}>PAGO DRIVER</div>
            <Label>Monto base pactado</Label>
            <input type="number" value={form.driverPayout} onChange={e => set('driverPayout', e.target.value)} placeholder="Ej: 60000" style={inp} />
            <Label>Regla de liquidacion</Label>
            <select value={form.driverSettlement.mode} onChange={e => setSettlement('mode', e.target.value)} style={inp}>
              <option value="proportional_delivered">Proporcional a entregados</option>
              <option value="fixed">Fijo si se revisa manualmente</option>
              <option value="manual">Manual</option>
            </select>
            <Label>Ajuste manual (+/-)</Label>
            <input type="number" value={form.driverSettlement.adjustment} onChange={e => setSettlement('adjustment', e.target.value)} placeholder="0" style={inp} />

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
                    <a href={`tel:${route.driverId.phone}`} style={{ fontSize: 11, color: '#0052FF', fontWeight: 600, textDecoration: 'none', marginTop: 2, display: 'block' }}>
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
                  <a href={`https://wa.me/${route.clientCompany.contactPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola, te contacto desde MUVE 🚚')}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#0052FF', fontWeight: 600, display: 'block', marginTop: 1 }}>
                    💬 {route.clientCompany.contactPhone}
                  </a>
                )}
              </div>
            ) : <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Sin empresa cliente asignada</div>}

            {inv && inv.status !== 'none' && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: inv.status === 'paid' ? '#f4f7ff' : inv.status === 'overdue' ? '#fce4ec' : '#fff8e1' }}>
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

      {/* Driver settlement */}
      <div style={{ background: '#f8fafc', border: '1px solid #0077aa26', borderRadius: 13, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#0077aa', marginBottom: 4 }}>LIQUIDACION DRIVER</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Base ${driverBase.toLocaleString('es-CL')} · {delivered.length}/{active.length} entregados
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 20, padding: '4px 9px', color: '#0077aa', background: '#0077aa12', border: '1px solid #0077aa28' }}>
            {driverSettlement.status || 'pending'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '-4px 0 10px' }}>
          Neto ruta ${total.toLocaleString('es-CL')} · Oferta driver ${driverBase.toLocaleString('es-CL')} · {payable.length}/{active.length} pagables
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <MiniMoney label="Neto empresas" value={total} color="var(--text)" />
          <MiniMoney label="Oferta driver" value={driverBase} color="#0077aa" />
          <MiniMoney label="Valor por paquete" value={driverUnitValue} color="#64748b" />
          <MiniMoney label="Descuento no cumplidos" value={driverDiscount} color="var(--danger)" />
          <MiniMoney label="Ajuste manual" value={driverAdjustment} color={driverAdjustment < 0 ? 'var(--danger)' : '#f57c00'} />
          <MiniMoney label="Final sugerido" value={driverFinal} color="var(--accent)" />
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Regla actual: entregados e incidencias justificadas se pagan. Pendientes o incidencias sin motivo descuentan aprox. <strong>${driverUnitValue.toLocaleString('es-CL')}</strong>.
          <br />
          Pagables: <strong>{payable.length}</strong> · A revisar/descontar: <strong>{unpaidDriverPackages.length}</strong> · Marcados lejos: <strong>{active.filter(p => p.deliveryMeta?.onPoint === false).length}</strong> · Margen estimado empresa: <strong style={{ color: companyMargin < 0 ? 'var(--danger)' : 'var(--text)' }}>${companyMargin.toLocaleString('es-CL')}</strong>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => saveDriverSettlement({ status: 'calculated', approvedAmount: driverFinal })} style={actBtn('#0077aa')}>Calcular</button>
          <button onClick={() => saveDriverSettlement({ status: 'approved', approvedAmount: driverFinal })} style={actBtn('var(--accent)')}>Aprobar</button>
          <button onClick={() => saveDriverSettlement({ status: 'paid', approvedAmount: driverFinal })} style={actBtn('#16a34a')}>Marcar pagada</button>
          <button onClick={() => setEditingRoute(true)} style={actBtn('#f57c00')}>Editar regla</button>
        </div>
      </div>

      {/* Share link card */}
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 10 }}>🔗 ENLACE PARA EMPRESA</div>
        {shareUrl ? (
          <div>
            {/* Global link */}
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>TODA LA RUTA</div>
            <div style={{ background: '#f4f7ff', border: '1px solid #0052FF30', borderRadius: 10, padding: '9px 12px', marginBottom: 8, fontSize: 11, color: '#003BB5', wordBreak: 'break-all', fontFamily: 'monospace' }}>
              {shareUrl}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: routeCompanies.length > 1 ? 14 : 0 }}>
              <button onClick={copyShare} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📋 Copiar</button>
              <a href={shareUrl} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>👁 Ver</a>
              <button onClick={handleRevokeShare} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid #cc224430', background: 'none', color: '#cc2244', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🗑️</button>
            </div>

            {/* Per-company links — only shown when route has packages from multiple companies */}
            {routeCompanies.length > 1 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--muted)', marginBottom: 10 }}>POR EMPRESA</div>
                {routeCompanies.map(co => {
                  const url = `${shareUrl}?c=${co.id}`;
                  return (
                    <div key={co.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {co.name}
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 4 }}>({co.count} pkgs)</span>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(url); toast('📋 Copiado'); }}
                        style={{ padding: '5px 9px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                      >📋</button>
                      <a href={url} target="_blank" rel="noreferrer"
                        style={{ padding: '5px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 11, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                      >👁</a>
                    </div>
                  );
                })}

                {/* Multi-company selector */}
                <button
                  onClick={() => { setShowCompanyPicker(p => !p); setSelectedCos(new Set()); }}
                  style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 700 }}
                >
                  {showCompanyPicker ? '✕ Cancelar' : '⊕ Combinar empresas'}
                </button>

                {showCompanyPicker && (
                  <div style={{ marginTop: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                    {routeCompanies.map(co => (
                      <label key={co.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedCos.has(co.id)}
                          onChange={e => setSelectedCos(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(co.id); else next.delete(co.id);
                            return next;
                          })}
                        />
                        {co.name} <span style={{ color: 'var(--muted)', fontSize: 11 }}>({co.count})</span>
                      </label>
                    ))}
                    {selectedCos.size > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button
                          onClick={() => {
                            const url = `${shareUrl}?c=${[...selectedCos].join(',')}`;
                            navigator.clipboard.writeText(url);
                            toast('📋 Link combinado copiado');
                          }}
                          style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          📋 Copiar ({selectedCos.size} empresas)
                        </button>
                        <a
                          href={`${shareUrl}?c=${[...selectedCos].join(',')}`}
                          target="_blank" rel="noreferrer"
                          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                        >👁</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.4 }}>
              Genera un enlace para que la empresa vea el estado de la ruta en tiempo real sin necesidad de iniciar sesión.
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
        { title: 'ENTREGADOS', items: delivered, color: 'var(--accent)', border: '#0052FF28' },
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
                {p.deliveryMeta?.distanceMeters != null && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: p.deliveryMeta.onPoint === false ? 'var(--danger)' : 'var(--accent)', marginTop: 4 }}>
                    GPS: {p.deliveryMeta.onPoint === false ? 'Lejos del punto' : 'En punto'} - {Math.round(p.deliveryMeta.distanceMeters)}m
                  </div>
                )}
                {p.deliveryMeta?.payStatus && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: p.deliveryMeta.payStatus === 'rejected' ? 'var(--danger)' : 'var(--accent)', marginTop: 4 }}>
                    Pago: {p.deliveryMeta.payStatus === 'rejected' ? 'rechazado' : 'aprobado'}
                  </div>
                )}
                {p.status === 'no-entregado' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                    <button onClick={() => reviewPackagePay(p, 'approved')} style={actBtn('var(--accent)')}>Aprobar pago</button>
                    <button onClick={() => reviewPackagePay(p, 'rejected')} style={actBtn('var(--danger)')}>Rechazar pago</button>
                  </div>
                )}
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
        <div style={{ marginTop: 16, padding: '13px 14px', background: '#0052FF08', border: '1px solid #0052FF30', borderRadius: 13 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, letterSpacing: 1 }}>🔓 REABRIR RUTA</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Vuelve la ruta a estado "Activa" para poder editarla, agregar paquetes o corregir datos.
          </div>
          <button
            onClick={onReopen}
            style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid #0052FF50', background: '#0052FF12', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
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
const RESET_TARGETS = [
  { id: 'routes',    label: 'Rutas y paquetes',     desc: 'Elimina todas las rutas y sus paquetes' },
  { id: 'quotes',    label: 'Cotizaciones',          desc: 'Elimina todas las cotizaciones (flete/mensajería)' },
  { id: 'tariffs',   label: 'Tarifas',               desc: 'Elimina tarifas y sus ítems de precios' },
  { id: 'prices',    label: 'Precios por comuna',    desc: 'Elimina la configuración de precios por zona' },
  { id: 'zones',     label: 'Zonas geográficas',     desc: 'Elimina los polígonos de zonas' },
  { id: 'companies', label: 'Empresas / clientes',   desc: 'Elimina todos los registros de empresas' },
];

function ResetDataBtn({ onDone, wide = false }) {
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = React.useState({});
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const toggle = id => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const anyChecked = RESET_TARGETS.some(t => checked[t.id]);
  const canSubmit = anyChecked && confirm === 'CONFIRMAR' && !busy;

  const handleOpen = () => {
    setChecked({});
    setConfirm('');
    setOpen(true);
  };

  const handleReset = async () => {
    if (!canSubmit) return;
    const targets = RESET_TARGETS.filter(t => checked[t.id]).map(t => t.id);
    setBusy(true);
    try {
      const result = await api.resetAllData(targets);
      const d = result.deleted;
      const parts = [];
      if (d.routes)    parts.push(`${d.routes} rutas`);
      if (d.packages)  parts.push(`${d.packages} paquetes`);
      if (d.quotes)    parts.push(`${d.quotes} cotizaciones`);
      if (d.tariffs)   parts.push(`${d.tariffs} tarifas`);
      if (d.prices)    parts.push(`${d.prices} precios`);
      if (d.zones)     parts.push(`${d.zones} zonas`);
      if (d.companies) parts.push(`${d.companies} empresas`);
      toast(`🗑️ Eliminado: ${parts.join(', ') || 'nada'}`);
      setOpen(false);
      onDone?.();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        style={{ background: '#cc224408', border: '1px solid #cc224430', borderRadius: wide ? 12 : 8, padding: wide ? '11px 12px' : '4px 10px', fontSize: wide ? 13 : 11, fontWeight: wide ? 900 : 700, color: '#cc2244', cursor: 'pointer', width: wide ? '100%' : 'auto', textAlign: wide ? 'left' : 'center' }}
      >
        🗑️ Reset DB
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000070', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && !busy && setOpen(false)}
        >
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px #0006' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#cc2244' }}>Borrar datos</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Los usuarios NO se eliminan</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {RESET_TARGETS.map(t => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, border: `1px solid ${checked[t.id] ? '#cc224440' : 'var(--border)'}`, background: checked[t.id] ? '#cc224408' : 'var(--card2)', cursor: 'pointer', transition: 'all .15s' }}>
                  <input
                    type="checkbox"
                    checked={!!checked[t.id]}
                    onChange={() => toggle(t.id)}
                    style={{ marginTop: 2, accentColor: '#cc2244', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: checked[t.id] ? '#cc2244' : 'var(--text)' }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {anyChecked && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                  Escribe <strong style={{ color: '#cc2244' }}>CONFIRMAR</strong> para habilitar el botón
                </div>
                <input
                  autoFocus
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="CONFIRMAR"
                  style={{ ...inp, borderColor: confirm === 'CONFIRMAR' ? '#cc2244' : 'var(--border)', fontWeight: confirm === 'CONFIRMAR' ? 700 : 400 }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card2)', fontSize: 13, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={!canSubmit}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: canSubmit ? '#cc2244' : '#cc224430', color: canSubmit ? '#fff' : '#cc224480', fontSize: 13, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'all .15s' }}
              >
                {busy ? '⏳ Borrando…' : '🗑️ Borrar selección'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── DemoModeBtn: archivar/restaurar paquetes y rutas para dejar el sistema limpio en una demo ──
const DEMO_ARCHIVE_KEY = 'muve_demo_archive';

function DemoModeBtn({ onDone, wide = false }) {
  const [busy, setBusy] = useState(false);
  const [archived, setArchived] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DEMO_ARCHIVE_KEY) || 'null'); } catch { return null; }
  });

  const handleEnter = async () => {
    if (!window.confirm('Esto archivará TODOS los paquetes y rutas activos para que el sistema se vea limpio en la demo. Todo lo que crees DESPUÉS (durante la demo) se archivará automáticamente cuando salgas de modo demo, y tu entorno actual volverá intacto. ¿Continuar?')) return;
    setBusy(true);
    try {
      const routes = await api.getRoutes();
      const routesToArchive = routes.filter(r => r.status !== 'cancelled');
      const { ids: packageIds } = await api.demoArchivePackages();
      await Promise.all(routesToArchive.map(r => api.deleteRoute(r._id)));
      const snapshot = {
        packageIds,
        routes: routesToArchive.map(r => ({ id: r._id, status: r.status })),
        at: new Date().toISOString(),
      };
      localStorage.setItem(DEMO_ARCHIVE_KEY, JSON.stringify(snapshot));
      setArchived(snapshot);
      toast(`🎬 Modo demo activado: ${packageIds.length} paquetes y ${routesToArchive.length} rutas archivados`);
      onDone?.();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleExit = async () => {
    if (!archived) return;
    if (!window.confirm('Vas a salir de modo demo: todo lo que creaste durante la demo se va a archivar (oculto, no se pierde) y tu entorno de antes va a volver tal como estaba. ¿Continuar?')) return;
    setBusy(true);
    try {
      // Everything currently active is what got created DURING the demo (the pre-demo data is already archived).
      const routesNow = await api.getRoutes();
      const demoRouteIds = routesNow.filter(r => r.status !== 'cancelled').map(r => r._id);
      await api.demoArchivePackages();
      await Promise.all(demoRouteIds.map(id => api.deleteRoute(id)));

      // Bring back exactly what was archived on entry.
      await api.demoRestorePackages(archived.packageIds);
      await Promise.all(archived.routes.map(r => api.updateRoute(r.id, { status: r.status })));

      localStorage.removeItem(DEMO_ARCHIVE_KEY);
      setArchived(null);
      toast('🚪 Modo demo cerrado — tu entorno normal está de vuelta');
      onDone?.();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  if (archived) {
    return (
      <button
        onClick={handleExit}
        disabled={busy}
        style={{ background: '#0e749008', border: '1px solid #0e749030', borderRadius: wide ? 12 : 8, padding: wide ? '11px 12px' : '4px 10px', fontSize: wide ? 13 : 11, fontWeight: wide ? 900 : 700, color: '#0e7490', cursor: busy ? 'not-allowed' : 'pointer', width: wide ? '100%' : 'auto', textAlign: wide ? 'left' : 'center' }}
      >
        {busy ? '⏳ Cerrando modo demo…' : `🚪 Salir de modo demo (restaura ${archived.packageIds.length} paq. · ${archived.routes.length} rutas)`}
        {wide && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>Archiva lo que hiciste en la demo y trae de vuelta tu entorno normal</div>}
      </button>
    );
  }

  return (
    <button
      onClick={handleEnter}
      disabled={busy}
      style={{ background: '#7c3aed08', border: '1px solid #7c3aed30', borderRadius: wide ? 12 : 8, padding: wide ? '11px 12px' : '4px 10px', fontSize: wide ? 13 : 11, fontWeight: wide ? 900 : 700, color: '#7c3aed', cursor: busy ? 'not-allowed' : 'pointer', width: wide ? '100%' : 'auto', textAlign: wide ? 'left' : 'center' }}
    >
      {busy ? '⏳ Archivando…' : '🎬 Entrar a modo demo'}
      {wide && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>Oculta tus paquetes y rutas actuales para dejar el sistema limpio</div>}
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
