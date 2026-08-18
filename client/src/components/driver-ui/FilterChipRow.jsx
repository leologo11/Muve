import React from 'react';

// Horizontal scrollable row of filter chips — used for status sub-filters
// in the driver's package list and history screens.
export default function FilterChipRow({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flexShrink: 0, padding: '4px 12px', borderRadius: 'var(--r-full)', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', border: '1px solid var(--border)',
            background: value === opt.value ? (opt.color || 'var(--accent)') : 'var(--card2)',
            color: value === opt.value ? '#fff' : 'var(--muted)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
