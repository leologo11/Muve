import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/index.js';
import { toast } from './Toast.jsx';

const FAIL_REASONS = [
  'Nadie en casa',
  'No atendió el teléfono',
  'Dirección incorrecta',
  'Rechazó el paquete',
  'Edificio / portería sin autorización',
  'Otro'
];

export default function DeliveryModal({ pkg, onClose, onSaved, readOnly }) {
  const [status, setStatus] = useState(pkg?.status || 'pendiente');
  const [failReason, setFailReason] = useState(pkg?.failReason || '');
  const [note, setNote] = useState(pkg?.note || '');
  const [photo, setPhoto] = useState(pkg?.photoUrl || null);
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const camRef = useRef();
  const galRef = useRef();

  useEffect(() => {
    setStatus(pkg?.status || 'pendiente');
    setFailReason(pkg?.failReason || '');
    setNote(pkg?.note || '');
    setPhoto(pkg?.photoUrl || null);
    setPhotoFile(null);
  }, [pkg]);

  if (!pkg) return null;

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePackage(pkg._id, {
        status,
        note,
        failReason: status === 'no-entregado' ? failReason : ''
      });

      if (photoFile) {
        await api.uploadPhoto(pkg._id, photoFile);
      }

      toast('✅ Guardado');
      onSaved?.();
      onClose();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: '#0006',
        zIndex: 800, display: 'flex', alignItems: 'flex-end'
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '20px 20px 0 0',
        width: '100%', maxHeight: '93dvh', overflowY: 'auto',
        padding: '18px 16px calc(30px + env(safe-area-inset-bottom))',
        boxShadow: '0 -4px 30px #00000015'
      }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 13 }}>
          {readOnly ? '👁 Detalle' : '✏️ Editar entrega'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 13 }}>
          #{pkg.trackingId} · {pkg.customerName} {pkg.customerLastName}<br />
          <span style={{ fontSize: 12 }}>{pkg.address}{pkg.aptFloor ? `, ${pkg.aptFloor}` : ''}</span>
        </p>

        {!readOnly && (
          <>
            <Label>Estado</Label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={inputStyle}
            >
              <option value="pendiente">⏳ Pendiente</option>
              <option value="entregado">✅ Entregado</option>
              <option value="no-entregado">❌ No entregado</option>
            </select>

            {status === 'no-entregado' && (
              <>
                <Label>Motivo</Label>
                <select value={failReason} onChange={e => setFailReason(e.target.value)} style={inputStyle}>
                  <option value="">Seleccionar motivo...</option>
                  {FAIL_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </>
            )}

            <Label>Nota adicional</Label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ej: dejé con conserje, firmó Juan..."
              style={{ ...inputStyle, resize: 'none', height: 70 }}
            />

            <Label>Foto de entrega</Label>
            <button onClick={() => camRef.current.click()} style={btnStyle('#d4650a')}>
              📷 Tomar foto con cámara
            </button>
            <button onClick={() => galRef.current.click()} style={{ ...btnStyle('#9c27b0'), marginTop: 7 }}>
              🖼️ Elegir desde galería
            </button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
            <input ref={galRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
          </>
        )}

        {photo && (
          <div style={{ marginTop: 10 }}>
            <img src={photo} alt="foto" style={{ width: '100%', borderRadius: 11, maxHeight: 220, objectFit: 'cover', border: '1px solid var(--border)' }} />
          </div>
        )}

        {pkg.deliveredAt && (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
            Entregado: {new Date(pkg.deliveredAt).toLocaleString('es-CL')}
            {pkg.deliveredBy && ` · por ${pkg.deliveredBy}`}
          </p>
        )}

        {!readOnly && (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 12,
              background: saving ? 'var(--border)' : 'var(--accent)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Guardando…' : '✓ GUARDAR ENTREGA'}
          </button>
        )}

        <button onClick={onClose} style={{
          width: '100%', padding: 13, borderRadius: 12, border: '1px solid var(--border)',
          background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', marginTop: 7
        }}>
          {readOnly ? 'Cerrar' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', margin: '13px 0 5px' }}>{children}</div>;
}

const inputStyle = {
  width: '100%', background: 'var(--card2)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px',
  outline: 'none', WebkitAppearance: 'none', display: 'block'
};

function btnStyle(color) {
  return {
    width: '100%', padding: '13px 14px', borderRadius: 12, border: `1px solid ${color}30`,
    background: `${color}15`, color, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 7
  };
}
