import React, { useState } from 'react';

const STATUS = {
  pendiente:      { color: '#888',    label: 'PENDIENTE',    icon: '⏳' },
  entregado:      { color: '#008855', label: 'ENTREGADO',    icon: '✓'  },
  'no-entregado': { color: '#cc2244', label: 'NO ENTREGADO', icon: '✗'  },
  eliminado:      { color: '#c04a1a', label: 'ELIMINADO',    icon: '✕'  },
};

export default function PackageCard({ pkg, index, onEdit, onStatusChange, onDelete, onRestore, readOnly, hidePrice, lockDelivered }) {
  const [hovered, setHovered] = useState(false);
  const st  = pkg.status;
  const s   = STATUS[st] || STATUS.pendiente;
  const isElim = st === 'eliminado';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        margin: '0 10px 8px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)',
        background: 'var(--card)',
        opacity: isElim ? 0.55 : 1,
        overflow: 'hidden',
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow var(--t-base) var(--ease), transform var(--t-base) var(--ease)',
        animation: 'fadeIn .2s var(--ease-out)',
        position: 'relative',
      }}
    >
      {/* Status stripe – left border indicator */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
        background: s.color,
        borderRadius: 'var(--r-md) 0 0 var(--r-md)',
        opacity: st === 'pendiente' ? 0.35 : 0.85,
        transition: 'opacity var(--t-base) var(--ease)'
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 10px 8px 4px' }}>
        {/* Number + thumb */}
        <div style={{
          width: 46, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 5, paddingTop: 2, flexShrink: 0
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: `${s.color}18`, color: s.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: st === 'pendiente' ? 10 : 14, fontWeight: 800,
            border: `1.5px solid ${s.color}30`
          }}>
            {st === 'pendiente' ? index + 1 : s.icon}
          </div>
          {pkg.photoUrl && (
            <img
              src={pkg.photoUrl}
              alt=""
              style={{
                width: 32, height: 32, borderRadius: 8,
                objectFit: 'cover', border: '1px solid var(--border)',
                cursor: 'pointer', transition: 'opacity var(--t-fast) var(--ease)'
              }}
              onClick={() => window.open(pkg.photoUrl, '_blank')}
              onMouseEnter={e => { e.currentTarget.style.opacity = '.7'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, lineHeight: 1.2,
            textDecoration: isElim ? 'line-through' : 'none',
            color: isElim ? 'var(--muted)' : 'var(--text)'
          }}>
            {pkg.customerName} {pkg.customerLastName}
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
            {pkg.address}{pkg.commune ? `, ${pkg.commune}` : ''}
          </div>

          {pkg.aptFloor && (
            <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 2, fontWeight: 600 }}>
              {pkg.aptFloor}
            </div>
          )}

          {!hidePrice && (
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: st === 'entregado' ? 'var(--accent)' : 'var(--text2)',
              marginTop: 4
            }}>
              ${(pkg.price || 0).toLocaleString('es-CL')}
            </div>
          )}

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 5,
            padding: '2px 9px', borderRadius: 'var(--r-full)',
            fontSize: 9, fontWeight: 700, letterSpacing: '.5px',
            background: `${s.color}12`, color: s.color,
            border: `1px solid ${s.color}28`
          }}>
            {s.icon} {s.label}
          </span>

          {pkg.failReason && (
            <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 3, fontWeight: 500 }}>
              ↳ {pkg.failReason}
            </div>
          )}
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, paddingLeft: 7 }}>
          {pkg.customerPhone && (
            <NavBtn href={`tel:${pkg.customerPhone}`} color="#008855">📞</NavBtn>
          )}
          <NavBtn
            href={`https://waze.com/ul?q=${encodeURIComponent(pkg.address + ', ' + (pkg.commune || '') + ', Chile')}&navigate=yes`}
            color="#0077aa"
          >
            🔵
          </NavBtn>
          <NavBtn
            href={`https://maps.google.com/maps?daddr=${pkg.lat || 0},${pkg.lng || 0}&dir_action=navigate`}
            color="#2a9940"
          >
            📍
          </NavBtn>
        </div>
      </div>

      {/* Action buttons */}
      {!readOnly && (
        <div style={{
          display: 'flex', gap: 5, padding: '0 10px 10px 14px',
          overflowX: 'auto', scrollbarWidth: 'none'
        }}>
          {isElim ? (
            <ActionBtn color="#008855" onClick={() => onRestore?.(pkg)}>↩ Restaurar</ActionBtn>
          ) : lockDelivered && st === 'entregado' ? (
            /* Entregado bloqueado — solo foto */
            <ActionBtn color="#d4650a" onClick={() => onEdit?.(pkg)}>📷 Foto</ActionBtn>
          ) : (
            <>
              <ActionBtn color="#008855" solid onClick={() => onStatusChange?.(pkg, 'entregado')}>✅ Entregado</ActionBtn>
              <ActionBtn color="#cc2244" solid onClick={() => onStatusChange?.(pkg, 'no-entregado')}>❌ No entregado</ActionBtn>
              <ActionBtn color="#d4650a" onClick={() => onEdit?.(pkg)}>📷 Foto</ActionBtn>
              {st !== 'pendiente' && (
                <ActionBtn color="#777" onClick={() => onStatusChange?.(pkg, 'pendiente')}>↩ Deshacer</ActionBtn>
              )}
              {onDelete && <ActionBtn color="#c04a1a" onClick={() => onDelete?.(pkg)}>🗑️</ActionBtn>}
            </>
          )}
        </div>
      )}

      {pkg.note && (
        <div style={{
          margin: '0 10px 9px 14px', padding: '6px 10px', borderRadius: 'var(--r-sm)',
          background: '#3b82f60e', border: '1px solid #3b82f622',
          fontSize: 11, color: '#3366cc', lineHeight: 1.4
        }}>
          📝 {pkg.note}
        </div>
      )}
    </div>
  );
}

function NavBtn({ href, color, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        padding: '6px 10px', borderRadius: 'var(--r-xs)',
        fontSize: 13, fontWeight: 700,
        border: `1px solid ${color}28`,
        background: `${color}0e`,
        color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        textDecoration: 'none', whiteSpace: 'nowrap',
        transition: 'background var(--t-fast) var(--ease)'
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}1e`; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}0e`; }}
    >
      {children}
    </a>
  );
}

function ActionBtn({ color, solid, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, padding: '7px 12px',
        borderRadius: 'var(--r-full)',
        fontSize: 11, fontWeight: 700,
        border: solid ? 'none' : `1px solid ${color}28`,
        cursor: 'pointer',
        background: solid ? color : `${color}12`,
        color: solid ? '#fff' : color,
        display: 'flex', alignItems: 'center', gap: 4,
        whiteSpace: 'nowrap',
        transition: 'background var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease)'
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '.82'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
    >
      {children}
    </button>
  );
}
