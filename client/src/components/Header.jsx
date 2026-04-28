import React from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

const ROLE_LABELS = { admin: '⚙️ Admin', driver: '🚗 Driver', company: '🏢 Empresa' };
const ROLE_COLORS = { admin: '#008855', driver: '#0077aa', company: '#cc6600' };

export default function Header({ title, stats, onBack, extra }) {
  const { user, logout } = useAuth();

  return (
    <div style={{
      background: '#fff',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      paddingTop: 'max(10px, env(safe-area-inset-top))',
      boxShadow: '0 1px 4px #0000000a'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onBack && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '0 4px 0 0' }}>
              ←
            </button>
          )}
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{title || '🚚 Routiflow'}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {extra}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: (ROLE_COLORS[user.role] || '#888') + '18',
                color: ROLE_COLORS[user.role] || '#888',
                border: `1px solid ${ROLE_COLORS[user.role] || '#888'}28`
              }}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
              <button
                onClick={logout}
                style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </div>

      {stats && (
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', padding: '0 14px 10px', scrollbarWidth: 'none' }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              flexShrink: 0, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500,
              border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)'
            }}>
              {s.label}: <b style={{ color: s.color || 'var(--text)' }}>{s.value}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
