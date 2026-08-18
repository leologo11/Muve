import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../api/index.js';
import { formatCLP as fmt } from '../../utils/format.js';
import { openPrintWindow } from '../../utils/printWindow.js';
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
import AdminMainMenu from './AdminMainMenu.jsx';
import RouteCard from './RouteCard.jsx';
import AdminReport from './AdminReport.jsx';
import ZonesView from './ZonesView.jsx';

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

  // Poll for package status changes made by the driver every 15s while viewing an
  // active/paused route — otherwise the only "live" thing was the GPS dot; the package
  // list, counts and stats stayed frozen at whatever they were when the route was opened.
  const knownPkgStatusRef = useRef(null);
  useEffect(() => {
    knownPkgStatusRef.current = null;
    if (!selectedRoute?._id || !['active', 'paused'].includes(selectedRoute.status)) return;
    const timer = setInterval(() => {
      api.getRoute(selectedRoute._id)
        .then(({ route, packages: fresh }) => {
          const prevStatus = knownPkgStatusRef.current;
          if (prevStatus) {
            const changed = fresh.filter(p => prevStatus.get(p._id) === 'pendiente' && p.status !== 'pendiente');
            if (changed.length) {
              toast(`🚚 ${changed.length} paquete${changed.length > 1 ? 's' : ''} actualizado${changed.length > 1 ? 's' : ''} por el conductor`);
            }
          }
          knownPkgStatusRef.current = new Map(fresh.map(p => [p._id, p.status]));
          setSelectedRoute(route);
          setPackages(fresh);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [selectedRoute?._id, selectedRoute?.status]);

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
