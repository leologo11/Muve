import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

const STATUS_COLOR = {
  pendiente:      '#888',
  entregado:      '#008855',
  'no-entregado': '#cc2244',
  eliminado:      '#c04a1a',
};
const STATUS_LABEL = {
  todos: 'Todos',
  pendiente: '⏳ Pendientes',
  entregado: '✅ Entregados',
  'no-entregado': '❌ No entregados',
  eliminado: '🗑️ Eliminados',
};

export default function AllPackagesView() {
  const [packages, setPackages]   = useState([]);
  const [routes, setRoutes]       = useState([]);
  const [users, setUsers]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusF, setStatusF]     = useState('todos');
  const [routeF, setRouteF]       = useState('');
  const [driverF, setDriverF]     = useState('');
  const [moveTarget, setMoveTarget] = useState(null); // { pkg, targetRouteId }

  const LIMIT = 50;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await api.getAllPackages({
        search: search || undefined,
        status: statusF !== 'todos' ? statusF : undefined,
        routeId: routeF || undefined,
        driverId: driverF || undefined,
        page: p,
        limit: LIMIT,
      });
      setPackages(data.packages);
      setTotal(data.total);
      setPage(p);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusF, routeF, driverF]);

  useEffect(() => {
    api.getRoutes().then(setRoutes).catch(() => {});
    api.getUsers().then(u => setUsers(u.filter(x => x.role === 'driver'))).catch(() => {});
  }, []);

  useEffect(() => { load(1); }, [load]);

  const handleMoveConfirm = async () => {
    if (!moveTarget?.pkg || !moveTarget?.targetRouteId) return;
    try {
      await api.updatePackage(moveTarget.pkg._id, { routeId: moveTarget.targetRouteId });
      toast('✅ Paquete movido');
      setMoveTarget(null);
      load(page);
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const handleStatusChange = async (pkg, newStatus) => {
    try {
      await api.updatePackage(pkg._id, { status: newStatus });
      setPackages(prev => prev.map(p => p._id === pkg._id ? { ...p, status: newStatus } : p));
      toast(newStatus === 'entregado' ? '✅ Entregado' : '↩ Actualizado');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const drivers = users;
  const pages = Math.ceil(total / LIMIT);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Filters */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '8px 10px 6px', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre, dirección, tracking, teléfono…"
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 22, padding: '8px 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 7 }}
        />

        {/* Status chips */}
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 5 }}>
          {Object.keys(STATUS_LABEL).map(f => (
            <button key={f} onClick={() => setStatusF(f)} style={{
              flexShrink: 0, padding: '4px 11px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: statusF === f ? 'var(--accent)' : 'var(--card2)',
              color: statusF === f ? '#fff' : 'var(--muted)'
            }}>
              {STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Route + Driver selectors */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <select
            value={routeF}
            onChange={e => setRouteF(e.target.value)}
            style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 10px', fontSize: 12, outline: 'none', color: routeF ? 'var(--text)' : 'var(--muted)', WebkitAppearance: 'none' }}
          >
            <option value="">Todas las rutas</option>
            {routes.map(r => (
              <option key={r._id} value={r._id}>
                {r.routeCode}{r.name ? ` · ${r.name}` : ''} — {new Date(r.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
              </option>
            ))}
          </select>
          <select
            value={driverF}
            onChange={e => setDriverF(e.target.value)}
            style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 10px', fontSize: 12, outline: 'none', color: driverF ? 'var(--text)' : 'var(--muted)', WebkitAppearance: 'none' }}
          >
            <option value="">Todos los drivers</option>
            {drivers.map(d => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Results count */}
        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 6, letterSpacing: .5 }}>
          {loading ? 'Cargando…' : `${total} paquete${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0 calc(60px + env(safe-area-inset-bottom))' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13 }}>Cargando paquetes…</div>
        ) : packages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            Sin resultados
          </div>
        ) : (
          packages.map(pkg => (
            <PkgRow
              key={pkg._id}
              pkg={pkg}
              routes={routes}
              onMove={() => setMoveTarget({ pkg, targetRouteId: '' })}
              onStatusChange={handleStatusChange}
            />
          ))
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
            <button disabled={page <= 1} onClick={() => load(page - 1)} style={pageBtn(page > 1)}>← Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 8px', fontWeight: 600 }}>
              {page} / {pages}
            </span>
            <button disabled={page >= pages} onClick={() => load(page + 1)} style={pageBtn(page < pages)}>Siguiente →</button>
          </div>
        )}
      </div>

      {/* Move modal */}
      {moveTarget && (
        <MoveModal
          pkg={moveTarget.pkg}
          routes={routes}
          targetRouteId={moveTarget.targetRouteId}
          onSelect={id => setMoveTarget(t => ({ ...t, targetRouteId: id }))}
          onConfirm={handleMoveConfirm}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </div>
  );
}

function PkgRow({ pkg, routes, onMove, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_COLOR[pkg.status] || '#888';
  const route = pkg.routeId;
  const driver = route?.driverId;

  return (
    <div style={{
      margin: '0 8px 6px',
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: '#fff',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Left status stripe */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: sc, opacity: 0.8 }} />

      {/* Main row */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 13px', cursor: 'pointer' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
            {pkg.customerName} {pkg.customerLastName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pkg.address}{pkg.commune ? `, ${pkg.commune}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${sc}12`, color: sc, border: `1px solid ${sc}28` }}>
              {pkg.status.replace('-', ' ').toUpperCase()}
            </span>
            {route && (
              <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', padding: '2px 7px', borderRadius: 20, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                {route.routeCode}
              </span>
            )}
            {driver && (
              <span style={{ fontSize: 9, fontWeight: 600, color: '#0077aa', padding: '2px 7px', borderRadius: 20, background: '#0077aa10', border: '1px solid #0077aa20' }}>
                🚗 {driver.name}
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 16, color: 'var(--muted)', flexShrink: 0, transition: 'transform .15s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ▾
        </div>
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '9px 10px 10px 13px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Tracking + phone */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>🔖 {pkg.trackingId}</span>
            {pkg.customerPhone && (
              <a href={`tel:${pkg.customerPhone}`} style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>📞 {pkg.customerPhone}</a>
            )}
            {pkg.aptFloor && <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 600 }}>🏢 {pkg.aptFloor}</span>}
          </div>

          {/* Note / fail reason */}
          {pkg.note && <div style={{ fontSize: 11, color: '#3366cc', background: '#3b82f608', borderRadius: 6, padding: '4px 8px' }}>📝 {pkg.note}</div>}
          {pkg.failReason && <div style={{ fontSize: 11, color: 'var(--danger)' }}>↳ {pkg.failReason}</div>}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
            {pkg.status !== 'entregado' && (
              <ActionBtn color="#008855" onClick={() => onStatusChange(pkg, 'entregado')}>✅ Entregado</ActionBtn>
            )}
            {pkg.status !== 'pendiente' && (
              <ActionBtn color="#888" onClick={() => onStatusChange(pkg, 'pendiente')}>↩ Pendiente</ActionBtn>
            )}
            <ActionBtn color="#0077aa" onClick={onMove}>🔀 Mover de ruta</ActionBtn>
          </div>

          {/* Route date */}
          {route && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              Ruta {route.routeCode} · {new Date(route.date).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {driver ? ` · 🚗 ${driver.name}` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MoveModal({ pkg, routes, targetRouteId, onSelect, onConfirm, onClose }) {
  const currentRouteId = String(pkg.routeId?._id || pkg.routeId || '');
  const otherRoutes = routes.filter(r => String(r._id) !== currentRouteId);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 900, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 30px #00000022' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>🔀 Mover paquete a otra ruta</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
            {pkg.customerName} {pkg.customerLastName} — {pkg.address}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Ruta actual: <b>{pkg.routeId?.routeCode || '—'}</b>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
          {otherRoutes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: 13 }}>No hay otras rutas disponibles</div>
          ) : otherRoutes.map(r => (
            <button
              key={r._id}
              onClick={() => onSelect(r._id)}
              style={{
                width: '100%', textAlign: 'left', padding: '11px 13px', marginBottom: 6,
                borderRadius: 11, cursor: 'pointer',
                border: targetRouteId === r._id ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: targetRouteId === r._id ? '#00885510' : '#fff',
                transition: 'all .12s'
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: targetRouteId === r._id ? 'var(--accent)' : 'var(--text)' }}>
                {r.routeCode}{r.name ? ` · ${r.name}` : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {new Date(r.date).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                {r.driverId?.name ? ` · 🚗 ${r.driverId.name}` : ''}
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 16px calc(20px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button
            onClick={onConfirm}
            disabled={!targetRouteId}
            style={{
              flex: 1, padding: 13, borderRadius: 11, border: 'none', fontSize: 13, fontWeight: 700,
              cursor: targetRouteId ? 'pointer' : 'not-allowed',
              background: targetRouteId ? 'var(--accent)' : 'var(--card2)',
              color: targetRouteId ? '#fff' : 'var(--muted)'
            }}
          >
            🔀 Confirmar traslado
          </button>
          <button onClick={onClose} style={{ padding: '13px 18px', borderRadius: 11, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 20, border: `1px solid ${color}28`,
        background: `${color}12`, color, fontSize: 11, fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap'
      }}
    >
      {children}
    </button>
  );
}

function pageBtn(active) {
  return {
    padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'var(--card2)',
    color: active ? '#fff' : 'var(--muted)',
    fontSize: 11, fontWeight: 700, cursor: active ? 'pointer' : 'not-allowed'
  };
}
