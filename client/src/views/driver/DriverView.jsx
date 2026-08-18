import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../api/index.js';
import { watchGeoPosition, clearGeoWatch, haversineMeters } from '../../utils/geo.js';
import { computeRouteEarnings } from '../../utils/driverEarnings.js';
import { SegmentedControl, FilterChipRow } from '../../components/driver-ui/index.js';
import Header from '../../components/Header.jsx';
import RouteMap from '../../components/RouteMap.jsx';
import PackageCard from '../../components/PackageCard.jsx';
import DeliveryModal from '../../components/DeliveryModal.jsx';
import Toast, { toast } from '../../components/Toast.jsx';

export default function DriverView({ routeId, onBack, onLogout, nativeApp = false }) {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [packages, setPackages] = useState([]);
  const [tab, setTab] = useState('m'); // m=map, l=list, r=report
  const [segment, setSegment] = useState('pending'); // 'pending' | 'delivered' — primary Lista split
  const [subFilter, setSubFilter] = useState('todos'); // status sub-filter, only used within 'delivered'
  const [search, setSearch] = useState('');
  const [editPkg, setEditPkg] = useState(null);
  const [showLoadCheck, setShowLoadCheck] = useState(false);
  const [nearbyLocation, setNearbyLocation] = useState(null);
  const [navMode, setNavMode] = useState(false);
  const [navSelected, setNavSelected] = useState(new Set());
  const [showNavModal, setShowNavModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // GPS tracking — uses native Capacitor GPS on Android, browser fallback on web
  const [myLocation, setMyLocation] = useState(null);
  const [gpsState, setGpsState] = useState('pending'); // 'pending' | 'active' | 'denied' | 'unavailable'
  const watchHandleRef = useRef(null);
  const lastSentRef    = useRef(0);

  useEffect(() => {
    if (routeId) {
      // Direct route load when coming from RoutePicker
      loadRoute(routeId).finally(() => setLoading(false));
    } else {
      api.getRoutes().then(r => {
        setRoutes(r);
        const active = r.find(x => x.status === 'active') || r[0];
        if (active) loadRoute(active._id);
      }).catch(e => toast('❌ ' + e.message)).finally(() => setLoading(false));
    }
  }, [routeId]);

  // Start GPS — native Capacitor on Android, browser fallback on web. Updates every 8s.
  useEffect(() => {
    let cancelled = false;
    watchGeoPosition(
      (pos) => {
        if (cancelled) return;
        const { latitude: lat, longitude: lng, accuracy, heading, speed } = pos.coords;
        setMyLocation({ lat, lng, accuracy, heading: heading ?? null, speed: speed ?? null });
        setGpsState('active');
        const now = Date.now();
        if (now - lastSentRef.current > 8000) {
          lastSentRef.current = now;
          api.updateDriverLocation({ lat, lng, accuracy, heading: heading ?? null, speed: speed ?? null }).catch(() => {});
        }
      },
      (err) => { if (!cancelled) setGpsState(err.code === 1 ? 'denied' : 'unavailable'); },
      // minimumUpdateInterval (Android/Capacitor-only, ignored elsewhere) tells the native
      // location provider not to sample faster than we actually send updates (see the 8s
      // throttle above) — saves battery at the source instead of just discarding samples
      // after the fact.
      { minimumUpdateInterval: 8000 }
    ).then(handle => {
      if (cancelled) { clearGeoWatch(handle); return; }
      watchHandleRef.current = handle;
    }).catch(() => { if (!cancelled) setGpsState('unavailable'); });

    return () => {
      cancelled = true;
      if (watchHandleRef.current) { clearGeoWatch(watchHandleRef.current); watchHandleRef.current = null; }
    };
  }, []);

  // Poll for admin-side changes every 15s while a route is open — the driver has
  // no other way to find out the admin reassigned/edited/added packages or updated
  // the payout mid-route (mirrors the polling AdminView already does for its own data).
  // Silent on failure: this runs continuously in the background, a toast per
  // transient network hiccup while driving would be more annoying than useful.
  const knownPkgIdsRef = useRef(null);
  useEffect(() => {
    knownPkgIdsRef.current = null;
    if (!selectedRoute?._id) return;
    const timer = setInterval(() => {
      api.getRoute(selectedRoute._id)
        .then(({ route, packages: fresh }) => {
          const freshIds = new Set(fresh.map(p => p._id));
          if (knownPkgIdsRef.current) {
            const added = fresh.filter(p => !knownPkgIdsRef.current.has(p._id));
            if (added.length) toast(`📦 ${added.length} paquete${added.length > 1 ? 's' : ''} nuevo${added.length > 1 ? 's' : ''} en tu ruta`);
          }
          knownPkgIdsRef.current = freshIds;
          setSelectedRoute(route);
          setPackages(fresh);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [selectedRoute?._id]);

  const loadRoute = async (id) => {
    try {
      const { route, packages } = await api.getRoute(id);
      setSelectedRoute(route);
      setPackages(packages);
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const handleModalSaved = async () => {
    try {
      const { route, packages: newPkgs } = await api.getRoute(selectedRoute._id);
      setSelectedRoute(route);
      setPackages(newPkgs);
      if (route.status === 'active') {
        const activePkgs = newPkgs.filter(p => p.status !== 'eliminado');
        const stillPending = activePkgs.some(p => p.status === 'pendiente');
        if (!stillPending && activePkgs.length > 0) {
          await api.updateRoute(selectedRoute._id, { status: 'paused' });
          setSelectedRoute(prev => ({ ...prev, status: 'paused' }));
          toast('⏸ Ruta en revisión — el admin revisará los resultados');
        }
      }
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const handleStatusChange = async (pkg, newStatus) => {
    try {
      const updated = await api.updatePackage(pkg._id, { status: newStatus });
      const nextPackages = packages.map(p => p._id === pkg._id ? { ...p, ...updated } : p);
      setPackages(nextPackages);
      const msgs = { entregado: '✅ Entregado', 'no-entregado': '❌ No entregado', devuelto: '📦 Marcado para devolución', pendiente: '↩ Deshecho' };
      toast(msgs[newStatus] || '↩ Actualizado');

      // Auto-pausar ruta cuando no quedan paquetes pendientes
      if (selectedRoute?.status === 'active') {
        const active = nextPackages.filter(p => p.status !== 'eliminado');
        const stillPending = active.some(p => p.status === 'pendiente');
        if (!stillPending && active.length > 0) {
          await api.updateRoute(selectedRoute._id, { status: 'paused' });
          setSelectedRoute(prev => ({ ...prev, status: 'paused' }));
          toast('⏸ Ruta en revisión — el admin revisará los resultados');
        }
      }
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  // Memoized: these all derive from `packages`/filters, never from myLocation/gpsState —
  // without this, every GPS tick (every few seconds while driving) re-ran a full filter +
  // Unicode-normalize pass over the whole package list, which is real jank on a low-end phone.
  const active = useMemo(() => packages.filter(p => p.status !== 'eliminado'), [packages]);
  const pendingCount = useMemo(() => active.filter(p => p.status === 'pendiente').length, [active]);
  const deliveredCount = active.length - pendingCount;

  const visible = useMemo(() => packages.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || [p.customerName, p.customerLastName, p.address, p.commune, p.customerPhone].join(' ').toLowerCase().includes(q);
    const matchSegment = segment === 'pending' ? p.status === 'pendiente' : p.status !== 'pendiente' && p.status !== 'eliminado';
    const matchSubFilter = segment !== 'delivered' || subFilter === 'todos' || p.status === subFilter;
    return matchQ && matchSegment && matchSubFilter;
  }), [packages, search, segment, subFilter]);

  const pay = useMemo(() => computeRouteEarnings(selectedRoute, active), [selectedRoute, active]);

  const addrCountMap = useMemo(() => {
    const map = {};
    active.forEach(p => {
      const key = (p.address || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [active]);

  const stats = useMemo(() => [
    { label: 'Total', value: active.length },
    { label: 'Entregadas', value: packages.filter(p => p.status === 'entregado').length, color: 'var(--accent)' },
    { label: 'No entregadas', value: packages.filter(p => p.status === 'no-entregado').length, color: 'var(--danger)' },
    { label: 'Pendientes', value: packages.filter(p => p.status === 'pendiente').length },
    ...(packages.filter(p => p.status === 'devuelto').length > 0
      ? [{ label: 'Devueltos', value: packages.filter(p => p.status === 'devuelto').length, color: 'var(--devuelto)' }]
      : []),
    ...(pay.base > 0
      ? [{ label: pay.isFinal ? 'Pago final' : 'Pago estimado', value: '$' + pay.earned.toLocaleString('es-CL'), color: 'var(--accent)' }]
      : [])
  ], [active, packages, pay]);

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
      Cargando ruta…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title={selectedRoute ? `🚗 ${selectedRoute.routeCode}` : '🚚 MUVE'}
        stats={selectedRoute ? stats : null}
        onBack={onBack}
      />

      {/* GPS status indicator */}
      {gpsState === 'denied' && (
        <div style={{ background: 'var(--warn-dim)', borderBottom: '1px solid var(--warn-dim)', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>📍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn)' }}>Ubicación desactivada</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Activa la ubicación en tu navegador para aparecer en el mapa del admin</div>
          </div>
        </div>
      )}
      {gpsState === 'active' && myLocation && (
        <div style={{ background: 'var(--card2)', borderBottom: '1px solid var(--accent-dim)', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 13 }}>📡</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
            GPS activo · precisión {myLocation.accuracy ? `±${Math.round(myLocation.accuracy)}m` : '…'}
          </span>
        </div>
      )}

      {/* Ruta pausada/en revisión banner */}
      {selectedRoute?.status === 'paused' && (
        <div style={{ background: 'var(--warn-dim)', borderBottom: '1px solid var(--warn-dim)', padding: '10px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⏸</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--warn)' }}>Ruta en revisión</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Todos los paquetes procesados. El admin revisará y cerrará la ruta.</div>
          </div>
        </div>
      )}
      {/* Ruta finalizada banner */}
      {selectedRoute?.status === 'completed' && (
        <div style={{ background: 'var(--info-dim)', borderBottom: '1px solid var(--info-dim)', padding: '10px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--info)' }}>Ruta finalizada</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>El administrador cerró esta ruta. No puedes hacer más cambios.</div>
          </div>
        </div>
      )}

      {/* Route summary banner */}
      {selectedRoute && selectedRoute.status !== 'completed' && (
        <div style={{ background: 'linear-gradient(90deg, #0052FF08, #0052FF14)', borderBottom: '1px solid #0052FF22', padding: '7px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 15 }}>📦</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{active.length}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>paquetes</span>
          </div>
          {selectedRoute.distanceKm && (
            <>
              <span style={{ color: 'var(--border)', fontSize: 14 }}>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 15 }}>🗺</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{selectedRoute.distanceKm} km</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>estimados</span>
              </div>
            </>
          )}
          {selectedRoute.startPoint?.address && (
            <>
              <span style={{ color: 'var(--border)', fontSize: 14 }}>·</span>
              <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                📍 {selectedRoute.startPoint.address}
              </div>
            </>
          )}
        </div>
      )}

      {selectedRoute && pay.base > 0 && (
        <div style={{ background: '#f4f7ff', borderBottom: '1px solid #0052FF20', padding: '9px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 800 }}>
                {pay.isFinal ? 'Pago final de ruta' : 'Pago estimado de ruta'}
              </div>
              <div style={{ fontSize: 19, color: 'var(--accent)', fontWeight: 900, marginTop: 1 }}>
                ${pay.earned.toLocaleString('es-CL')}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--text)' }}>{pay.payable}/{pay.total}</strong> pagables<br />
              Base ${pay.base.toLocaleString('es-CL')}
              {pay.adjustment !== 0 && <> · Ajuste {pay.adjustment > 0 ? '+' : ''}${pay.adjustment.toLocaleString('es-CL')}</>}
            </div>
          </div>
        </div>
      )}

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
          width: active.length ? `${(active.filter(p => p.status !== 'pendiente').length / active.length * 100) || 0}%` : '0%',
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

      {/* Segment + search (list tab) */}
      {tab === 'l' && (
        <div style={{ padding: '8px 10px 4px', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <SegmentedControl
            value={segment}
            onChange={s => { setSegment(s); setSubFilter('todos'); setNavMode(false); setNavSelected(new Set()); }}
            options={[
              { value: 'pending', label: '⏳ Por entregar', count: pendingCount },
              { value: 'delivered', label: '✅ Entregados', count: deliveredCount },
            ]}
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar por nombre, dirección, comuna…"
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 22, padding: '8px 14px', fontSize: 14, outline: 'none', marginTop: 8 }}
          />
          {segment === 'delivered' && (
            <div style={{ marginTop: 7 }}>
              <FilterChipRow
                value={subFilter}
                onChange={setSubFilter}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'entregado', label: '✅ Entregados', color: 'var(--accent)' },
                  { value: 'no-entregado', label: '❌ No entregados', color: 'var(--danger)' },
                  { value: 'devuelto', label: '📦 Devueltos', color: 'var(--devuelto)' },
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Map */}
        <div style={{ display: tab === 'm' ? 'block' : 'none', height: '100%', position: 'relative' }}>
          <RouteMap
            packages={packages}
            onPkgClick={setEditPkg}
            startPoint={selectedRoute?.startPoint}
            onVerifyLoad={() => setShowLoadCheck(true)}
            onNearbyRequest={loc => setNearbyLocation(loc)}
            visible={tab === 'm'}
            myLocation={myLocation}
          />
          {/* Google Maps multi-stop button — bottom left so it doesn't overlap map buttons */}
          {active.filter(p => p.status === 'pendiente' && p.lat && p.lng).length > 0 && (
            <button
              onClick={() => {
                const url = buildMapsUrl(active.filter(p => p.status === 'pendiente'), myLocation, 'gmaps');
                if (url) window.open(url, '_blank');
              }}
              style={{
                position: 'absolute', bottom: 22, left: 12, zIndex: 10,
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#fff', border: '1.5px solid #0052FF40',
                borderRadius: 22, padding: '9px 14px',
                boxShadow: '0 3px 10px rgba(0,0,0,.18)',
                fontSize: 12, fontWeight: 800, color: '#0052FF', cursor: 'pointer',
              }}
            >
              🗺 Abrir ruta en Maps
            </button>
          )}
        </div>

        {/* List — with nav-select mode */}
        {tab === 'l' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Nav mode toolbar */}
            <div style={{ background: navMode ? '#0052FF' : '#fff', borderBottom: '1px solid var(--border)', padding: '8px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {navMode ? (
                <>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    {navSelected.size > 0 ? `${navSelected.size} seleccionados` : 'Toca para seleccionar'}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {navSelected.size > 0 && (
                      <button onClick={() => setShowNavModal(true)} style={{ background: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 800, color: '#0052FF', cursor: 'pointer' }}>
                        🧭 Navegar ({navSelected.size})
                      </button>
                    )}
                    <button onClick={() => { setNavMode(false); setNavSelected(new Set()); }} style={{ background: 'rgba(255,255,255,.25)', border: 'none', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                    {visible.length} paquete{visible.length !== 1 ? 's' : ''}
                  </span>
                  {segment === 'pending' && (
                    <button onClick={() => setNavMode(true)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 20, padding: '6px 13px', fontSize: 12, fontWeight: 800, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      🧭 Seleccionar paradas
                    </button>
                  )}
                </>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
              {visible.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>🔍 Sin resultados</div>
              ) : (
                visible.map((pkg, i) => (
                  <div key={pkg._id} style={{ position: 'relative' }} onClick={navMode ? () => {
                    setNavSelected(prev => {
                      const next = new Set(prev);
                      if (next.has(pkg._id)) next.delete(pkg._id); else next.add(pkg._id);
                      return next;
                    });
                  } : undefined}>
                    {navMode && (
                      <div style={{
                        position: 'absolute', top: 10, left: 10, zIndex: 5,
                        width: 24, height: 24, borderRadius: '50%',
                        background: navSelected.has(pkg._id) ? '#0052FF' : '#fff',
                        border: `2.5px solid ${navSelected.has(pkg._id) ? '#0052FF' : '#ccc'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                      }}>
                        {navSelected.has(pkg._id) && <span style={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>✓</span>}
                      </div>
                    )}
                    <div style={{ opacity: navMode && !navSelected.has(pkg._id) ? 0.6 : 1, pointerEvents: navMode ? 'none' : 'auto' }}>
                      <PackageCard
                        pkg={pkg}
                        index={i}
                        onEdit={setEditPkg}
                        onStatusChange={handleStatusChange}
                        lockDelivered
                        readOnly={['completed', 'paused'].includes(selectedRoute?.status)}
                        sameAddressCount={addrCountMap[(pkg.address || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')] || 1}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Report */}
        {tab === 'r' && <DriverReport packages={packages} route={selectedRoute} />}
      </div>

      {editPkg && (
        <DeliveryModal
          pkg={editPkg}
          route={selectedRoute}
          readOnly={
            ['completed', 'paused'].includes(selectedRoute?.status) ||
            editPkg.status === 'entregado' ||
            editPkg.status === 'no-entregado'
          }
          onClose={() => setEditPkg(null)}
          onSaved={handleModalSaved}
        />
      )}

      {/* Navigation modal */}
      {showNavModal && (
        <NavModal
          packages={active.filter(p => navSelected.has(p._id))}
          myLocation={myLocation}
          onClose={() => setShowNavModal(false)}
        />
      )}

      {nearbyLocation && (
        <NearbyModal
          location={nearbyLocation}
          packages={packages}
          onClose={() => setNearbyLocation(null)}
          onSelect={pkg => { setNearbyLocation(null); setEditPkg(pkg); }}
        />
      )}

      {showLoadCheck && (
        <LoadCheckModal
          packages={packages}
          onClose={() => setShowLoadCheck(false)}
          onUpdated={() => loadRoute(selectedRoute._id)}
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
  const returned = active.filter(p => p.status === 'devuelto');
  const pending = active.filter(p => p.status === 'pendiente');
  const pay = computeRouteEarnings(route, active);

  return (
    <div style={{ padding: '14px 10px calc(50px + env(safe-area-inset-bottom))', overflowY: 'auto', height: '100%' }}>
      {pay.base > 0 && (
        <div style={{ background: 'var(--card2)', border: '1px solid var(--accent-dim)', borderRadius: 13, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: 'var(--accent)', marginBottom: 8 }}>
            {pay.isFinal ? 'PAGO FINAL' : 'PAGO ESTIMADO'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)' }}>${pay.earned.toLocaleString('es-CL')}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                Base ${pay.base.toLocaleString('es-CL')} · {pay.payable}/{pay.total} pagables
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: pay.status === 'paid' ? 'var(--success)' : 'var(--muted)', textTransform: 'uppercase' }}>
              {pay.status}
            </div>
          </div>
          {!pay.isFinal && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.35 }}>
              Este monto puede cambiar hasta que el admin cierre y apruebe la liquidacion.
            </div>
          )}
        </div>
      )}
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 14 }}>
        {[
          ['Total paradas', active.length],
          ['Entregados', delivered.length],
          ['No entregados', failed.length],
          ...(returned.length > 0 ? [['Devueltos', returned.length]] : []),
          ['Pendientes', pending.length],
          ...(pay.base > 0 ? [[pay.isFinal ? 'Pago final' : 'Pago estimado', '$' + pay.earned.toLocaleString('es-CL')]] : [])
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
            <span>{label}</span>
            <span style={{ color: label === 'Devueltos' ? 'var(--devuelto)' : 'var(--accent)', fontWeight: 700 }}>{val}</span>
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

      {returned.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'var(--devuelto)', padding: '14px 0 7px', textTransform: 'uppercase' }}>
            DEVUELTOS ({returned.length})
          </div>
          {returned.map(p => <ReportCard key={p._id} pkg={p} type="devuelto" />)}
        </>
      )}
    </div>
  );
}

function ReportCard({ pkg, type }) {
  const color = type === 'entregado' ? 'var(--accent)' : type === 'devuelto' ? 'var(--devuelto)' : 'var(--danger)';
  const borderColor = type === 'entregado' ? 'var(--accent-dim)' : type === 'devuelto' ? 'var(--devuelto-dim)' : 'var(--danger-dim)';
  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${borderColor}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{pkg.customerName} {pkg.customerLastName}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{pkg.address}{pkg.commune ? `, ${pkg.commune}` : ''}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 5 }}>
        {pkg.deliveredAt && new Date(pkg.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
      </div>
      {pkg.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>📝 {pkg.note}</div>}
      {pkg.failReason && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>↳ {pkg.failReason}</div>}
      {pkg.photoUrl && (
        <img src={pkg.photoUrl} alt="foto" style={{ width: '100%', borderRadius: 9, maxHeight: 130, objectFit: 'cover', marginTop: 8, cursor: 'pointer' }} onClick={() => window.open(pkg.photoUrl, '_blank')} />
      )}
    </div>
  );
}

function LoadCheckModal({ packages, onClose, onUpdated }) {
  const active = packages.filter(p => p.status !== 'eliminado');
  // state: null = unchecked, 'ok' = tengo, 'missing' = falta
  const [state, setState] = React.useState({});
  const [reasons, setReasons] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  const setpState = (id, val) => setState(s => ({ ...s, [id]: val }));
  const setReason = (id, val) => setReasons(r => ({ ...r, [id]: val }));

  const okCount = active.filter(p => state[p._id] === 'ok').length;
  const missingCount = active.filter(p => state[p._id] === 'missing').length;
  const checkedCount = okCount + missingCount;
  const allChecked = checkedCount === active.length;
  const missing = active.filter(p => state[p._id] === 'missing');

  const handleConfirm = async () => {
    if (!allChecked) return;
    setSaving(true);
    try {
      // Mark each missing package as 'eliminado' with reason
      await Promise.all(missing.map(pkg =>
        api.updatePackage(pkg._id, {
          status: 'eliminado',
          note: reasons[pkg._id] ? `No entregado por bodega: ${reasons[pkg._id]}` : 'No entregado por bodega'
        })
      ));
      onUpdated?.();
      onClose();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 950, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '93dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 30px #00000022' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 700 }}>📦 Verificar carga en bodega</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
            Confirma qué paquetes te entregaron antes de salir
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: 10, height: 5, background: 'var(--border)', borderRadius: 3 }}>
            <div style={{
              height: 5, borderRadius: 3,
              background: allChecked ? (missingCount > 0 ? '#f57c00' : 'var(--accent)') : 'linear-gradient(90deg, var(--accent), var(--a2))',
              width: active.length ? `${(checkedCount / active.length) * 100}%` : '0%',
              transition: 'width .3s'
            }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 5, color: allChecked ? (missingCount > 0 ? '#f57c00' : 'var(--accent)') : 'var(--muted)' }}>
            {allChecked
              ? missingCount > 0 ? `⚠ ${missingCount} faltante${missingCount > 1 ? 's' : ''} · ${okCount} confirmados`
              : '✓ Todos confirmados'
              : `${checkedCount} de ${active.length} revisados`}
          </div>
        </div>

        {/* Package list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
          {active.map((pkg, i) => {
            const st = state[pkg._id];
            return (
              <div key={pkg._id} style={{
                borderRadius: 13, marginBottom: 8, overflow: 'hidden',
                border: `1px solid ${st === 'ok' ? '#0052FF30' : st === 'missing' ? '#cc224430' : 'var(--border)'}`,
                background: st === 'ok' ? '#edfff5' : st === 'missing' ? '#fff0f3' : '#fff',
                transition: 'all .15s'
              }}>
                {/* Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: st ? 14 : 11, fontWeight: 700,
                    background: st === 'ok' ? 'var(--accent)' : st === 'missing' ? 'var(--danger)' : 'var(--card2)',
                    color: st ? '#fff' : 'var(--muted)',
                    border: `2px solid ${st === 'ok' ? 'var(--accent)' : st === 'missing' ? 'var(--danger)' : 'var(--border)'}`
                  }}>
                    {st === 'ok' ? '✓' : st === 'missing' ? '✗' : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: st === 'ok' ? 'var(--accent)' : st === 'missing' ? 'var(--danger)' : 'var(--text)' }}>
                      {pkg.customerName} {pkg.customerLastName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pkg.address}{pkg.commune ? `, ${pkg.commune}` : ''}
                    </div>
                  </div>
                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button
                      onClick={() => setpState(pkg._id, st === 'ok' ? null : 'ok')}
                      style={{ padding: '6px 11px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: st === 'ok' ? 'var(--accent)' : '#0052FF14', color: st === 'ok' ? '#fff' : 'var(--accent)' }}
                    >✓ Tengo</button>
                    <button
                      onClick={() => setpState(pkg._id, st === 'missing' ? null : 'missing')}
                      style={{ padding: '6px 11px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: st === 'missing' ? 'var(--danger)' : '#cc224414', color: st === 'missing' ? '#fff' : 'var(--danger)' }}
                    >✗ Falta</button>
                  </div>
                </div>
                {/* Missing reason */}
                {st === 'missing' && (
                  <div style={{ padding: '0 12px 10px' }}>
                    <input
                      value={reasons[pkg._id] || ''}
                      onChange={e => setReason(pkg._id, e.target.value)}
                      placeholder="¿Qué pasó? (ej: no lo encontraron, error de código…)"
                      style={{ width: '100%', background: '#fff0f3', border: '1px solid #cc224430', borderRadius: 9, padding: '8px 12px', fontSize: 12, outline: 'none', boxSizing: 'border-box', color: 'var(--danger)' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px calc(20px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={handleConfirm}
            disabled={!allChecked || saving}
            style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700,
              cursor: allChecked && !saving ? 'pointer' : 'not-allowed',
              background: !allChecked ? 'var(--card2)' : missingCount > 0 ? '#f57c00' : 'var(--accent)',
              color: allChecked ? '#fff' : 'var(--muted)',
              transition: 'background .2s'
            }}
          >
            {saving ? 'Guardando…'
              : !allChecked ? `Faltan ${active.length - checkedCount} por revisar`
              : missingCount > 0 ? `🚗 Salir sin ${missingCount} paquete${missingCount > 1 ? 's' : ''}`
              : '🚗 ¡Todo a bordo! Iniciar ruta'}
          </button>
          <button onClick={onClose} style={{ width: '100%', padding: 11, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}


// Thin adapter over the shared point-based haversineMeters() — kept as a 4-arg
// function since every call site below already uses this signature.
function haversine(lat1, lng1, lat2, lng2) {
  return haversineMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
}
function fmtDist(m){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1)} km`;}

// ── NearbyModal ────────────────────────────────────────────────────────────
function NearbyModal({location,packages,onClose,onSelect}){
  const nearby=packages
    .filter(p=>p.status==='pendiente'&&p.lat&&p.lng)
    .map(p=>({...p,dist:haversine(location.lat,location.lng,p.lat,p.lng)}))
    .filter(p=>p.dist<=2000)
    .sort((a,b)=>a.dist-b.dist);

  const colDist=m=>m<300?'#0052FF':m<800?'#0077aa':'#64748b';

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:960,display:'flex',alignItems:'flex-end'}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:'20px 20px 0 0',width:'100%',maxHeight:'80dvh',display:'flex',flexDirection:'column',boxShadow:'0 -4px 30px rgba(0,0,0,.2)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'14px 16px 10px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{width:38,height:4,background:'var(--border)',borderRadius:2,margin:'0 auto 12px'}}/>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:16,fontWeight:800}}>🎯 Cerca de ti</div>
              <div style={{fontSize:12,color:'#64748b',marginTop:2}}>Pendientes en radio de 2 km</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,fontWeight:700,color:nearby.length>0?'#0052FF':'#94a3b8',background:nearby.length>0?'#eff6ff':'#f1f5f9',padding:'4px 10px',borderRadius:20}}>{nearby.length} encontrados</span>
              <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'#94a3b8',cursor:'pointer',lineHeight:1}}>x</button>
            </div>
          </div>
          {location.accuracy&&<div style={{fontSize:11,color:'#94a3b8',marginTop:6}}>GPS: ±{Math.round(location.accuracy)} m</div>}
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'8px 12px',WebkitOverflowScrolling:'touch'}}>
          {nearby.length===0?(
            <div style={{textAlign:'center',padding:'40px 20px',color:'#94a3b8'}}>
              <div style={{fontSize:40,marginBottom:10}}>📭</div>
              <div style={{fontSize:14,fontWeight:700,color:'#64748b'}}>Sin pendientes cerca</div>
              <div style={{fontSize:12,marginTop:4}}>No hay paquetes pendientes en 2 km</div>
            </div>
          ):nearby.map((pkg,i)=>(
            <div key={pkg._id} onClick={()=>onSelect(pkg)}
              style={{display:'flex',alignItems:'center',gap:12,background:'#fff',borderRadius:14,marginBottom:8,padding:'12px 14px',border:`1.5px solid ${pkg.dist<300?'#0052FF30':'#e2e8f0'}`,cursor:'pointer',WebkitTapHighlightColor:'transparent'}}>
              <div style={{flexShrink:0,minWidth:58,textAlign:'center',background:colDist(pkg.dist),color:'#fff',borderRadius:10,padding:'7px 4px'}}>
                <div style={{fontSize:13,fontWeight:900,lineHeight:1}}>{fmtDist(pkg.dist)}</div>
                {i===0&&<div style={{fontSize:9,marginTop:2,opacity:.8}}>MAS CERCA</div>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{pkg.customerName} {pkg.customerLastName||''}</div>
                <div style={{fontSize:12,color:'#64748b',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>📍 {pkg.address}{pkg.commune?', '+pkg.commune:''}</div>
                {pkg.aptFloor&&<div style={{fontSize:11,color:'#d4650a',fontWeight:700,marginTop:1}}>🚪 {pkg.aptFloor}</div>}
                {pkg.customerPhone&&<div style={{fontSize:11,color:'#64748b',marginTop:1}}>📞 {pkg.customerPhone}</div>}
              </div>
              <div style={{color:'#0052FF',fontSize:22,flexShrink:0}}>›</div>
            </div>
          ))}
          <div style={{height:16}}/>
        </div>
      </div>
    </div>
  );
}

// ── Navigation helpers ────────────────────────────────────────────────────
function buildMapsUrl(packages, myLocation, app = 'gmaps') {
  const withCoords = packages
    .filter(p => p.lat && p.lng)
    .sort((a, b) => {
      // Sort nearest-first when GPS is available, otherwise use stop order
      if (myLocation?.lat) {
        const da = haversine(myLocation.lat, myLocation.lng, a.lat, a.lng);
        const db = haversine(myLocation.lat, myLocation.lng, b.lat, b.lng);
        return da - db;
      }
      return (a.order ?? 99) - (b.order ?? 99);
    });

  if (withCoords.length === 0) return null;

  if (app === 'waze') {
    // Waze only supports single destination — open the closest one
    const p = withCoords[0];
    return `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
  }

  // Google Maps — supports origin + up to 9 waypoints + destination
  const MAX = 9;
  const stops = withCoords.slice(0, MAX + 1);
  const dest  = stops[stops.length - 1];
  const wps   = stops.slice(0, -1);

  let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving`;
  if (myLocation?.lat) url += `&origin=${myLocation.lat},${myLocation.lng}`;
  url += `&destination=${dest.lat},${dest.lng}`;
  if (wps.length > 0) {
    url += `&waypoints=${encodeURIComponent(wps.map(p => `${p.lat},${p.lng}`).join('|'))}`;
  }
  return url;
}

// ── Navigation modal ──────────────────────────────────────────────────────
function NavModal({ packages, myLocation, onClose }) {
  const sorted = [...packages]
    .filter(p => p.lat && p.lng)
    .sort((a, b) => {
      if (myLocation?.lat) {
        return haversine(myLocation.lat, myLocation.lng, a.lat, a.lng)
             - haversine(myLocation.lat, myLocation.lng, b.lat, b.lng);
      }
      return (a.order ?? 99) - (b.order ?? 99);
    });

  const wazeIdx = { current: 0 };
  const [wazeStep, setWazeStep] = React.useState(0);

  const openGmaps = () => {
    const url = buildMapsUrl(sorted, myLocation, 'gmaps');
    if (url) window.open(url, '_blank');
    onClose();
  };

  const openWaze = (idx) => {
    const p = sorted[idx];
    if (!p) return;
    window.open(`https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`, '_blank');
    if (idx + 1 < sorted.length) setWazeStep(idx + 1);
    else onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 970, display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', boxShadow: '0 -4px 30px rgba(0,0,0,.2)' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 14px' }} />
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>🧭 Navegar a {sorted.length} parada{sorted.length !== 1 ? 's' : ''}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Ordenadas de más cercana a más lejana</div>
        </div>

        {/* Stop list preview */}
        <div style={{ maxHeight: '35vh', overflowY: 'auto', padding: '8px 14px' }}>
          {sorted.map((p, i) => (
            <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: i === wazeStep && wazeStep > 0 ? '#f57c00' : '#0052FF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.customerName} {p.customerLastName || ''}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.address}{p.commune ? ', ' + p.commune : ''}
                </div>
              </div>
              {myLocation?.lat && (
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, flexShrink: 0 }}>
                  {fmtDist(haversine(myLocation.lat, myLocation.lng, p.lat, p.lng))}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ padding: '14px 16px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Google Maps — all stops */}
          <button onClick={openGmaps} style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(90deg,#0052FF,#0070FF)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🗺</span>
            Abrir todas en Google Maps
            {sorted.length > 9 && <span style={{ fontSize: 11, opacity: .8 }}>(9 max)</span>}
          </button>

          {/* Waze — sequential */}
          <button onClick={() => openWaze(wazeStep)} style={{ width: '100%', padding: '14px', borderRadius: 14, border: '2px solid #33ccff40', background: '#e8f4ff', color: '#005fcc', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🔵</span>
            {wazeStep === 0
              ? `Waze → parada más cercana`
              : `Waze → parada ${wazeStep + 1} (siguiente)`}
          </button>

          {wazeStep > 0 && (
            <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b' }}>
              Waze: {wazeStep}/{sorted.length} completadas · abre una parada a la vez
            </div>
          )}
        </div>
      </div>
    </div>
  );
}