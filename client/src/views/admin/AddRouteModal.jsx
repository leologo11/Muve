import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

export default function AddRouteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().slice(0, 10), driverId: '', companyId: '', status: 'draft' });
  const [drivers, setDrivers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getUsers().then(users => setDrivers(users.filter(u => u.role === 'driver' && u.active))).catch(() => {});
    api.getCompanies().then(setCompanies).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const route = await api.createRoute({
        ...form,
        driverId: form.driverId || undefined,
        companyId: form.companyId || undefined
      });
      toast('✅ Ruta creada: ' + route.routeCode);
      onCreated(route);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 800, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000015' }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 13 }}>🗺 Nueva Ruta</h2>

        <Label>Nombre (opcional)</Label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Ruta Lunes Zona Norte" style={inp} />

        <Label>Fecha</Label>
        <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} />

        <Label>Estado</Label>
        <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
          <option value="draft">Borrador</option>
          <option value="active">Activa</option>
        </select>

        <Label>Driver (opcional)</Label>
        <select value={form.driverId} onChange={e => set('driverId', e.target.value)} style={inp}>
          <option value="">Sin asignar</option>
          {drivers.map(d => <option key={d._id} value={d._id}>{d.name} ({d.email})</option>)}
        </select>

        <Label>Empresa (opcional)</Label>
        <select value={form.companyId} onChange={e => set('companyId', e.target.value)} style={inp}>
          <option value="">Sin empresa</option>
          {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 14, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Creando…' : '✓ CREAR RUTA'}
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}>Cancelar</button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', margin: '13px 0 5px' }}>{children}</div>;
}

const inp = { width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none', display: 'block', WebkitAppearance: 'none' };
