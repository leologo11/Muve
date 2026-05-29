import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/index.js';
import { watchGeoPosition, clearGeoWatch } from '../../utils/geo.js';
import Header from '../../components/Header.jsx';
import RouteMap from '../../components/RouteMap.jsx';
import PackageCard from '../../components/PackageCard.jsx';
import DeliveryModal from '../../components/DeliveryModal.jsx';
import Toast, { toast } from '../../components/Toast.jsx';

export default function DriverView({ onLogout, nativeApp = false }) {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [packages, setPackages] = useState([]);
  const [tab, setTab] = useState('m'); // m=map, l=list, r=report
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [editPkg, setEditPkg] = useState(null);
  const [showLoadCheck, setShowLoadCheck] = useState(false);
  const [loading, setLoading] = useState(true);

  // GPS tracking — uses native Capacitor GPS on Android, browser fallback on web
  const [myLocation, setMyLocation] = useState(null);
  const [gpsState, setGpsState] = useState('pending'); // 'pending' | 'active' | 'denied' | 'unavailable'
  const watchHandleRef = useRef(null);
  const lastSentRef    = useRef(0);

  useEffect(() => {
    api.getRoutes().then(r => {
      setRoutes(r);
      const active = r.find(x => x.status === 'active') || r[0];
      if (active) loadRoute(active._id);
    }).catch(e => toast('❌ ' + e.message)).finally(() => setLoading(false));
  }, []);

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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 }
    ).then(handle => {
      if (cancelled) { clearGeoWatch(handle); return; }
      watchHandleRef.current = handle;
    }).catch(() => { if (!cancelled) setGpsState('unavailable'); });

    return () => {
      cancelled = true;
      if (watchHandleRef.current) { clearGeoWatch(watchHandleRef.current); watchHandleRef.current = null; }
    };
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

  const visible = packages.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || [p.customerName, p.customerLastName, p.address, p.commune, p.customerPhone].join(' ').toLowerCase().includes(q);
    const matchF = filter === 'todos' || p.status === filter;
    return matchQ && matchF;
  });

  const active = packages.filter(p => p.status !== 'eliminado');
  const pay = calcDriverPay(selectedRoute, active);

  const addrCountMap = (() => {
    const map = {};
    active.forEach(p => {
      const key = (p.address || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return map;
  })();

  const stats = [
    { label: 'Total', value: active.length },
    { label: 'Entregadas', value: packages.filter(p => p.status === 'entregado').length, color: 'var(--accent)' },
    { label: 'No entregadas', value: packages.filter(p => p.status === 'no-entregado').length, color: 'var(--danger)' },
    { label: 'Pendientes', value: packages.filter(p => p.status === 'pendiente').length },
    ...(packages.filter(p => p.status === 'devuelto').length > 0
      ? [{ label: 'Devueltos', value: packages.filter(p => p.status === 'devuelto').length, color: '#7b1fa2' }]
      : []),
    ...(pay.base > 0
      ? [{ label: pay.isFinal ? 'Pago final' : 'Pago estimado', value: '$' + pay.final.toLocaleString('es-CL'), color: 'var(--accent)' }]
      : [])
  ];

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
      />

      {/* Native app top bar with logout */}
      {nativeApp && (
        <div style={{ background: '#0052FF', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>🚗 MUVE Driver</div>
          <button
            onClick={onLogout}
            style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 20, padding: '6px 13px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Cerrar sesión
          </button>
        </div>
      )}

      {/* GPS status indicator */}
      {gpsState === 'denied' && (
        <div style={{ background: '#fff3e0', borderBottom: '1px solid #f57c0030', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>📍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e65100' }}>Ubicación desactivada</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Activa la ubicación en tu navegador para aparecer en el mapa del admin</div>
          </div>
        </div>
      )}
      {gpsState === 'active' && myLocation && (
        <div style={{ background: '#f4f7ff', borderBottom: '1px solid #0052FF20', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 13 }}>📡</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
            GPS activo · precisión {myLocation.accuracy ? `±${Math.round(myLocation.accuracy)}m` : '…'}
          </span>
        </div>
      )}

      {/* Ruta pausada/en revisión banner */}
      {selectedRoute?.status === 'paused' && (
        <div style={{ background: 'linear-gradient(90deg, #f57c0014, #f57c0022)', borderBottom: '1px solid #f57c0030', padding: '10px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⏸</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f57c00' }}>Ruta en revisión</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Todos los paquetes procesados. El admin revisará y cerrará la ruta.</div>
          </div>
        </div>
      )}
      {/* Ruta finalizada banner */}
      {selectedRoute?.status === 'completed' && (
        <div style={{ background: 'linear-gradient(90deg, #0077aa14, #0077aa22)', borderBottom: '1px solid #0077aa30', padding: '10px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0077aa' }}>Ruta finalizada</div>
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
                ${pay.final.toLocaleString('es-CL')}
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
            {['todos', 'pendiente', 'entregado', 'no-entregado', 'devuelto'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', border: '1px solid var(--border)',
                background: filter === f ? (f === 'devuelto' ? '#7b1fa2' : 'var(--accent)') : 'var(--card2)',
                color: filter === f ? '#fff' : 'var(--muted)'
              }}>
                {{ todos: 'Todos', pendiente: '⏳ Pendientes', entregado: '✅ Entregados', 'no-entregado': '❌ No entregados', devuelto: '📦 Devueltos' }[f]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Map */}
        <div style={{ display: tab === 'm' ? 'block' : 'none', height: '100%' }}>
          <RouteMap
            packages={packages}
            onPkgClick={setEditPkg}
            startPoint={selectedRoute?.startPoint}
            onVerifyLoad={() => setShowLoadCheck(true)}
            visible={tab === 'm'}
            myLocation={myLocation}
          />
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
                  hidePrice
                  lockDelivered
                  readOnly={['completed', 'paused'].includes(selectedRoute?.status)}
                  sameAddressCount={addrCountMap[(pkg.address || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')] || 1}
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

function calcDriverPay(route, activePackages = []) {
  const settlement = route?.driverSettlement || {};
  const base = Number(route?.driverPayout || settlement.baseAmount || 0);
  const delivered = activePackages.filter(p => p.status === 'entregado').length;
  const payable = activePackages.filter(isPayableForDriver).length;
  const total = activePackages.length;
  const ratio = total ? payable / total : 0;
  const status = settlement.status || 'pending';
  const approved = Number(settlement.approvedAmount || 0);
  const adjustment = Number(settlement.adjustment || 0);
  const mode = settlement.mode || 'proportional_delivered';
  const suggested = mode === 'fixed'
    ? base
    : mode === 'manual'
      ? (approved || base)
      : Math.round(base * ratio);
  const isFinal = ['approved', 'paid'].includes(status) && approved > 0;
  return {
    base,
    delivered,
    payable,
    total,
    adjustment,
    status,
    isFinal,
    final: Math.max(0, isFinal ? approved : suggested + adjustment),
  };
}

function isPayableForDriver(pkg) {
  if (pkg.status === 'entregado') return true;
  if (pkg.status === 'no-entregado') return Boolean(pkg.failReason);
  if (pkg.status === 'devuelto') return Boolean(pkg.failReason || pkg.note);
  return false;
}

function DriverReport({ packages, route }) {
  const active = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');
  const failed = active.filter(p => p.status === 'no-entregado');
  const returned = active.filter(p => p.status === 'devuelto');
  const pending = active.filter(p => p.status === 'pendiente');
  const pay = calcDriverPay(route, active);

  return (
    <div style={{ padding: '14px 10px calc(50px + env(safe-area-inset-bottom))', overflowY: 'auto', height: '100%' }}>
      {pay.base > 0 && (
        <div style={{ background: '#f4f7ff', border: '1px solid #0052FF26', borderRadius: 13, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: 'var(--accent)', marginBottom: 8 }}>
            {pay.isFinal ? 'PAGO FINAL' : 'PAGO ESTIMADO'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)' }}>${pay.final.toLocaleString('es-CL')}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                Base ${pay.base.toLocaleString('es-CL')} · {pay.payable}/{pay.total} pagables
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: pay.status === 'paid' ? '#16a34a' : 'var(--muted)', textTransform: 'uppercase' }}>
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
          ...(pay.base > 0 ? [[pay.isFinal ? 'Pago final' : 'Pago estimado', '$' + pay.final.toLocaleString('es-CL')]] : [])
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
            <span>{label}</span>
            <span style={{ color: label === 'Devueltos' ? '#7b1fa2' : 'var(--accent)', fontWeight: 700 }}>{val}</span>
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
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#7b1fa2', padding: '14px 0 7px', textTransform: 'uppercase' }}>
            DEVUELTOS ({returned.length})
          </div>
          {returned.map(p => <ReportCard key={p._id} pkg={p} type="devuelto" />)}
        </>
      )}
    </div>
  );
}

function ReportCard({ pkg, type }) {
  const color = type === 'entregado' ? 'var(--accent)' : type === 'devuelto' ? '#7b1fa2' : 'var(--danger)';
  const borderColor = type === 'entregado' ? '#0052FF28' : type === 'devuelto' ? '#7b1fa228' : '#cc224428';
  return (
    <div style={{ background: '#fff', border: `1px solid ${borderColor}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
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
