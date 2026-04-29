import React, { useState } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

// Client-side price suggestion by commune
const COMMUNE_PRICES = {
  'santiago': 3000, 'estacion central': 3000, 'san joaquin': 3000,
  'la granja': 3000, 'pedro aguirre cerda': 3000, 'lo espejo': 3000,
  'cerrillos': 3000, 'maipu': 3000, 'maipú': 3000,
  'providencia': 3500, 'nunoa': 3500, 'ñuñoa': 3500, 'macul': 3500,
  'la florida': 3500, 'penalolen': 3500, 'peñalolén': 3500,
  'las condes': 3500, 'la reina': 3500, 'quilicura': 3500,
  'vitacura': 4000,
  'lo barnechea': 4500,
  'colina': 5000, 'chicureo': 5000, 'lampa': 5000,
  'pudahuel': 3500, 'renca': 3000,
  'puente alto': 4000, 'la pintana': 3500, 'san bernardo': 4000,
  'el bosque': 3500, 'buin': 4500, 'paine': 5000,
};

function normalize(str) {
  return (str || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function suggestPrice(commune) {
  return COMMUNE_PRICES[normalize(commune)] || 3500;
}

const PRICE_OPTIONS = [2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 7000, 8000, 10000, 11500];

export default function AddPackageModal({ routeId, onClose, onCreated }) {
  const [form, setForm] = useState({
    customerName: '', customerLastName: '', customerPhone: '',
    address: '', commune: '', aptFloor: '', zone: '',
    price: 3500, lat: '', lng: ''
  });
  const [priceSuggested, setPriceSuggested] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCommuneChange = (val) => {
    set('commune', val);
    if (val.length > 2) {
      const suggested = suggestPrice(val);
      set('price', suggested);
      setPriceSuggested(true);
    }
  };

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
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 800, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '95dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000015' }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 13 }}>➕ Agregar paquete</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Nombre *" value={form.customerName} onChange={v => set('customerName', v)} placeholder="María" />
          <Field label="Apellido" value={form.customerLastName} onChange={v => set('customerLastName', v)} placeholder="González" />
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Teléfono" value={form.customerPhone} onChange={v => set('customerPhone', v)} placeholder="+56912345678" type="tel" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Dirección *" value={form.address} onChange={v => set('address', v)} placeholder="Av. Providencia 1100" />
          </div>

          {/* Comuna with price suggestion */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 5 }}>
              Comuna
            </div>
            <input
              value={form.commune}
              onChange={e => handleCommuneChange(e.target.value)}
              placeholder="Providencia"
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none' }}
            />
          </div>

          <Field label="Depto/Casa" value={form.aptFloor} onChange={v => set('aptFloor', v)} placeholder="Dpto 202" />
          <Field label="Zona" value={form.zone} onChange={v => set('zone', v)} placeholder="Las Condes" />

          {/* Price with suggestion indicator */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
              Precio CLP
              {priceSuggested && (
                <span style={{ fontSize: 9, background: '#d4650a15', color: '#d4650a', border: '1px solid #d4650a28', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>
                  SUGERIDO
                </span>
              )}
            </div>
            <select
              value={form.price}
              onChange={e => { set('price', Number(e.target.value)); setPriceSuggested(false); }}
              style={{ width: '100%', background: priceSuggested ? '#d4650a08' : 'var(--card2)', border: `1px solid ${priceSuggested ? '#d4650a30' : 'var(--border)'}`, borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none', WebkitAppearance: 'none' }}
            >
              {PRICE_OPTIONS.map(p => (
                <option key={p} value={p}>${p.toLocaleString('es-CL')}</option>
              ))}
            </select>
          </div>

          <Field label="Lat (opcional)" value={form.lat} onChange={v => set('lat', v)} placeholder="-33.4296" type="number" step="any" />
          <div style={{ gridColumn: '2/-1' }}>
            <Field label="Lng (opcional)" value={form.lng} onChange={v => set('lng', v)} placeholder="-70.6226" type="number" step="any" />
          </div>
        </div>

        {priceSuggested && form.commune && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#d4650a08', border: '1px solid #d4650a20', borderRadius: 9, fontSize: 12, color: '#d4650a' }}>
            💡 Precio sugerido para <b>{form.commune}</b>: ${Number(form.price).toLocaleString('es-CL')} — puedes cambiarlo arriba
          </div>
        )}

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 14, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
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
      <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none' }} />
    </div>
  );
}
