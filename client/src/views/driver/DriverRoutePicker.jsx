import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../api/index.js';
import DriverProfileModal from './DriverProfileModal.jsx';
import DriverPaymentsView from './DriverPaymentsView.jsx';

const STATUS = {
  active:    { label: '● En ruta',       color: '#16a34a', bg: '#dcfce7', border: '#16a34a40' },
  paused:    { label: '⏸ En revisión',   color: '#f57c00', bg: '#fff8e1', border: '#f57c0040' },
  draft:     { label: '📋 Pendiente',    color: '#0052FF', bg: '#eff6ff', border: '#0052FF40' },
  completed: { label: '✓ Completada',    color: '#64748b', bg: '#f1f5f9', border: '#94a3b840' },
  cancelled: { label: '✗ Cancelada',     color: '#cc2244', bg: '#fff0f2', border: '#cc224440' },
};

// Week earnings helper (Tuesday to Monday)
function currentWeekEarnings(routes) {
  const today = new Date();
  const dow = today.getDay();
  const back = (dow - 2 + 7) % 7;
  const tueSt = new Date(today); tueSt.setDate(today.getDate() - back); tueSt.setHours(0,0,0,0);
  const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL');
  let earned = 0;
  routes.forEach(r => {
    if (!r.date) return;
    const rd = new Date(r.date + 'T12:00');
    if (rd >= tueSt) {
      const base = Number(r.driverPayout || 0);
      const total = Number(r.stats?.total || 1);
      const delivered = Number(r.stats?.delivered || 0);
      const failed = Number(r.stats?.failed || 0);
      earned += Math.round(base / total * (delivered + failed));
    }
  });
  return fmt(earned);
}

export default function DriverRoutePicker({ onSelect }) {
  const { user, logout } = useAuth();
  const [routes, setRoutes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showPayments, setShowPayments] = useState(false);

  useEffect(() => {
    api.getRoutes()
      .then(r => setRoutes(Array.isArray(r) ? r : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (showPayments) return <DriverPaymentsView onBack={() => setShowPayments(false)} />;

  const today     = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = user?.name?.split(' ')[0] || 'Driver';
  const active    = routes.filter(r => ['active', 'paused', 'draft'].includes(r.status));
  const done      = routes.filter(r => ['completed', 'cancelled'].includes(r.status));
  const weekEarned = !loading ? currentWeekEarnings(routes) : '…';
  const initials  = (user?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F1F5F9', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #003BB5 0%, #0052FF 100%)', padding: '16px 18px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontWeight: 700, marginBottom: 2, letterSpacing: .5 }}>🚗 MUVE DRIVER</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5, lineHeight: 1.1 }}>Hola, {firstName}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 3, textTransform: 'capitalize' }}>{today}</div>
          </div>

          {/* Avatar + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={logout} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 20, padding: '6px 12px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Salir
            </button>
            <button onClick={() => setShowProfile(true)} style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.22)', border: '2px solid rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff', cursor: 'pointer' }}>
              {user?.photoUrl ? <img src={user.photoUrl} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" /> : initials}
            </button>
          </div>
        </div>

        {/* Stats + earnings */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(255,255,255,.15)', cursor: 'pointer' }} onClick={() => setShowPayments(true)}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#86efac' }}>{weekEarned}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 1 }}>Esta semana 💰</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(255,255,255,.15)' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{active.length}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 1 }}>Rutas activas 📦</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(255,255,255,.15)', cursor: 'pointer' }} onClick={() => setShowPayments(true)}>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'rgba(255,255,255,.7)' }}>{done.length}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 1 }}>Completadas</div>
          </div>
        </div>
      </div>

      {/* Action buttons row */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 14px', display: 'flex', gap: 8, flexShrink: 0 }}>
        {[
          { icon: '💰', label: 'Mis pagos', onClick: () => setShowPayments(true), color: '#0052FF' },
          { icon: '👤', label: 'Mi perfil', onClick: () => setShowProfile(true), color: '#7c3aed' },
        ].map(btn => (
          <button key={btn.label} onClick={btn.onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 22, border: `1px solid ${btn.color}25`, background: `${btn.color}08`, color: btn.color, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <span>{btn.icon}</span>{btn.label}
          </button>
        ))}
      </div>

      {/* Route list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', WebkitOverflowScrolling: 'touch' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Cargando rutas…</div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fff0f2', border: '1px solid #cc224430', borderRadius: 12, padding: '14px 16px', color: '#cc2244', fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {!loading && routes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#64748b' }}>Sin rutas asignadas</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Contacta al administrador</div>
          </div>
        )}

        {active.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>
              Rutas pendientes
            </div>
            {active.map(r => <RouteCard key={r._id} route={r} onSelect={onSelect} />)}
          </>
        )}

        {done.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#94a3b8', textTransform: 'uppercase', margin: '18px 0 10px' }}>
              Historial
            </div>
            {done.map(r => <RouteCard key={r._id} route={r} onSelect={onSelect} dimmed />)}
          </>
        )}

        <div style={{ height: 24 }} />
      </div>

      {showProfile && <DriverProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}

function RouteCard({ route, onSelect, dimmed = false }) {
  const meta     = STATUS[route.status] || STATUS.draft;
  const dateStr  = new Date(route.date + 'T12:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
  const pkgs     = route.stats?.total ?? route.packageCount ?? '—';
  const delivered = route.stats?.delivered ?? 0;
  const pct      = pkgs > 0 ? Math.round(delivered / pkgs * 100) : 0;

  return (
    <div
      onClick={() => onSelect(route._id)}
      style={{
        background: dimmed ? '#f8fafc' : '#fff',
        border: `1.5px solid ${dimmed ? '#e2e8f0' : meta.border}`,
        borderRadius: 16, marginBottom: 12, overflow: 'hidden',
        boxShadow: dimmed ? 'none' : '0 2px 12px rgba(0,82,255,.08)',
        cursor: 'pointer', opacity: dimmed ? 0.75 : 1,
        transition: 'transform .1s',
        WebkitTapHighlightColor: 'transparent',
      }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(.98)'}
      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {/* Top stripe for active routes */}
      {route.status === 'active' && (
        <div style={{ height: 3, background: 'linear-gradient(90deg, #0052FF, #00DAFF)' }} />
      )}

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', letterSpacing: -0.3 }}>
              {route.routeCode}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
              {dateStr} {route.name ? `· ${route.name}` : ''}
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px',
            borderRadius: 20, background: meta.bg, color: meta.color,
            border: `1px solid ${meta.border}`, whiteSpace: 'nowrap',
          }}>
            {meta.label}
          </span>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#64748b', marginBottom: 10 }}>
          <span>📦 {pkgs} paquetes</span>
          {route.distanceKm && <span>🗺 {route.distanceKm} km</span>}
          {pkgs > 0 && delivered > 0 && (
            <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ {delivered} entregados</span>
          )}
        </div>

        {/* Progress bar for active/paused */}
        {(route.status === 'active' || route.status === 'paused') && pkgs > 0 && (
          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: 'linear-gradient(90deg, #0052FF, #00DAFF)',
              width: `${pct}%`, transition: 'width .5s',
            }} />
          </div>
        )}

        {/* Start point */}
        {route.startPoint?.address && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
            📍 {route.startPoint.address}
          </div>
        )}

        {/* Enter button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            padding: '9px 20px', borderRadius: 22,
            background: dimmed ? '#f1f5f9' : 'linear-gradient(90deg, #0052FF, #0070FF)',
            color: dimmed ? '#94a3b8' : '#fff',
            fontSize: 13, fontWeight: 800,
          }}>
            {route.status === 'completed' ? 'Ver →' : 'Entrar →'}
          </div>
        </div>
      </div>
    </div>
  );
}
