import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/index.js';

const STATUS_INFO = {
  pendiente: { emoji: '⏳', label: 'En camino', color: '#d4650a', bg: '#d4650a10' },
  entregado: { emoji: '✅', label: 'Entregado', color: '#0052FF', bg: '#0052FF10' },
  'no-entregado': { emoji: '❌', label: 'No entregado', color: '#cc2244', bg: '#cc224410' },
  eliminado: { emoji: '🗑️', label: 'Cancelado', color: '#888', bg: '#88888810' }
};

export default function CustomerView() {
  const { trackingId: paramId } = useParams();
  const [trackingId, setTrackingId] = useState(paramId || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (paramId) handleSearch(paramId);
  }, [paramId]);

  const handleSearch = async (id) => {
    const tid = (id || trackingId).trim().toUpperCase();
    if (!tid) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.trackPackage(tid);
      setResult(data);
    } catch (err) {
      setError('Paquete no encontrado. Verifica tu código de seguimiento.');
    } finally {
      setLoading(false);
    }
  };

  const info = result ? STATUS_INFO[result.status] || STATUS_INFO.pendiente : null;

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 16px', fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚚</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>MUVE</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Rastreo de entrega</p>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            value={trackingId}
            onChange={e => setTrackingId(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Ej: PKG-A3B4C5D6"
            style={{
              flex: 1, background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
              padding: '12px 14px', fontSize: 15, fontWeight: 600, outline: 'none',
              letterSpacing: 1, textTransform: 'uppercase'
            }}
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            style={{
              padding: '12px 18px', borderRadius: 12, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: 'pointer'
            }}
          >
            {loading ? '…' : 'Buscar'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '14px', borderRadius: 12, background: '#cc224410', border: '1px solid #cc224430', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {result && info && (
          <div style={{ background: '#fff', borderRadius: 16, border: `2px solid ${info.color}33`, overflow: 'hidden', animation: 'fadeIn .3s ease' }}>
            {/* Status bar */}
            <div style={{ background: info.bg, padding: '16px 20px', textAlign: 'center', borderBottom: `1px solid ${info.color}20` }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>{info.emoji}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: info.color }}>{info.label}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                #{result.trackingId}
              </div>
            </div>

            {/* Details */}
            <div style={{ padding: '16px 20px' }}>
              <Row label="Destinatario" value={result.customerName} />
              <Row label="Dirección" value={`${result.address}${result.commune ? `, ${result.commune}` : ''}`} />
              {result.routeDate && <Row label="Fecha de ruta" value={new Date(result.routeDate).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />}
              {result.deliveredAt && <Row label="Hora de entrega" value={new Date(result.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} />}
              {result.deliveredBy && <Row label="Entregado por" value={result.deliveredBy} />}
              {result.note && <Row label="Nota" value={result.note} />}
              {result.failReason && <Row label="Motivo no entrega" value={result.failReason} highlight="var(--danger)" />}

              {result.photoUrl && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Foto de entrega
                  </div>
                  <img
                    src={result.photoUrl}
                    alt="Foto de entrega"
                    style={{ width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 300, cursor: 'pointer' }}
                    onClick={() => window.open(result.photoUrl, '_blank')}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
          ¿Eres repartidor?{' '}
          <a href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Iniciar sesión</a>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: highlight || 'var(--text)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
