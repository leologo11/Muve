import React from 'react';

export default function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}
