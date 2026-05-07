import React from 'react';

// ── Catalog ───────────────────────────────────────────────────────────────────

export const CATALOG = [
  { id: 'cama1p',      name: 'Cama 1 plaza',    icon: '🛏️', vol: 1.5, cat: 'Dormitorio' },
  { id: 'cama2p',      name: 'Cama 2 plazas',   icon: '🛏️', vol: 2.0, cat: 'Dormitorio' },
  { id: 'camaQueen',   name: 'Cama Queen/King',  icon: '🛏️', vol: 2.8, cat: 'Dormitorio' },
  { id: 'closet',      name: 'Clóset/Ropero',    icon: '🪞', vol: 2.5, cat: 'Dormitorio' },
  { id: 'comoda',      name: 'Cómoda',           icon: '🗄️', vol: 0.8, cat: 'Dormitorio' },
  { id: 'mesaNoche',   name: 'Mesa de noche',    icon: '🪑', vol: 0.3, cat: 'Dormitorio' },
  { id: 'sofa2p',      name: 'Sofá 2 plazas',   icon: '🛋️', vol: 2.0, cat: 'Living' },
  { id: 'sofa3p',      name: 'Sofá 3 plazas',   icon: '🛋️', vol: 3.2, cat: 'Living' },
  { id: 'tvSmall',     name: 'TV hasta 50"',     icon: '📺', vol: 0.3, cat: 'Living' },
  { id: 'tvLarge',     name: 'TV 55" o más',     icon: '📺', vol: 0.6, cat: 'Living' },
  { id: 'mesaComedor', name: 'Mesa comedor',     icon: '🍽️', vol: 1.2, cat: 'Comedor' },
  { id: 'silla',       name: 'Silla (x1)',       icon: '🪑', vol: 0.3, cat: 'Comedor' },
  { id: 'nevera',      name: 'Refrigerador',     icon: '🧊', vol: 1.5, cat: 'Cocina' },
  { id: 'cocina',      name: 'Cocina/Horno',     icon: '🍳', vol: 1.0, cat: 'Cocina' },
  { id: 'microondas',  name: 'Microondas',       icon: '📦', vol: 0.1, cat: 'Cocina' },
  { id: 'lavadora',    name: 'Lavadora',         icon: '🫧', vol: 0.8, cat: 'Electrodomésticos' },
  { id: 'secadora',    name: 'Secadora',         icon: '🌀', vol: 0.8, cat: 'Electrodomésticos' },
  { id: 'escritorio',  name: 'Escritorio',       icon: '💻', vol: 0.8, cat: 'Oficina' },
  { id: 'librero',     name: 'Librero/Estante',  icon: '📚', vol: 1.0, cat: 'Oficina' },
  { id: 'cajaP',       name: 'Caja pequeña',     icon: '📦', vol: 0.08, cat: 'Cajas' },
  { id: 'cajaM',       name: 'Caja mediana',     icon: '📦', vol: 0.18, cat: 'Cajas' },
  { id: 'cajaG',       name: 'Caja grande',      icon: '📦', vol: 0.35, cat: 'Cajas' },
];

export const VEHICLE_THRESHOLDS = [
  { vehicleType: 'furgon',      name: 'Furgón',       icon: '🚐', maxVol: 7,   desc: 'Carga ligera, pocos muebles' },
  { vehicleType: 'camion34',    name: 'Camión 3/4',   icon: '🚚', maxVol: 18,  desc: 'Mudanza familiar completa' },
  { vehicleType: 'camionLargo', name: 'Camión Largo', icon: '🚛', maxVol: 999, desc: 'Mudanza grande o a regiones' },
];

const CATS = [...new Set(CATALOG.map(c => c.cat))];

export function totalVol(inventory) {
  return inventory.reduce((sum, item) => {
    const c = CATALOG.find(x => x.id === item.id);
    return sum + (c ? c.vol * (item.qty || 0) : 0);
  }, 0);
}

export function recommendVehicleType(vol) {
  const v = VEHICLE_THRESHOLDS.find(t => vol <= t.maxVol);
  return (v || VEHICLE_THRESHOLDS[VEHICLE_THRESHOLDS.length - 1]).vehicleType;
}

export function parseInventoryStr(str) {
  if (!str) return { inventory: [], extras: '' };
  try {
    const p = JSON.parse(str);
    if (p && Array.isArray(p.inventory)) return { inventory: p.inventory, extras: p.extras || '' };
  } catch {}
  return { inventory: [], extras: str }; // backward compat: plain text
}

export function serializeInventory(inventory, extras) {
  const active = inventory.filter(i => i.qty > 0);
  if (!active.length && !extras) return '';
  if (!active.length) return extras;
  return JSON.stringify({ inventory: active, extras: extras || '' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InventoryPicker({ inventory, onChange, extras, onExtrasChange, disabled = false }) {
  const [collapsed, setCollapsed] = React.useState({});

  const getQty = id => inventory.find(i => i.id === id)?.qty || 0;

  const setQty = (id, qty) => {
    const next = inventory.filter(i => i.id !== id);
    if (qty > 0) {
      const cat = CATALOG.find(c => c.id === id);
      next.push({ id, name: cat.name, qty });
    }
    onChange(next);
  };

  const toggleCat = cat => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div>
      {/* Items by category — all expanded by default */}
      {CATS.map(cat => {
        const isOpen = !collapsed[cat]; // default open (not in collapsed set)
        return (
        <div key={cat} style={{ marginBottom: 8 }}>
          {/* Category header — clickable to collapse/expand */}
          <button
            type="button"
            onClick={() => toggleCat(cat)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              padding: '5px 2px', marginBottom: isOpen ? 5 : 2,
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#64748b', textTransform: 'uppercase' }}>{cat}</span>
            <span style={{
              fontSize: 9, color: '#94a3b8', display: 'inline-block',
              transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform .2s ease',
            }}>▼</span>
          </button>
          {isOpen && <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {CATALOG.filter(c => c.cat === cat).map(item => {
              const qty = getQty(item.id);
              return (
                <div
                  key={item.id}
                  style={{
                    background: qty > 0 ? '#0052FF08' : '#fff',
                    border: `1.5px solid ${qty > 0 ? 'var(--accent)' : '#e2e8f0'}`,
                    borderRadius: 10, padding: '7px 10px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: qty > 0 ? 700 : 500, color: qty > 0 ? 'var(--accent)' : '#475569', lineHeight: 1.2 }}>
                    {item.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => !disabled && setQty(item.id, Math.max(0, qty - 1))}
                      disabled={disabled || qty === 0}
                      style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 15, fontWeight: 700, cursor: (disabled || qty === 0) ? 'not-allowed' : 'pointer', color: qty === 0 ? '#cbd5e1' : '#0f172a', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}>−</button>
                    <span style={{ fontSize: 13, fontWeight: 800, minWidth: 18, textAlign: 'center', color: qty > 0 ? 'var(--accent)' : '#94a3b8' }}>{qty}</span>
                    <button
                      type="button"
                      onClick={() => !disabled && setQty(item.id, qty + 1)}
                      disabled={disabled}
                      style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #e2e8f0', background: qty > 0 ? 'var(--accent)' : '#fff', fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', color: qty > 0 ? '#fff' : '#0f172a', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}>+</button>
                  </div>
                </div>
              );
            })}
          </div>}
        </div>
        );
      })}

      {/* Free-text extras */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#94a3b8', textTransform: 'uppercase', margin: '6px 0 4px' }}>Otros artículos o cosas adicionales</div>
        <textarea
          value={extras}
          onChange={e => !disabled && onExtrasChange(e.target.value)}
          placeholder="Piano, moto, bicicleta, cuadros frágiles, herramientas, colchón…"
          rows={2}
          disabled={disabled}
          style={{ width: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, color: '#0f172a', fontSize: 13, padding: '9px 11px', outline: 'none', display: 'block', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </div>
    </div>
  );
}
