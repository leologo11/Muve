import React from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

const ROLE_META = {
  admin:   { label: 'Admin',   color: '#0052FF', bg: '#0052FF14', icon: '⚙️' },
  driver:  { label: 'Driver',  color: '#0077aa', bg: '#0077aa14', icon: '🚗' },
  company: { label: 'Empresa', color: '#d4650a', bg: '#d4650a14', icon: '🏢' },
};

export default function Header({ title, stats, onBack, extra }) {
  const { user, logout } = useAuth();
  const role = ROLE_META[user?.role] || { label: user?.role, color: '#888', bg: '#88888814', icon: '👤' };

  return (
    <div style={{
      background: 'var(--card)',
      flexShrink: 0,
      paddingTop: 'max(10px, env(safe-area-inset-top))',
      boxShadow: 'var(--shadow-sm)',
      borderBottom: '1px solid var(--border)',
      position: 'relative',
      zIndex: 10,
    }}>

      {/* Accent line */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, var(--accent) 0%, var(--a2) 100%)',
        opacity: .6
      }} />

      {/* Main row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px 8px'
      }}>
        {/* Left: back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Volver"
              style={{
                background: 'none', border: 'none',
                width: 32, height: 32, borderRadius: 'var(--r-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, cursor: 'pointer', color: 'var(--muted)',
                flexShrink: 0,
                transition: 'background var(--t-fast) var(--ease), color var(--t-fast) var(--ease)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--card2)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
            >
              ←
            </button>
          )}
          <h1 style={{
            fontSize: 16, fontWeight: 700, color: 'var(--accent)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            letterSpacing: '-.1px'
          }}>
            {title || '🚚 MUVE'}
          </h1>
        </div>

        {/* Right: extra + user */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {extra}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '3px 9px', borderRadius: 'var(--r-full)',
                background: role.bg, color: role.color,
                border: `1px solid ${role.color}25`,
                letterSpacing: '.3px', whiteSpace: 'nowrap'
              }}>
                {role.icon} {role.label}
              </span>
              <button
                onClick={logout}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
                  fontWeight: 600, padding: '4px 6px', borderRadius: 'var(--r-xs)',
                  transition: 'background var(--t-fast) var(--ease), color var(--t-fast) var(--ease)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-dim)'; e.currentTarget.style.color = 'var(--danger)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{
          display: 'flex', gap: 5, overflowX: 'auto',
          padding: '0 14px 10px',
          scrollbarWidth: 'none'
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              flexShrink: 0, padding: '3px 10px', borderRadius: 'var(--r-full)',
              fontSize: 11, fontWeight: 500,
              border: '1px solid var(--border)',
              background: s.color ? `${s.color}10` : 'var(--card2)',
              color: 'var(--muted)',
              whiteSpace: 'nowrap'
            }}>
              {s.label}:{' '}
              <b style={{ color: s.color || 'var(--text)', fontWeight: 700 }}>{s.value}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
