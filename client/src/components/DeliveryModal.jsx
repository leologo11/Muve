import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/index.js';
import { toast } from './Toast.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const FAIL_REASONS = [
  'Nadie en casa',
  'No atendió el teléfono',
  'Dirección incorrecta',
  'Rechazó el paquete',
  'Edificio / portería sin autorización',
  'Otro'
];

export default function DeliveryModal({ pkg, onClose, onSaved, readOnly, route }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(pkg?.status || 'pendiente');
  const [failReason, setFailReason] = useState(pkg?.failReason || '');
  const [note, setNote] = useState(pkg?.note || '');
  const [photo1, setPhoto1] = useState(pkg?.photoUrl || null);
  const [photo2, setPhoto2] = useState(pkg?.photo2Url || null);
  const [photoFile1, setPhotoFile1] = useState(null);
  const [photoFile2, setPhotoFile2] = useState(null);
  const [saving, setSaving] = useState(false);
  const cam1Ref = useRef(); const gal1Ref = useRef();
  const cam2Ref = useRef(); const gal2Ref = useRef();

  useEffect(() => {
    setStatus(pkg?.status || 'pendiente');
    setFailReason(pkg?.failReason || '');
    setNote(pkg?.note || '');
    setPhoto1(pkg?.photoUrl || null);
    setPhoto2(pkg?.photo2Url || null);
    setPhotoFile1(null);
    setPhotoFile2(null);
  }, [pkg]);

  if (!pkg) return null;

  const handlePhotoFile = (e, n) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => n === 1 ? setPhoto1(ev.target.result) : setPhoto2(ev.target.result);
    reader.readAsDataURL(file);
    n === 1 ? setPhotoFile1(file) : setPhotoFile2(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const deliveryMeta = await captureDeliveryMeta(pkg, status);
      await api.updatePackage(pkg._id, {
        status,
        note,
        failReason: status === 'no-entregado' ? failReason : '',
        deliveryMeta
      });
      if (photoFile1) await api.uploadPhoto(pkg._id, await createFramedDeliveryImage(photoFile1, pkg, status), 1);
      if (photoFile2) await api.uploadPhoto(pkg._id, await createFramedDeliveryImage(photoFile2, pkg, status), 2);
      toast('✅ Guardado');
      onSaved?.();
      onClose();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fullAddress = [pkg.address, pkg.aptFloor, pkg.commune].filter(Boolean).join(', ');

  // WhatsApp message for driver to contact company
  const companyPhone = route?.clientCompany?.contactPhone;
  const waMsg = companyPhone ? encodeURIComponent(
    `Hola, soy ${user?.name || 'el repartidor'} de MUVE.\n` +
    `Tengo una consulta sobre el paquete #${pkg.trackingId}.\n` +
    `Cliente: ${pkg.customerName} ${pkg.customerLastName || ''}\n` +
    `Dirección: ${fullAddress}\n` +
    `Ruta: ${route?.routeCode || ''}\n\n` +
    `¿Me pueden ayudar?`
  ) : null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 800, display: 'flex', alignItems: 'flex-end' }}
    >
      <div style={{
        background: '#fff', borderRadius: '20px 20px 0 0', width: '100%',
        maxHeight: '94dvh', overflowY: 'auto',
        padding: '18px 16px calc(30px + env(safe-area-inset-bottom))',
        boxShadow: '0 -4px 30px #00000015'
      }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />

        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          {readOnly ? '👁 Detalle paquete' : '✏️ Registrar entrega'}
        </h2>

        {/* Package info header */}
        <div style={{ background: 'var(--card2)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{pkg.customerName} {pkg.customerLastName}</div>
          {pkg.customerPhone && (
            <a href={`tel:${pkg.customerPhone}`} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, display: 'block', marginTop: 2 }}>
              📞 {pkg.customerPhone}
            </a>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{pkg.address}</div>
          {pkg.aptFloor && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)', marginTop: 1 }}>
              🏢 {pkg.aptFloor}
            </div>
          )}
          {pkg.commune && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{pkg.commune}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>#{pkg.trackingId}</div>
            {pkg.trackingId && (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(window.location.origin + '/track/' + pkg.trackingId)}`}
                  alt="QR"
                  style={{ width: 72, height: 72, borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>QR tracking</div>
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp company button — only for drivers when company phone exists */}
        {waMsg && user?.role === 'driver' && (
          <a
            href={`https://wa.me/${companyPhone.replace(/[^0-9]/g, '')}?text=${waMsg}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
              padding: '11px 14px', borderRadius: 12, textDecoration: 'none',
              background: '#0052FF15', border: '1px solid #0052FF30', color: '#0052FF', fontWeight: 700, fontSize: 13
            }}
          >
            <span style={{ fontSize: 20 }}>💬</span>
            <div>
              <div>Consultar a empresa por este paquete</div>
              <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>Abre WhatsApp con mensaje automático</div>
            </div>
          </a>
        )}

        {!readOnly && (
          <>
            <Label>Estado</Label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
              <option value="pendiente">⏳ Pendiente</option>
              <option value="entregado">✅ Entregado</option>
              <option value="no-entregado">❌ No entregado</option>
            </select>

            {status === 'no-entregado' && (
              <>
                <Label>Motivo de no entrega</Label>
                <select value={failReason} onChange={e => setFailReason(e.target.value)} style={inputStyle}>
                  <option value="">Seleccionar motivo…</option>
                  {FAIL_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </>
            )}

            <Label>Nota adicional</Label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ej: Dejé con conserje, firmó Juan…"
              style={{ ...inputStyle, resize: 'none', height: 68 }}
            />

            {/* Photo 1 */}
            <Label>Foto 1 {photo1 ? '✓' : '(requerida para entregado)'}</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <button onClick={() => cam1Ref.current.click()} style={btnStyle('#d4650a')}>📷 Cámara</button>
              <button onClick={() => gal1Ref.current.click()} style={btnStyle('#9c27b0')}>🖼️ Galería</button>
            </div>
            <input ref={cam1Ref} type="file" accept="image/*" capture="environment" onChange={e => handlePhotoFile(e, 1)} style={{ display: 'none' }} />
            <input ref={gal1Ref} type="file" accept="image/*" onChange={e => handlePhotoFile(e, 1)} style={{ display: 'none' }} />
            {photo1 && <img src={photo1} alt="foto1" style={{ width: '100%', borderRadius: 11, maxHeight: 200, objectFit: 'cover', border: '1px solid var(--border)', marginTop: 8 }} />}

            {/* Photo 2 */}
            <Label>Foto 2 (opcional)</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <button onClick={() => cam2Ref.current.click()} style={btnStyle('#555')} disabled={!photo1}>📷 Cámara</button>
              <button onClick={() => gal2Ref.current.click()} style={btnStyle('#555')} disabled={!photo1}>🖼️ Galería</button>
            </div>
            <input ref={cam2Ref} type="file" accept="image/*" capture="environment" onChange={e => handlePhotoFile(e, 2)} style={{ display: 'none' }} />
            <input ref={gal2Ref} type="file" accept="image/*" onChange={e => handlePhotoFile(e, 2)} style={{ display: 'none' }} />
            {photo2 && <img src={photo2} alt="foto2" style={{ width: '100%', borderRadius: 11, maxHeight: 200, objectFit: 'cover', border: '1px solid var(--border)', marginTop: 8 }} />}
          </>
        )}

        {readOnly && (photo1 || photo2) && (
          <div style={{ display: 'grid', gridTemplateColumns: photo2 ? '1fr 1fr' : '1fr', gap: 8, marginTop: 10 }}>
            {photo1 && <img src={photo1} alt="foto1" style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(photo1, '_blank')} />}
            {photo2 && <img src={photo2} alt="foto2" style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(photo2, '_blank')} />}
          </div>
        )}

        {pkg.deliveredAt && (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
            Entregado: {new Date(pkg.deliveredAt).toLocaleString('es-CL')}
          </p>
        )}
        {pkg.note && readOnly && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#3b82f610', borderRadius: 9, fontSize: 12, color: '#3366cc' }}>
            📝 {pkg.note}
          </div>
        )}

        {!readOnly && (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 14, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Guardando…' : '✓ GUARDAR ENTREGA'}
          </button>
        )}

        <button
          onClick={onClose}
          style={{ width: '100%', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}
        >
          {readOnly ? 'Cerrar' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', margin: '13px 0 5px' }}>{children}</div>;
}

function distanceMeters(a, b) {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return null;
  const R = 6371000;
  const toRad = n => Number(n) * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getCurrentPositionSafe() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  });
}

async function captureDeliveryMeta(pkg, status) {
  if (!['entregado', 'no-entregado'].includes(status)) return pkg.deliveryMeta || {};
  const pos = await getCurrentPositionSafe();
  const point = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  const target = pkg.lat && pkg.lng ? { lat: Number(pkg.lat), lng: Number(pkg.lng) } : null;
  const dist = point && target ? distanceMeters(point, target) : null;
  return {
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    accuracy: pos?.coords?.accuracy ?? null,
    distanceMeters: dist != null ? Math.round(dist) : null,
    onPoint: dist != null ? dist <= 180 : null,
    capturedAt: new Date().toISOString(),
    status
  };
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function createFramedDeliveryImage(file, pkg, status) {
  try {
    const img = await loadImageFromFile(file);
    const maxW = 1280;
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const footerH = 150;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h + footerH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, w, h);
    ctx.fillStyle = '#081225';
    ctx.fillRect(0, h, w, footerH);
    ctx.fillStyle = '#0b5cff';
    ctx.fillRect(0, h, w, 8);
    const name = [pkg.customerName, pkg.customerLastName].filter(Boolean).join(' ') || 'Cliente';
    const address = [pkg.address, pkg.aptFloor, pkg.commune].filter(Boolean).join(', ');
    const time = new Date().toLocaleString('es-CL');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px system-ui, Arial';
    ctx.fillText(name, 28, h + 48);
    ctx.font = '24px system-ui, Arial';
    ctx.fillStyle = '#dbe7ff';
    ctx.fillText(`${status === 'entregado' ? 'Entregado' : 'Incidencia'} · ${time}`, 28, h + 84);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px system-ui, Arial';
    wrapText(ctx, address, 28, h + 118, w - 56, 26);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    return blob ? new File([blob], `muve-${pkg.trackingId || Date.now()}.jpg`, { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

const inputStyle = {
  width: '100%', background: 'var(--card2)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px',
  outline: 'none', WebkitAppearance: 'none', display: 'block'
};

function btnStyle(color) {
  return {
    padding: '11px 8px', borderRadius: 10, border: `1px solid ${color}30`,
    background: `${color}12`, color, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
  };
}
