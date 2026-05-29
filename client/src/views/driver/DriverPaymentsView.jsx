import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CL');

// Returns the Tuesday that starts the week containing the given date
function weekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00');
  const dow = d.getDay(); // 0=Sun,1=Mon,2=Tue,...
  const back = (dow - 2 + 7) % 7;
  d.setDate(d.getDate() - back);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekLabel(tue) {
  const mon = new Date(tue);
  mon.setDate(tue.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${tue.toLocaleDateString('es-CL', opts)} – ${mon.toLocaleDateString('es-CL', opts)}`;
}

function isSameWeek(dateStr, tuesdayDate) {
  const ws = weekStart(dateStr);
  return ws.getTime() === tuesdayDate.getTime();
}

// Per-route earnings calculation (matches calcDriverPay in DriverView)
function routeEarnings(route) {
  const settlement  = route.driverSettlement || {};
  const base        = Number(route.driverPayout || settlement.baseAmount || 0);
  if (!base) return { base: 0, earned: 0, pricePerPkg: 0, delivered: 0, incidents: 0, total: 0, status: settlement.status || 'pending' };
  const active      = Number(route.stats?.total ?? 0);
  const delivered   = Number(route.stats?.delivered ?? 0);
  const failed      = Number(route.stats?.failed ?? 0);
  const payable     = delivered + failed; // all incidents count until admin review is added
  const ppc         = active > 0 ? base / active : 0;
  const mode        = settlement.mode || 'proportional_delivered';
  const approved    = Number(settlement.approvedAmount || 0);
  const adjustment  = Number(settlement.adjustment || 0);
  const suggested   = mode === 'fixed' ? base : mode === 'manual' ? (approved || base) : Math.round(ppc * payable);
  const isFinal     = ['approved', 'paid'].includes(settlement.status) && approved > 0;
  const earned      = Math.max(0, isFinal ? approved : suggested + adjustment);
  return { base, earned, pricePerPkg: Math.round(ppc), delivered, incidents: failed, total: active, status: settlement.status || 'pending', isFinal };
}

function groupByWeek(routes) {
  const weeks = {};
  routes.forEach(r => {
    if (!r.date) return;
    const ws  = weekStart(r.date);
    const key = ws.getTime();
    if (!weeks[key]) weeks[key] = { tuesday: ws, routes: [] };
    weeks[key].routes.push(r);
  });
  return Object.values(weeks).sort((a, b) => b.tuesday - a.tuesday);
}

// ── Week card ────────────────────────────────────────────────────────────────
function WeekCard({ week, isCurrentWeek }) {
  const [open, setOpen] = useState(isCurrentWeek);
  const earnings = week.routes.map(r => ({ route: r, ...routeEarnings(r) }));
  const total    = earnings.reduce((s, e) => s + e.earned, 0);
  const confirmed= earnings.filter(e => e.status === 'paid').reduce((s,e) => s + e.earned, 0);
  const pending  = earnings.filter(e => e.status !== 'paid').reduce((s,e) => s + e.earned, 0);
  const allPaid  = earnings.every(e => e.status === 'paid');

  return (
    <div style={{ background: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', border: `1.5px solid ${isCurrentWeek ? '#0052FF30' : '#e2e8f0'}`, boxShadow: isCurrentWeek ? '0 2px 16px rgba(0,82,255,.1)' : '0 1px 4px rgba(0,0,0,.06)' }}>
      {isCurrentWeek && <div style={{ height: 3, background: 'linear-gradient(90deg,#0052FF,#00DAFF)' }} />}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {isCurrentWeek && <span style={{ fontSize: 10, fontWeight: 800, background: '#0052FF', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>SEMANA ACTUAL</span>}
            {allPaid && !isCurrentWeek && <span style={{ fontSize: 10, fontWeight: 800, background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 20 }}>✓ PAGADO</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{weekLabel(week.tuesday)}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{week.routes.length} ruta{week.routes.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0052FF', letterSpacing: -0.5 }}>{fmt(total)}</div>
          {pending > 0 && confirmed > 0 && (
            <div style={{ fontSize: 11, color: '#64748b' }}>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>{fmt(confirmed)}</span> pagado · {fmt(pending)} pendiente
            </div>
          )}
          <div style={{ fontSize: 16, color: '#94a3b8', marginTop: 2 }}>{open ? '▲' : '▼'}</div>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 12px 12px' }}>
          {earnings.map(({ route, earned, pricePerPkg, delivered, incidents, total, status, isFinal }) => (
            <div key={route._id} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px', marginBottom: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{route.routeCode}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                    {new Date(route.date + 'T12:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#0052FF' }}>{fmt(earned)}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: status === 'paid' ? '#dcfce7' : status === 'approved' ? '#eff6ff' : '#fff8e1', color: status === 'paid' ? '#16a34a' : status === 'approved' ? '#0052FF' : '#f57c00' }}>
                    {status === 'paid' ? '✓ Pagado' : status === 'approved' ? '✓ Aprobado' : '⏳ Pendiente'}
                  </span>
                </div>
              </div>

              {/* Package breakdown */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip color="#16a34a" bg="#dcfce7">{delivered} entregados</Chip>
                {incidents > 0 && <Chip color="#f57c00" bg="#fff8e1">{incidents} incidencias</Chip>}
                <Chip color="#64748b" bg="#f1f5f9">{total} total</Chip>
                {pricePerPkg > 0 && <Chip color="#0052FF" bg="#eff6ff">{fmt(pricePerPkg)}/pkg</Chip>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ color, bg, children }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: bg, color, border: `1px solid ${color}30` }}>
      {children}
    </span>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────
export default function DriverPaymentsView({ onBack }) {
  const [routes, setRoutes]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRoutes()
      .then(r => setRoutes(Array.isArray(r) ? r.filter(rt => rt.driverPayout > 0 || rt.stats?.delivered > 0) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const weeks   = groupByWeek(routes);
  const today   = new Date();
  const curWeekTs = weekStart(today.toISOString().slice(0,10)).getTime();

  // Summary totals
  const allEarnings = routes.map(routeEarnings);
  const totalEarned = allEarnings.reduce((s, e) => s + e.earned, 0);
  const totalPaid   = allEarnings.filter(e => e.status === 'paid').reduce((s, e) => s + e.earned, 0);
  const curWeekEarned = routes
    .filter(r => weekStart(r.date).getTime() === curWeekTs)
    .reduce((s, r) => s + routeEarnings(r).earned, 0);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F1F5F9', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#003BB5,#0052FF)', padding: '16px 20px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}>←</button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>💰 Mis pagos</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 1 }}>Cortes martes a lunes</div>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Esta semana', val: curWeekEarned, color: '#86efac' },
            { label: 'Total pagado', val: totalPaid, color: 'rgba(255,255,255,.9)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(255,255,255,.15)' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color, letterSpacing: -0.5 }}>{fmt(s.val)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>ℹ️</span>
        <span style={{ fontSize: 11, color: '#92400e', fontWeight: 600, lineHeight: 1.35 }}>
          Pagos todos los martes. Precio por paquete = monto de ruta ÷ paquetes activos.
          Las incidencias se pagan una vez verificadas por el admin.
        </span>
      </div>

      {/* Weeks list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', WebkitOverflowScrolling: 'touch' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <div>Cargando pagos…</div>
          </div>
        )}
        {!loading && weeks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>💸</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#64748b' }}>Sin pagos registrados</div>
          </div>
        )}
        {weeks.map(week => (
          <WeekCard
            key={week.tuesday.getTime()}
            week={week}
            isCurrentWeek={week.tuesday.getTime() === curWeekTs}
          />
        ))}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
