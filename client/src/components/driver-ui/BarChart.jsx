import React from 'react';

// Single-series bar chart (SVG, no libraries). Per dataviz guidance: thin bars,
// 4px rounded data-end square at the baseline, 2px gap between bars, labels
// only on the standout bars (current + max) to avoid clutter.
export default function BarChart({ data, color = 'var(--accent)', height = 120, formatValue = n => n }) {
  if (!data?.length) return null;

  const max = Math.max(1, ...data.map(d => d.value));
  const barW = Math.min(24, Math.floor(280 / data.length) - 4);
  const gap = 4;
  const chartW = data.length * (barW + gap) - gap;
  const lastIdx = data.length - 1;
  const maxIdx = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width={chartW} height={height + 30} viewBox={`0 0 ${chartW} ${height + 30}`} style={{ display: 'block', margin: '0 auto' }}>
        {data.map((d, i) => {
          const h = Math.max(2, Math.round((d.value / max) * height));
          const x = i * (barW + gap);
          const y = height - h;
          const showLabel = i === lastIdx || i === maxIdx;
          return (
            <g key={i}>
              {showLabel && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text2)">
                  {formatValue(d.value)}
                </text>
              )}
              <rect x={x} y={y} width={barW} height={h} rx={4} fill={i === lastIdx ? color : 'var(--accent-dim)'} />
              <text x={x + barW / 2} y={height + 16} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--muted)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
