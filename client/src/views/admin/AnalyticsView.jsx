import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';

const PERIODS = [
  { days: 1,  label: 'Hoy' },
  { days: 7,  label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

const SERVICE_META = {
  flete:      { label: 'Flete',      color: '#0052FF', bg: '#0052FF10' },
  mudanza:    { label: 'Mudanza',    color: '#7C3AED', bg: '#7c3aed10' },
  paqueteria: { label: 'Paquetería', color: '#059669', bg: '#05966910' },
  sin_tipo:   { label: 'Sin tipo',   color: '#94a3b8', bg: '#f1f5f9'   },
};

const DEVICE_META = {
  mobile:      { label: 'Teléfono',    icon: '📱' },
  desktop:     { label: 'Computador',  icon: '🖥️' },
  tablet:      { label: 'Tablet',      icon: '📋' },
  desconocido: { label: 'Desconocido', icon: '❓' },
};

const SOURCE_META = {
  google:       { label: 'Google (orgánico)',  icon: '🔍', color: '#4285F4' },
  google_ads:   { label: 'Google Ads',         icon: '📢', color: '#EA4335' },
  facebook:     { label: 'Facebook',           icon: '👤', color: '#1877F2' },
  facebook_ads: { label: 'Facebook Ads',       icon: '📣', color: '#1877F2' },
  instagram:    { label: 'Instagram',          icon: '📸', color: '#E1306C' },
  instagram_ads:{ label: 'Instagram Ads',      icon: '📸', color: '#E1306C' },
  tiktok:       { label: 'TikTok',             icon: '🎵', color: '#010101' },
  tiktok_ads:   { label: 'TikTok Ads',         icon: '🎵', color: '#010101' },
  whatsapp:     { label: 'WhatsApp',           icon: '💬', color: '#25D366' },
  youtube:      { label: 'YouTube',            icon: '▶️', color: '#FF0000' },
  linkedin:     { label: 'LinkedIn',           icon: '💼', color: '#0A66C2' },
  twitter:      { label: 'Twitter/X',          icon: '✖️', color: '#000000' },
  bing:         { label: 'Bing',               icon: '🔎', color: '#008272' },
  directo:      { label: 'Directo / URL',      icon: '🔗', color: '#64748b' },
  referido:     { label: 'Otro sitio web',     icon: '🌐', color: '#94a3b8' },
  desconocido:  { label: 'Desconocido',        icon: '❓', color: '#cbd5e1' },
};

const fmt = n => Number(n || 0).toLocaleString('es-CL');

function FunnelBar({ label, count, pct, maxCount, isLast, dropPct, stepNote }) {
  const barPct = maxCount > 0 ? Math.round(count / maxCount * 100) : 0;
  const isGreen = isLast;
  return (
    <div style={{ padding: '7px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
        {stepNote && <div style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic', flexShrink: 0 }}>{stepNote}</div>}
        {dropPct !== null && dropPct !== undefined && (
          <div style={{ fontSize: 10, fontWeight: 700, color: dropPct > 30 ? '#ef4444' : '#f59e0b', flexShrink: 0 }}>
            {dropPct > 0 ? `▼ ${dropPct}% abandonaron` : ''}
          </div>
        )}
        <div style={{ width: 38, textAlign: 'right', fontSize: 13, fontWeight: 900, color: isGreen ? '#059669' : 'var(--accent)', flexShrink: 0 }}>
          {pct}%
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 6, height: 18, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            width: `${barPct}%`, height: '100%',
            background: isGreen ? 'linear-gradient(90deg,#059669,#34d399)' : 'linear-gradient(90deg,#0052FF,#00DAFF)',
            borderRadius: 6, transition: 'width .6s ease',
          }} />
          <span style={{ position: 'absolute', left: 6, top: 0, lineHeight: '18px', fontSize: 11, fontWeight: 800, color: barPct > 20 ? '#fff' : 'var(--text)' }}>
            {fmt(count)}
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniChart({ byDay }) {
  const sorted = Object.entries(byDay || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30);
  if (sorted.length < 2) return null;
  const maxV = Math.max(1, ...sorted.map(([, v]) => v.visits));
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .6 }}>Visitas por día</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56 }}>
        {sorted.map(([day, v]) => (
          <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
               title={`${day}: ${v.visits} visitas · ${v.submits} enviadas`}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 46 }}>
              <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '2px 2px 0 0', height: `${Math.max(2, Math.round(v.visits / maxV * 46))}px`, position: 'relative' }}>
                {v.submits > 0 && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#059669', borderRadius: '2px 2px 0 0', height: `${Math.round(v.submits / v.visits * 100)}%` }} />
                )}
              </div>
            </div>
            {sorted.length <= 14 && (
              <div style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 600 }}>{day.slice(5)}</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
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

function BreakdownRow({ icon, label, sessions, submits, total, color }) {
  const pct = total > 0 ? Math.round(sessions / total * 100) : 0;
  const conv = sessions > 0 ? Math.round(submits / sessions * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: color || 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color || '#0052FF', borderRadius: 4 }} />
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)' }}>{fmt(sessions)}</div>
        <div style={{ fontSize: 10, color: '#059669', fontWeight: 700 }}>{conv}% conv.</div>
      </div>
    </div>
  );
}

export default function AnalyticsView({ onBack }) {
  const [days, setDays]       = useState(1);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = async (d = days) => {
    setLoading(true);
    setError('');
    try {
      setData(await api.getAnalyticsFunnel(d));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); }, [days]);

  const maxCount      = data?.funnel?.[0]?.count || 1;
  const submittedRow  = data?.funnel?.[8];
  const conversionPct = data && submittedRow?.count && data.funnel[0]?.count
    ? Math.round(submittedRow.count / data.funnel[0].count * 100) : 0;

  const serviceEntries = Object.entries(data?.byService || {}).sort(([, a], [, b]) => b.sessions - a.sessions);
  const deviceEntries  = Object.entries(data?.byDevice  || {}).sort(([, a], [, b]) => b.sessions - a.sessions);
  const sourceEntries  = Object.entries(data?.bySource  || {}).sort(([, a], [, b]) => b.sessions - a.sessions);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'max(12px,env(safe-area-inset-top)) 16px 12px', borderBottom: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
        <button onClick={onBack} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '2px 6px' }}>←</button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>📊 Analytics · Landing</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Funnel de cotizaciones del sitio público</div>
        </div>
        <button onClick={() => load(days)} style={{ marginLeft: 'auto', border: '1px solid var(--border)', background: 'var(--card2)', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--muted)' }}>🔄</button>
      </div>

      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
        {PERIODS.map(p => (
          <button key={p.days} onClick={() => setDays(p.days)} style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
            background: days === p.days ? 'var(--accent)' : 'var(--card2)',
            color: days === p.days ? '#fff' : 'var(--text)',
            fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>
        )}
        {loading && !data && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>Cargando datos…</div>
        )}

        {data && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                { label: 'Visitas totales',       value: fmt(data.total),                   color: 'var(--accent)' },
                { label: 'Cotizaciones enviadas', value: fmt(submittedRow?.count || 0),      color: '#059669' },
                { label: 'Conversión total',      value: `${conversionPct}%`,               color: conversionPct >= 10 ? '#059669' : '#f59e0b' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginTop: 3 }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Funnel */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>Funnel de interacciones</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10 }}>
                Pasos 3–5 aplican solo a flete/mudanza. Paquetería va directo al formulario (paso 6).
              </div>
              {data.funnel.map((row, i) => {
                const prevCount = i > 0 ? data.funnel[i - 1].count : null;
                const dropPct = (i > 0 && prevCount > 0 && row.count < prevCount)
                  ? Math.round((prevCount - row.count) / prevCount * 100)
                  : null;
                const stepNotes = {
                  3: 'flete/mudanza',
                  4: 'flete/mudanza',
                  5: 'flete/mudanza',
                  6: 'todos los servicios',
                };
                return (
                  <FunnelBar
                    key={row.step}
                    label={row.label}
                    count={row.count}
                    pct={row.pct}
                    maxCount={maxCount}
                    isLast={i === data.funnel.length - 1}
                    dropPct={dropPct}
                    stepNote={stepNotes[row.step]}
                  />
                );
              })}
            </div>

            {/* Chart */}
            {Object.keys(data.byDay || {}).length > 1 && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>
                <MiniChart byDay={data.byDay} />
              </div>
            )}

            {/* Dispositivo */}
            {deviceEntries.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Por dispositivo</div>
                {deviceEntries.map(([d, v]) => {
                  const m = DEVICE_META[d] || DEVICE_META.desconocido;
                  return <BreakdownRow key={d} icon={m.icon} label={m.label} sessions={v.sessions} submits={v.submits} total={data.total} />;
                })}
              </div>
            )}

            {/* Fuente de tráfico */}
            {sourceEntries.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Por fuente de tráfico</div>
                {sourceEntries.map(([src, v]) => {
                  const m = SOURCE_META[src] || { label: src, icon: '🌐', color: '#94a3b8' };
                  return <BreakdownRow key={src} icon={m.icon} label={m.label} sessions={v.sessions} submits={v.submits} total={data.total} color={m.color} />;
                })}
              </div>
            )}

            {/* Por servicio */}
            {serviceEntries.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Por tipo de servicio</div>
                {serviceEntries.map(([type, v]) => {
                  const m = SERVICE_META[type] || SERVICE_META.sin_tipo;
                  const conv = v.sessions > 0 ? Math.round(v.submits / v.sessions * 100) : 0;
                  return (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8, borderRadius: 12, background: m.bg, border: `1px solid ${m.color}22` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: m.color }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmt(v.sessions)} visitas · {fmt(v.submits)} enviadas</div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: m.color }}>{conv}%</div>
                    </div>
                  );
                })}
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
