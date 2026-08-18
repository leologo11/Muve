import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/index.js';
import { FilterChipRow, EmptyState } from '../../components/driver-ui/index.js';
import PackageCard from '../../components/PackageCard.jsx';

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'entregado', label: '✅ Entregados', color: 'var(--accent)' },
  { value: 'no-entregado', label: '❌ No entregados', color: 'var(--danger)' },
  { value: 'devuelto', label: '📦 Devueltos', color: 'var(--devuelto)' },
];

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function isoMonthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
const todayISO = () => new Date().toISOString().slice(0, 10);

const DATE_PRESETS = [
  { key: 'today', label: 'Hoy', from: () => todayISO(), to: () => todayISO() },
  { key: 'week', label: 'Esta semana', from: () => isoDaysAgo(6), to: () => todayISO() },
  { key: 'month', label: 'Este mes', from: () => isoMonthStart(), to: () => todayISO() },
  { key: 'all', label: 'Todo', from: () => '', to: () => '' },
];

const LIMIT = 30;

export default function DriverHistoryView({ onBack }) {
  const [status, setStatus] = useState('todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [routeId, setRouteId] = useState('');
  const [routes, setRoutes] = useState([]);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getRoutes().then(r => setRoutes(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const fetchPage = useCallback(async (pageNum, replace) => {
    try {
      const res = await api.getMyPackages({ status, from, to, routeId, page: pageNum, limit: LIMIT });
      setItems(prev => replace ? res.packages : [...prev, ...res.packages]);
      setTotal(res.total);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
    }
  }, [status, from, to, routeId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchPage(1, true).finally(() => setLoading(false));
  }, [fetchPage]);

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchPage(page + 1, false);
    setLoadingMore(false);
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#003BB5,#0052FF)', padding: '16px 20px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 'var(--r-sm)', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}>←</button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>📜 Historial de entregas</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 1 }}>{total} paquete{total !== 1 ? 's' : ''} encontrados</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '10px 14px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FilterChipRow options={STATUS_OPTIONS} value={status} onChange={setStatus} />

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {DATE_PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => { setFrom(p.from()); setTo(p.to()); }}
              style={{ flexShrink: 0, padding: '4px 12px', borderRadius: 'var(--r-full)', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>a</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
        </div>

        <select value={routeId} onChange={e => setRouteId(e.target.value)} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}>
          <option value="">Todas las rutas</option>
          {routes.map(r => (
            <option key={r._id} value={r._id}>{r.routeCode}{r.name ? ` · ${r.name}` : ''}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0', WebkitOverflowScrolling: 'touch' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Cargando historial…</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ margin: '0 14px', background: 'var(--danger-dim)', border: '1px solid var(--danger-dim)', borderRadius: 'var(--r-sm)', padding: '14px 16px', color: 'var(--danger)', fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <EmptyState icon="📭" title="Sin resultados" subtitle="Prueba otro rango de fechas o estado" />
        )}

        {items.map((pkg, i) => (
          <PackageCard key={pkg._id} pkg={pkg} index={i} readOnly hidePrice={false} />
        ))}

        {!loading && items.length < total && (
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{ padding: '10px 24px', borderRadius: 'var(--r-full)', border: '1px solid var(--accent-dim)', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: loadingMore ? 'not-allowed' : 'pointer' }}
            >
              {loadingMore ? 'Cargando…' : `Cargar más (${items.length}/${total})`}
            </button>
          </div>
        )}

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
