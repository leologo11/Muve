import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import { routeDateISO, parseDate, weekStart, weekLabel, groupByWeek, computeRouteEarnings } from '../../utils/driverEarnings.js';
import { BarChart, EmptyState } from '../../components/driver-ui/index.js';

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CL');
const fmtCompact = n => n >= 1000 ? Math.round(n / 1000) + 'K' : String(Math.round(n));

const routeEarnings = route => computeRouteEarnings(route);

// ── Week card ────────────────────────────────────────────────────────────────
function WeekCard({ week, isCurrentWeek }) {
  const [open, setOpen] = useState(isCurrentWeek);
  const earnings = week.routes.map(r => ({ route: r, ...routeEarnings(r) }));
  const total    = earnings.reduce((s, e) => s + e.earned, 0);
  const confirmed= earnings.filter(e => e.status === 'paid').reduce((s,e) => s + e.earned, 0);
  const pending  = earnings.filter(e => e.status !== 'paid').reduce((s,e) => s + e.earned, 0);
  const allPaid  = earnings.every(e => e.status === 'paid');

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', marginBottom: 12, overflow: 'hidden', border: `1.5px solid ${isCurrentWeek ? 'var(--accent-dim)' : 'var(--border)'}`, boxShadow: isCurrentWeek ? 'var(--shadow-md)' : 'var(--shadow-xs)' }}>
      {isCurrentWeek && <div style={{ height: 3, background: 'linear-gradient(90deg,var(--accent),var(--a2))' }} />}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {isCurrentWeek && <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--accent)', color: '#fff', padding: '2px 8px', borderRadius: 'var(--r-full)' }}>SEMANA ACTUAL</span>}
            {allPaid && !isCurrentWeek && <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--success-dim)', color: 'var(--success)', padding: '2px 8px', borderRadius: 'var(--r-full)' }}>✓ PAGADO</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{weekLabel(week.tuesday)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{week.routes.length} ruta{week.routes.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', letterSpacing: -0.5 }}>{fmt(total)}</div>
          {pending > 0 && confirmed > 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>{fmt(confirmed)}</span> pagado · {fmt(pending)} pendiente
            </div>
          )}
          <div style={{ fontSize: 16, color: 'var(--muted)', marginTop: 2 }}>{open ? '▲' : '▼'}</div>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px 12px' }}>
          {earnings.map(({ route, earned, pricePerPkg, delivered, incidents, total, status, isFinal }) => (
            <div key={route._id} style={{ background: 'var(--card2)', borderRadius: 'var(--r-sm)', padding: '12px 14px', marginBottom: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{route.routeCode}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                    {parseDate(routeDateISO(route))?.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }) ?? '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--accent)' }}>{fmt(earned)}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full)', background: status === 'paid' ? 'var(--success-dim)' : status === 'approved' ? 'var(--accent-dim)' : 'var(--warn-dim)', color: status === 'paid' ? 'var(--success)' : status === 'approved' ? 'var(--accent)' : 'var(--warn)' }}>
                    {status === 'paid' ? '✓ Pagado' : status === 'approved' ? '✓ Aprobado' : '⏳ Pendiente'}
                  </span>
                </div>
              </div>

              {/* Package breakdown */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip color="var(--success)" bg="var(--success-dim)">{delivered} entregados</Chip>
                {incidents > 0 && <Chip color="var(--warn)" bg="var(--warn-dim)">{incidents} incidencias</Chip>}
                <Chip color="var(--muted)" bg="var(--card2)">{total} total</Chip>
                {pricePerPkg > 0 && <Chip color="var(--accent)" bg="var(--accent-dim)">{fmt(pricePerPkg)}/pkg</Chip>}
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
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--r-full)', background: bg, color, border: `1px solid ${bg}` }}>
      {children}
    </span>
  );
}

function StatTile({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 12px' }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{label}</div>
    </div>
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
  const todayISO  = today.toISOString().slice(0, 10);
  const curWeekTs = weekStart(todayISO).getTime();

  // Summary totals
  const allEarnings = routes.map(routeEarnings);
  const totalEarned = allEarnings.reduce((s, e) => s + e.earned, 0);
  const totalPaid   = allEarnings.filter(e => e.status === 'paid').reduce((s, e) => s + e.earned, 0);
  const totalDelivered = routes.reduce((s, r) => s + Number(r.stats?.delivered || 0), 0);
  const avgWeekly = weeks.length ? Math.round(totalEarned / weeks.length) : 0;
  const curWeekEarned = routes
    .filter(r => weekStart(routeDateISO(r)).getTime() === curWeekTs)
    .reduce((s, r) => s + routeEarnings(r).earned, 0);

  // Last 8 weeks (oldest→newest) for the chart, using already-grouped data — no extra queries.
  const chartData = weeks.slice(0, 8).reverse().map(w => ({
    label: w.tuesday.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }),
    value: w.routes.reduce((s, r) => s + routeEarnings(r).earned, 0),
  }));

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#003BB5,#0052FF)', padding: '16px 20px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 'var(--r-sm)', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}>←</button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>💰 Mis pagos y estadísticas</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 1 }}>Cortes martes a lunes</div>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Esta semana', val: curWeekEarned, color: '#86efac' },
            { label: 'Total pagado', val: totalPaid, color: 'rgba(255,255,255,.9)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,.12)', borderRadius: 'var(--r-md)', padding: '12px 14px', border: '1px solid rgba(255,255,255,.15)' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color, letterSpacing: -0.5 }}>{fmt(s.val)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div style={{ background: 'var(--warn-dim)', borderBottom: '1px solid var(--warn-dim)', padding: '8px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>ℹ️</span>
        <span style={{ fontSize: 11, color: 'var(--warn)', fontWeight: 600, lineHeight: 1.35 }}>
          Pagos todos los martes. Precio por paquete = monto de ruta ÷ paquetes activos.
          Las incidencias se pagan una vez verificadas por el admin.
        </span>
      </div>

      {/* Historical stats + chart */}
      <div style={{ padding: '14px 14px 0', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
          Estadísticas históricas
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <StatTile label="Ganado histórico" value={fmt(totalEarned)} color="var(--accent)" />
          <StatTile label="Entregados histórico" value={totalDelivered} />
          <StatTile label="Promedio semanal" value={fmt(avgWeekly)} />
        </div>
        {chartData.length > 1 && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 10px 10px', marginBottom: 4 }}>
            <BarChart data={chartData} formatValue={v => fmtCompact(v)} />
          </div>
        )}
      </div>

      {/* Weeks list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', WebkitOverflowScrolling: 'touch' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <div>Cargando pagos…</div>
          </div>
        )}
        {!loading && weeks.length === 0 && (
          <EmptyState icon="💸" title="Sin pagos registrados" />
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
