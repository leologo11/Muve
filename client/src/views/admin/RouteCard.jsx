import React from 'react';
import { STATUS_META, actBtn } from './adminHelpers.js';

export default function RouteCard({ route, drivers = [], onClick, onStatusChange, onDriverChange, onCancel, onDelete }) {
  const inv = route.invoice;
  const daysLeft = inv?.status === 'net30' && inv?.dueDate
    ? Math.ceil((new Date(inv.dueDate) - Date.now()) / 86400000) : null;
  const invBadge = inv?.status === 'paid' ? { text: '💳 Pagada', color: 'var(--accent)' }
    : inv?.status === 'net30' ? { text: daysLeft < 0 ? '💳 Vencida' : `💳 ${daysLeft}d`, color: daysLeft != null && daysLeft <= 7 ? 'var(--danger)' : '#f57c00' }
    : inv?.status === 'pending' ? { text: '💳 Por cobrar', color: '#f57c00' }
    : inv?.status === 'overdue' ? { text: '💳 Vencida', color: 'var(--danger)' } : null;

  const meta = STATUS_META[route.status] || STATUS_META.draft;

  const nextStatus = { draft: 'active', active: 'paused', paused: 'active', completed: null, cancelled: null }[route.status];
  const nextLabel = { draft: '▶ Activar', active: '⏸ Pausar', paused: '▶ Reactivar' }[route.status];
  const canReopen = route.status === 'completed' || route.status === 'cancelled';
  const driverName = route.driverId?.name;

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: route.status === 'active' && driverName ? '1px solid #0077aa40' : '1px solid var(--border)', padding: '13px 14px', marginBottom: 10, boxShadow: '0 1px 4px #0000000a', cursor: 'pointer' }} onClick={onClick}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{route.name || route.routeCode}</div>
          {route.name && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{route.routeCode}</div>}
          <select
            value={route.driverId?._id || route.driverId?.id || ''}
            onClick={e => e.stopPropagation()}
            onChange={e => {
              e.stopPropagation();
              onDriverChange?.(route, e.target.value);
            }}
            style={{
              marginTop: 5,
              maxWidth: 220,
              padding: '3px 8px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 800,
              outline: 'none',
              background: driverName ? (route.status === 'active' ? '#0077aa12' : '#64748b10') : '#f59e0b12',
              color: driverName ? (route.status === 'active' ? '#0077aa' : 'var(--muted)') : '#b45309',
              border: `1px solid ${driverName ? (route.status === 'active' ? '#0077aa30' : '#64748b20') : '#f59e0b30'}`,
              cursor: 'pointer',
            }}
          >
            <option value="">Sin driver</option>
            {drivers.map(d => (
              <option key={d._id || d.id} value={d._id || d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {new Date(route.date).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {route.driverId && ` · 🚗 ${route.driverId.name}`}
          </div>
          {route.clientCompany?.name && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              🏢 {route.clientCompany.name}{route.clientCompany.contactPerson ? ` · ${route.clientCompany.contactPerson}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, ml: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
            {meta.label}
          </span>
          {invBadge && <span style={{ fontSize: 10, fontWeight: 700, color: invBadge.color }}>{invBadge.text}</span>}
        </div>
      </div>

      {/* Stats */}
      {route.stats && (
        <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', val: route.stats.total },
            { label: '✅', val: route.stats.delivered, color: 'var(--accent)' },
            { label: '❌', val: route.stats.failed, color: 'var(--danger)' },
            { label: '⏳', val: route.stats.pending }
          ].map(({ label, val, color }) => (
            <div key={label} style={{ fontSize: 11, color: color || 'var(--muted)', fontWeight: 700 }}>{label} {val}</div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginLeft: 'auto' }}>
            ${(route.stats.collectedAmount || 0).toLocaleString('es-CL')} / ${(route.stats.totalAmount || 0).toLocaleString('es-CL')}
          </div>
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={e => { e.stopPropagation(); onClick(); }} style={actBtn('var(--accent)')}>📂 Abrir ruta</button>
        {nextStatus && nextLabel && (
          <button onClick={e => { e.stopPropagation(); onStatusChange(route, nextStatus); }} style={actBtn('#f57c00')}>{nextLabel}</button>
        )}
        {route.status === 'active' && (
          <button onClick={e => { e.stopPropagation(); onStatusChange(route, 'completed'); }} style={actBtn('#0077aa')}>✓ Cerrar ruta</button>
        )}
        {!['completed'].includes(route.status) && (
          <button onClick={e => { e.stopPropagation(); onCancel(route); }} style={actBtn('#f57c00')}>✗ Cancelar</button>
        )}
        {canReopen && (
          <button onClick={e => { e.stopPropagation(); onStatusChange(route, 'active'); }} style={actBtn('var(--accent)')}>🔓 Reabrir</button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(route); }} style={actBtn('var(--danger)')}>🗑️ Eliminar</button>
      </div>
    </div>
  );
}

