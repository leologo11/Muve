import React from 'react';

// Binary/multi segmented control — pill-shaped, active segment filled.
// Used as the primary "Por entregar / Entregados" split in the driver's package list.
export default function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', background: 'var(--card2)', borderRadius: 'var(--r-full)', padding: 3, gap: 2 }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 'var(--r-full)', border: 'none',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--muted)',
              fontSize: 12, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              transition: 'background var(--t-base) var(--ease), color var(--t-base) var(--ease)',
            }}
          >
            {opt.label}
            {opt.count != null && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 'var(--r-full)',
                background: active ? 'rgba(255,255,255,.25)' : 'var(--border)',
                color: active ? '#fff' : 'var(--muted)',
              }}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
