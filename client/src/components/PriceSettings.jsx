import React, { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import { toast } from './Toast.jsx';

const inp = {
  width: '100%', background: 'var(--card2)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14,
  padding: '9px 12px', outline: 'none', boxSizing: 'border-box'
};

export default function PriceSettings() {
  const [prices, setPrices] = useState([]);
  const [defaultPrice, setDefaultPrice] = useState(3500);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCommune, setEditCommune] = useState('');
  const [editZone, setEditZone] = useState('');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCommune, setNewCommune] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newZone, setNewZone] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getPrices();
      setPrices(data.prices || []);
      setDefaultPrice(data.defaultPrice || 3500);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setLoading(false); }
  };

  const startEdit = (p) => {
    setEditId(p._id);
    setEditCommune(p.commune);
    setEditPrice(String(p.price));
    setEditZone(p.zone || '');
  };

  const cancelEdit = () => { setEditId(null); setEditCommune(''); setEditPrice(''); setEditZone(''); };

  const saveEdit = async () => {
    if (!editPrice || isNaN(Number(editPrice))) return toast('⚠ Precio inválido');
    setSaving(true);
    try {
      const updated = await api.updatePrice(editId, { commune: editCommune, price: Number(editPrice), zone: editZone });
      setPrices(prev => prev.map(p => p._id === editId ? updated : p));
      cancelEdit();
      toast('✅ Precio actualizado');
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const saveNew = async () => {
    if (!newCommune.trim()) return toast('⚠ Escribe el nombre de la comuna');
    if (!newPrice || isNaN(Number(newPrice))) return toast('⚠ Precio inválido');
    setSaving(true);
    try {
      const created = await api.upsertPrice({ commune: newCommune.trim(), price: Number(newPrice), zone: newZone.trim() });
      setPrices(prev => [...prev, created].sort((a, b) => a.commune.localeCompare(b.commune)));
      setNewCommune(''); setNewPrice(''); setNewZone('');
      setAdding(false);
      toast('✅ Comuna agregada');
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await api.deletePrice(id);
      setPrices(prev => prev.filter(p => p._id !== id));
      toast('🗑️ Eliminado');
    } catch (err) { toast('❌ ' + err.message); }
    finally { setDeleting(null); }
  };

  const filtered = prices.filter(p =>
    !search || p.commune.toLowerCase().includes(search.toLowerCase()) || (p.zone || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Cargando precios…</div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Search + add bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '10px 12px', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar comuna o zona…"
          style={{ ...inp, marginBottom: 8 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {filtered.length} comunas · Precio por defecto: <b>${defaultPrice.toLocaleString('es-CL')}</b>
          </span>
          <button
            onClick={() => { setAdding(v => !v); setNewCommune(''); setNewPrice(''); setNewZone(''); }}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            {adding ? '✕ Cancelar' : '＋ Nueva comuna'}
          </button>
        </div>

        {adding && (
          <div style={{ background: 'var(--card2)', border: '1px solid var(--accent)40', borderRadius: 12, padding: '12px', marginTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 8 }}>
              <input value={newCommune} onChange={e => setNewCommune(e.target.value)} placeholder="Nombre de la comuna" style={inp} />
              <input value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Precio" type="number" style={inp} />
            </div>
            <input value={newZone} onChange={e => setNewZone(e.target.value)} placeholder="Zona / sector (opcional)" style={{ ...inp, marginBottom: 10 }} />
            <button
              onClick={saveNew}
              disabled={saving}
              style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? '⏳ Guardando…' : '✅ Agregar'}
            </button>
          </div>
        )}
      </div>

      {/* Price list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px calc(20px + env(safe-area-inset-bottom))' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13 }}>
            {search ? '🔍 Sin resultados' : '📋 No hay comunas configuradas'}
          </div>
        ) : filtered.map(p => (
          <div key={p._id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${editId === p._id ? 'var(--accent)' : 'var(--border)'}`, marginBottom: 8, padding: '11px 13px', transition: 'border-color .15s' }}>
            {editId === p._id ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 8 }}>
                  <input value={editCommune} onChange={e => setEditCommune(e.target.value)} placeholder="Comuna" style={inp} />
                  <input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number" placeholder="Precio" style={inp} />
                </div>
                <input value={editZone} onChange={e => setEditZone(e.target.value)} placeholder="Zona / sector (opcional)" style={{ ...inp, marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit} disabled={saving} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? '⏳' : '✅ Guardar'}
                  </button>
                  <button onClick={cancelEdit} style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✕ Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{p.commune}</div>
                  {p.zone && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Zona: {p.zone}</div>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', flexShrink: 0 }}>
                  ${Number(p.price).toLocaleString('es-CL')}
                </div>
                <button onClick={() => startEdit(p)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>✏️</button>
                <button
                  onClick={() => { if (confirm(`¿Eliminar precio para ${p.commune}?`)) handleDelete(p._id); }}
                  disabled={deleting === p._id}
                  style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #cc224430', background: 'none', color: '#cc2244', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >🗑️</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
