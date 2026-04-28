import React, { useState } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

export default function AddPackageModal({ routeId, onClose, onCreated }) {
  const [form, setForm] = useState({ customerName: '', customerLastName: '', customerPhone: '', address: '', commune: '', aptFloor: '', zone: '', price: '', lat: '', lng: '' });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.customerName || !form.address) return toast('⚠️ Nombre y dirección requeridos');
    setSaving(true);
    try {
      await api.createPackage({
        routeId,
        ...form,
        price: Number(form.price) || 0,
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined
      });
      toast('✅ Paquete agregado');
      onCreated();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 800, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '95dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000015' }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 13 }}>➕ Agregar paquete</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Nombre" value={form.customerName} onChange={v => set('customerName', v)} placeholder="María" />
          <Field label="Apellido" value={form.customerLastName} onChange={v => set('customerLastName', v)} placeholder="González" />
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Teléfono" value={form.customerPhone} onChange={v => set('customerPhone', v)} placeholder="+56912345678" type="tel" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Dirección" value={form.address} onChange={v => set('address', v)} placeholder="Av. Providencia 1100" />
          </div>
          <Field label="Comuna" value={form.commune} onChange={v => set('commune', v)} placeholder="Providencia" />
          <Field label="Depto/Casa" value={form.aptFloor} onChange={v => set('aptFloor', v)} placeholder="Dpto 202" />
          <Field label="Zona" value={form.zone} onChange={v => set('zone', v)} placeholder="Las Condes" />
          <Field label="Precio (CLP)" value={form.price} onChange={v => set('price', v)} placeholder="3500" type="number" />
          <Field label="Lat (opcional)" value={form.lat} onChange={v => set('lat', v)} placeholder="-33.4296" type="number" step="any" />
          <Field label="Lng (opcional)" value={form.lng} onChange={v => set('lng', v)} placeholder="-70.6226" type="number" step="any" />
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 12, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Guardando…' : '✓ AGREGAR A LA RUTA'}
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}>Cancelar</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', step }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <input
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none' }}
      />
    </div>
  );
}
