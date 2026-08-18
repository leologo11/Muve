import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';

export default function QuotesBadgeBtn({ onClick, wide = false }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    api.getQuotes()
      .then(qs => setCount(qs.filter(q => q.status === 'submitted').length))
      .catch(() => {});
  }, []);
  return (
    <button onClick={onClick} style={{ position: 'relative', background: '#f57c0014', border: '1px solid #f57c0030', borderRadius: wide ? 12 : 8, padding: wide ? '11px 12px' : '4px 10px', fontSize: wide ? 13 : 11, fontWeight: wide ? 900 : 700, color: '#f57c00', cursor: 'pointer', width: wide ? '100%' : 'auto', textAlign: wide ? 'left' : 'center' }}>
      💼 Cotizaciones
      {wide && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>Solicitudes enviadas por clientes</div>}
      {count > 0 && (
        <span style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#cc2244', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
          {count}
        </span>
      )}
    </button>
  );
}
