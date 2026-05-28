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
      const vt = (editing.volumeTiers || [])
        .filter(t => t.price !== '' && !isNaN(Number(t.price)))
        .map((t, i) => ({ minQty: i === 0 ? 1 : Number(t.minQty), price: Number(t.price) }))
        .sort((a, b) => a.minQty - b.minQty);

      if (vt.length > 0) {
        for (let i = 1; i < vt.length; i++) {
          if (vt[i].minQty <= vt[i - 1].minQty) return toast('⚠ Los tramos deben tener cantidades crecientes');
        }
      }

      const updated = await api.updateTariff(editing._id, {
        name: editing.name,
        description: editing.description,
        defaultPrice: Number(editing.defaultPrice) || 0,
        volumeTiers: vt,
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

  const DEFAULT_TIERS = [
    { minQty: 1, price: '' },
    { minQty: 2, price: '' },
    { minQty: 6, price: '' },
  ];

  const toggleExpand = (t) => {
    if (expanded === t._id) {
      setExpanded(null);
      setEditing(null);
    } else {
      setExpanded(t._id);
      const vt = t.volumeTiers?.length ? t.volumeTiers.map(v => ({ ...v })) : DEFAULT_TIERS.map(d => ({ ...d }));
      setEditing({ ...t, items: t.items.map(i => ({ ...i })), volumeTiers: vt });
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
                      style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: '#0052FF14', border: '1px solid #0052FF30', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
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

                {/* ── Volume tiers ── */}
                <div style={{ marginTop: 20, padding: '12px 14px', background: '#0052FF06', border: '1px solid #0052FF20', borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: 1, marginBottom: 4 }}>📊 TRAMOS DE VOLUMEN (descuento por cantidad)</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.4 }}>
                    El precio por paquete cambia según cuántos hay en la ruta. Aparece en el PDF del cliente.
                  </div>
                  {(ed.volumeTiers || DEFAULT_TIERS).map((tier, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginBottom: 7, alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                        {idx === 0 ? '1 paquete' : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>≥</span>
                            <input
                              type="number"
                              min={2}
                              value={tier.minQty}
                              onChange={e => setEditing(x => {
                                const vt = [...(x.volumeTiers || DEFAULT_TIERS)];
                                vt[idx] = { ...vt[idx], minQty: e.target.value };
                                return { ...x, volumeTiers: vt };
                              })}
                              style={{ ...tinp, margin: 0, width: 52, padding: '4px 6px', fontSize: 12 }}
                            />
                            <span>pkgs</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>$</span>
                        <input
                          type="number"
                          placeholder="precio por paquete"
                          value={tier.price}
                          onChange={e => setEditing(x => {
                            const vt = [...(x.volumeTiers || DEFAULT_TIERS)];
                            vt[idx] = { ...vt[idx], price: e.target.value };
                            return { ...x, volumeTiers: vt };
                          })}
                          style={{ ...tinp, margin: 0, flex: 1, fontSize: 12 }}
                        />
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                    Ej: 1 pkg → $9.000 · ≥2 pkgs → $6.000 · ≥6 pkgs → $5.000
                  </div>
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
        style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16, width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px #0052FF40', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
