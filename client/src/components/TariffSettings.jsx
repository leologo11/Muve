import React, { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import { toast } from './Toast.jsx';

export default function TariffSettings() {
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setTariffs(await api.getTariffs()); }
    catch (err) { toast('❌ ' + err.message); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      const t = await api.createTariff({ name: 'Nueva configuración', defaultPrice: 3500, items: [] });
      setTariffs(prev => [t, ...prev]);
      setExpanded(t._id);
      setEditing({ ...t });
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleSave = async () => {
    try {
      const updated = await api.updateTariff(editing._id, {
        name: editing.name,
        description: editing.description,
        defaultPrice: Number(editing.defaultPrice) || 0,
        items: editing.items.map(i => ({ commune: i.commune, price: Number(i.price) || 0, zone: i.zone || '' }))
      });
      setTariffs(prev => prev.map(t => t._id === updated._id ? updated : t));
      setEditing(null);
      toast('✅ Guardado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleDuplicate = async (id, e) => {
    e.stopPropagation();
    try {
      const copy = await api.duplicateTariff(id);
      setTariffs(prev => [copy, ...prev]);
      toast('✅ Duplicado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta configuración de precios?')) return;
    try {
      await api.deleteTariff(id);
      setTariffs(prev => prev.filter(t => t._id !== id));
      if (expanded === id) { setExpanded(null); setEditing(null); }
      toast('🗑️ Eliminado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const toggleExpand = (t) => {
    if (expanded === t._id) {
      setExpanded(null);
      setEditing(null);
    } else {
      setExpanded(t._id);
      setEditing({ ...t, items: t.items.map(i => ({ ...i })) });
    }
  };

  const addItem = () => setEditing(e => ({ ...e, items: [...e.items, { commune: '', price: e.defaultPrice, zone: '' }] }));
  const removeItem = (i) => setEditing(e => ({ ...e, items: e.items.filter((_, idx) => idx !== i) }));
  const setItem = (i, field, val) => setEditing(e => {
    const items = [...e.items];
    items[i] = { ...items[i], [field]: val };
    return { ...e, items };
  });

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px calc(90px + env(safe-area-inset-bottom))' }}>
      {tariffs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <p style={{ fontSize: 14 }}>No hay configuraciones de precios aún.</p>
          <p style={{ fontSize: 12 }}>Crea una y asígnala a tus rutas.</p>
        </div>
      )}

      {tariffs.map(t => {
        const isOpen = expanded === t._id;
        const ed = isOpen ? editing : null;

        return (
          <div key={t._id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px #0000000a' }}>
            <div
              onClick={() => toggleExpand(t)}
              style={{ padding: '13px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                {t.description && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.description}</div>}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                  {t.items.length} {t.items.length === 1 ? 'comuna' : 'comunas'} · Base: ${(t.defaultPrice || 0).toLocaleString('es-CL')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <SmBtn color="#0077aa" onClick={e => handleDuplicate(t._id, e)}>⧉ Duplicar</SmBtn>
                <SmBtn color="#cc2244" onClick={e => handleDelete(t._id, e)}>🗑</SmBtn>
              </div>
              <span style={{ color: 'var(--muted)', fontSize: 14, marginLeft: 4 }}>{isOpen ? '▴' : '▾'}</span>
            </div>

            {isOpen && ed && (
              <div style={{ padding: '4px 14px 16px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <TLabel>Nombre de la configuración</TLabel>
                    <input value={ed.name} onChange={e => setEditing(x => ({ ...x, name: e.target.value }))} style={tinp} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <TLabel>Descripción (opcional)</TLabel>
                    <input
                      value={ed.description || ''}
                      onChange={e => setEditing(x => ({ ...x, description: e.target.value }))}
                      placeholder="Ej: Config para clientes zona norte"
                      style={tinp}
                    />
                  </div>
                  <div>
                    <TLabel>Precio base (sin comuna específica)</TLabel>
                    <input
                      type="number"
                      value={ed.defaultPrice}
                      onChange={e => setEditing(x => ({ ...x, defaultPrice: e.target.value }))}
                      style={tinp}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <TLabel style={{ margin: 0 }}>Precios por comuna</TLabel>
                    <button
                      onClick={addItem}
                      style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: '#00885514', border: '1px solid #00885530', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
                    >
                      + Agregar comuna
                    </button>
                  </div>

                  {ed.items.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '14px 0', background: 'var(--card2)', borderRadius: 10 }}>
                      Sin comunas específicas — se aplicará el precio base a todos los paquetes
                    </div>
                  )}

                  {ed.items.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                      <input
                        placeholder="Nombre de la comuna"
                        value={item.commune}
                        onChange={e => setItem(i, 'commune', e.target.value)}
                        style={{ ...tinp, margin: 0 }}
                      />
                      <input
                        type="number"
                        placeholder="Precio"
                        value={item.price}
                        onChange={e => setItem(i, 'price', e.target.value)}
                        style={{ ...tinp, margin: 0 }}
                      />
                      <button
                        onClick={() => removeItem(i)}
                        style={{ width: 32, height: 32, borderRadius: '50%', background: '#cc224412', border: '1px solid #cc224430', color: '#cc2244', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSave}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: 'none', marginTop: 14, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  ✓ Guardar cambios
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={handleCreate}
        style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16, width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px #00885540', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        ＋
      </button>
    </div>
  );
}

function SmBtn({ color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: '4px 9px', borderRadius: 8, border: `1px solid ${color}30`, background: `${color}12`, color, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
    >
      {children}
    </button>
  );
}

function TLabel({ children, style }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4, ...style }}>
      {children}
    </div>
  );
}

const tinp = {
  width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10,
  color: 'var(--text)', fontSize: 13, padding: '8px 10px', outline: 'none',
  display: 'block', boxSizing: 'border-box'
};
