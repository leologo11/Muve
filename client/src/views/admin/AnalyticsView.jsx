import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';

const PERIODS = [
  { days: 7,  label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

const SERVICE_LABELS = {
  flete:      { label: 'Flete',      color: '#0052FF', bg: '#0052FF14' },
  mudanza:    { label: 'Mudanza',    color: '#7C3AED', bg: '#7c3aed14' },
  paqueteria: { label: 'Paquetería', color: '#059669', bg: '#05966914' },
  desconocido:{ label: 'Sin tipo',   color: '#94a3b8', bg: '#f1f5f9' },
};

const fmt = n => Number(n || 0).toLocaleString('es-CL');

function FunnelBar({ label, count, pct, maxCount, isLast }) {
  const barPct = maxCount > 0 ? Math.round(count / maxCount * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <div style={{ width: 130, fontSize: 12, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 8, height: 22, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            width: `${barPct}%`,
            height: '100%',
            background: isLast
              ? 'linear-gradient(90deg,#059669,#34d399)'
              : 'linear-gradient(90deg,#0052FF,#00DAFF)',
            borderRadius: 8,
            transition: 'width .6s ease',
          }}
        />
        <span style={{ position: 'absolute', left: 8, top: 0, lineHeight: '22px', fontSize: 11, fontWeight: 800, color: barPct > 20 ? '#fff' : 'var(--text)' }}>
          {fmt(count)}
        </span>
      </div>
      <div style={{ width: 42, textAlign: 'right', fontSize: 13, fontWeight: 900, color: isLast ? '#059669' : 'var(--accent)', flexShrink: 0 }}>
        {pct}%
      </div>
    </div>
  );
}

function MiniChart({ byDay, days }) {
  if (!byDay || Object.keys(byDay).length === 0) return null;

  const sorted = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days);

  const maxVisits = Math.max(1, ...sorted.map(([, v]) => v.visits));

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .6 }}>
        Visitas por día
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
        {sorted.map(([day, v]) => (
          <div key={day} title={`${day}: ${v.visits} visitas, ${v.submits} enviadas`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 52 }}>
              <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '3px 3px 0 0', height: `${Math.max(3, Math.round(v.visits / maxVisits * 52))}px`, position: 'relative' }}>
                {v.submits > 0 && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#059669', borderRadius: '3px 3px 0 0', height: `${Math.round(v.submits / v.visits * 100)}%` }} />
                )}
              </div>
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {day.slice(5)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#e2e8f0', display: 'inline-block' }} /> Visitas
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#059669', display: 'inline-block' }} /> Enviadas
        </span>
      </div>
    </div>
  );
}

export default function AnalyticsView({ onBack }) {
  const [days, setDays]       = useState(7);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = async (d = days) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAnalyticsFunnel(d);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); }, [days]);

  const maxCount = data?.funnel?.[0]?.count || 1;

  const conversionRate = data
    ? (data.funnel[4]?.count && data.funnel[0]?.count
        ? Math.round(data.funnel[4].count / data.funnel[0].count * 100)
        : 0)
    : 0;

  const serviceEntries = data
    ? Object.entries(data.byService || {}).sort(([, a], [, b]) => b.sessions - a.sessions)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: '#fff' }}>
        <button onClick={onBack} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '2px 6px' }}>←</button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>📊 Analytics · Landing</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Funnel de cotizaciones del sitio público</div>
        </div>
        <button
          onClick={() => load(days)}
          style={{ marginLeft: 'auto', border: '1px solid var(--border)', background: 'var(--card2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--muted)' }}
        >
          🔄
        </button>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#fff' }}>
        {PERIODS.map(p => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: days === p.days ? 'var(--accent)' : 'var(--card2)',
              color: days === p.days ? '#fff' : 'var(--text)',
              fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading && !data && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>Cargando datos…</div>
        )}

        {data && (
          <>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                { label: 'Visitas totales', value: fmt(data.total),                       color: 'var(--accent)' },
                { label: 'Cotizaciones enviadas', value: fmt(data.funnel[4]?.count || 0), color: '#059669' },
                { label: 'Tasa de conversión', value: `${conversionRate}%`,               color: conversionRate >= 10 ? '#059669' : '#f59e0b' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginTop: 3 }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Funnel */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>
                Funnel de pasos
              </div>
              {data.funnel.map((row, i) => (
                <FunnelBar
                  key={row.step}
                  label={row.label}
                  count={row.count}
                  pct={row.pct}
                  maxCount={maxCount}
                  isLast={i === data.funnel.length - 1}
                />
              ))}
            </div>

            {/* Chart */}
            {Object.keys(data.byDay || {}).length > 1 && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>
                <MiniChart byDay={data.byDay} days={days} />
              </div>
            )}

            {/* By service type */}
            {serviceEntries.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>
                  Por tipo de servicio
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {serviceEntries.map(([type, v]) => {
                    const meta = SERVICE_LABELS[type] || SERVICE_LABELS.desconocido;
                    const conv = v.sessions > 0 ? Math.round(v.submits / v.sessions * 100) : 0;
                    return (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: meta.bg, border: `1px solid ${meta.color}22` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: meta.color }}>{meta.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {fmt(v.sessions)} visitas · {fmt(v.submits)} enviadas
                          </div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: meta.color }}>{conv}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {data.total === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--muted)', fontSize: 13 }}>
                Sin datos en los últimos {days} días.<br />
                <span style={{ fontSize: 11 }}>El tracking se activa cuando alguien visita la landing pública.</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
