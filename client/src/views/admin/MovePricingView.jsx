import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

const VEHICLE_ICONS = { furgon: '🚐', camion34: '🚚', camionLargo: '🚛' };
const fmt = n => Number(n || 0).toLocaleString('es-CL');

// Build human-readable tier ranges: [{from, to, ppk}, ...]
function buildRanges(tiers) {
  const sorted = [...(tiers || [])].sort((a, b) => a.max_km - b.max_km);
  let prev = 0;
  return sorted.map(t => {
    const range = { from: prev + 1, to: t.max_km, ppk: t.price_per_km, max_km: t.max_km };
    prev = t.max_km;
    return range;
  });
}

export default function MovePricingView() {
  const [configs, setConfigs] = useState([]);
  const [serviceTab, setServiceTab] = useState('flete');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    api.getVehicleConfigs()
      .then(setConfigs)
      .catch(err => toast('❌ ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const reload = () => api.getVehicleConfigs().then(setConfigs).catch(() => {});

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Cargando configuraciones…</div>;

  if (!configs.length) return (
    <div style={{ padding: '20px 14px' }}>
      <div style={{ background: '#fff7ed', border: '1px solid #f97316', borderRadius: 14, padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontWeight: 800, color: '#c2410c', marginBottom: 8 }}>Migración SQL pendiente</div>
        <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
          La tabla <code>vehicle_configs</code> no existe aún.<br />
          Ve a <strong>Supabase → SQL Editor</strong> y ejecuta el contenido de:<br />
          <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>supabase/vehicle_pricing.sql</code>
        </div>
      </div>
    </div>
  );

  const visibleConfigs = configs.filter(c => (c.serviceType || 'flete') === serviceTab);
  const isMudanza = serviceTab === 'mudanza';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px calc(90px + env(safe-area-inset-bottom))' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '0 0 12px' }}>
        {[
          ['flete', 'Fletes', 'Por volumen + camion sugerido'],
          ['mudanza', 'Mudanzas', 'Camion completo + base mayor'],
        ].map(([id, title, sub]) => (
          <button
            key={id}
            onClick={() => setServiceTab(id)}
            style={{
              padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              border: `1.5px solid ${serviceTab === id ? 'var(--accent)' : 'var(--border)'}`,
              background: serviceTab === id ? '#EEF4FF' : '#fff',
              color: serviceTab === id ? 'var(--accent)' : 'var(--text)',
              fontWeight: 800,
            }}
          >
            <div style={{ fontSize: 14 }}>{title}</div>
            <div style={{ fontSize: 10, color: serviceTab === id ? '#0052FF90' : 'var(--muted)', marginTop: 2 }}>{sub}</div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, margin: '6px 0 16px', padding: '10px 12px', background: 'var(--card2)', borderRadius: 10, border: '1px solid var(--border)' }}>
        💡 Los precios aplican inmediatamente en la landing pública. El sistema cotiza según el tramo en que cae la distancia total del viaje.
      </div>

      {visibleConfigs.length === 0 && (
        <div style={{ padding: 18, borderRadius: 14, border: '1px solid #f59e0b50', background: '#fff7ed', color: '#92400e', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
          Aun no hay precios separados para {isMudanza ? 'mudanzas' : 'fletes'}. Ejecuta la migracion SQL nueva en Supabase para crear esta seccion.
        </div>
      )}

      {visibleConfigs.map(cfg => (
        <VehicleCard
          key={cfg._id || cfg.id}
          config={cfg}
          serviceType={serviceTab}
          onEdit={() => setEditing(cfg)}
          onToggleActive={async () => {
            try {
              await api.updateVehicleConfig(cfg._id || cfg.id, { active: !cfg.active });
              reload();
              toast(cfg.active ? 'Vehículo desactivado' : 'Vehículo activado');
            } catch (err) { toast('❌ ' + err.message); }
          }}
        />
      ))}

      {editing && (
        <EditModal
          config={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); toast('✅ Precios actualizados'); }}
        />
      )}
    </div>
  );
}

// ── Vehicle config card ───────────────────────────────────────────────────────

function VehicleCard({ config: c, serviceType = 'flete', onEdit, onToggleActive }) {
  const ranges = buildRanges(c.kmTiers);
  const ex = c.extras || {};
  const isMudanza = serviceType === 'mudanza';

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 14, overflow: 'hidden', opacity: c.active ? 1 : 0.55 }}>
      {/* Header */}
      <div style={{ padding: '13px 14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{VEHICLE_ICONS[c.vehicleType] || '🚚'}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{c.description}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onEdit} style={btn('var(--accent)')}>✏️ Editar</button>
          <button onClick={onToggleActive} style={btn(c.active ? '#cc2244' : '#0077aa')}>
            {c.active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

      {/* Pricing tables */}
      <div style={{ padding: '12px 14px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        {/* Base price */}
        <div style={{ background: '#f4f7ff', border: '1px solid #0052FF20', borderRadius: 11, padding: '10px 12px', gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#0052FF80', marginBottom: 4 }}>PRECIO BASE DEL SERVICIO</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)' }}>${fmt(c.basePrice)}</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Se cobra siempre, independiente de la distancia</div>
        </div>

        {/* Km tiers */}
        <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 12px', gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 10 }}>TARIFAS POR KM (aplica a TODA la distancia según tramo)</div>
          {ranges.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < ranges.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: `hsl(${220 - i * 30}, 70%, 55%)`, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#475569' }}>
                  {r.from === 1 ? '0' : r.from} — {r.to >= 9000 ? '∞' : r.to} km
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>${fmt(r.ppk)}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}> /km</span>
              </div>
            </div>
          ))}
          {/* Example calculation */}
          {ranges.length > 0 && (
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#0052FF08', borderRadius: 7, fontSize: 10, color: '#0052FF90' }}>
              Ejemplo 30 km: base ${fmt(c.basePrice)} + (30 × ${fmt(ranges[0]?.ppk)}/km) = <strong>${fmt(c.basePrice + 30 * (ranges[0]?.ppk || 0))}</strong>
            </div>
          )}
        </div>

        {/* Servicio de carga */}
        <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 12px', gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 8 }}>SERVICIO DE CARGA</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 6px', background: '#fff', border: '1px solid var(--border)', borderRadius: 9 }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', margin: '2px 0 4px', lineHeight: 1.3 }}>Solo traslado<br/><span style={{color:'#94a3b8'}}>chofer solo conduce</span></div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>$0</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 6px', background: '#EEF4FF', border: '2px solid #0052FF40', borderRadius: 9 }}>
              <div style={{ fontSize: 9, color: '#0052FF90', margin: '2px 0 4px', lineHeight: 1.3 }}>+ Ayuda del chofer<br/><span style={{color:'#0052FF70'}}>carga y descarga</span></div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--accent)' }}>${fmt(ex.driver_help)}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px 6px', background: '#fff', border: '1px solid var(--border)', borderRadius: 9 }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', margin: '2px 0 4px', lineHeight: 1.3 }}>Ayudante adicional<br/><span style={{color:'#94a3b8'}}>por persona extra</span></div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>${fmt(ex.helper)}</div>
            </div>
          </div>
          {/* Pricing examples */}
          {ranges.length > 0 && (() => {
            const base = Number(c.basePrice || 0);
            const ppk  = Number(ranges[0]?.ppk || 0);
            const km30 = base + 30 * ppk;
            return (
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#0052FF06', borderRadius: 8, fontSize: 10, color: '#475569', lineHeight: 1.9 }}>
                <strong style={{ color: '#0052FF' }}>Ejemplos a 30 km:</strong><br/>
                🚗 Solo traslado: <strong>${fmt(km30)}</strong><br/>
                👷 + Ayuda chofer: <strong>${fmt(km30 + Number(ex.driver_help || 0))}</strong><br/>
                👷👷 + Chofer y 1 ayudante: <strong>${fmt(km30 + Number(ex.driver_help || 0) + Number(ex.helper || 0))}</strong>
              </div>
            );
          })()}
        </div>

        {/* Other extras */}
        <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 12px', gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 8 }}>OTROS EXTRAS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <ExtraStat icon="🏢" label="Piso sin ascensor" value={ex.floor} />
            <ExtraStat icon="📦" label="Embalaje profesional" value={ex.packing} />
            {!isMudanza && <ExtraStat icon="m3" label="m3 incluido" value={ex.included_m3 ?? 3} unit=" m3" money={false} />}
            {!isMudanza && <ExtraStat icon="m3" label="m3 adicional" value={ex.extra_m3} unit="/m3" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExtraStat({ icon, label, value, unit = '', money = true }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 6px', background: '#fff', border: '1px solid var(--border)', borderRadius: 9 }}>
      <div style={{ fontSize: 16 }}>{icon}</div>
      <div style={{ fontSize: 9, color: 'var(--muted)', margin: '2px 0' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{money ? '$' : ''}{fmt(value)}<span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)' }}>{unit}</span></div>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({ config: c, onClose, onSaved }) {
  const isMudanza = (c.serviceType || 'flete') === 'mudanza';
  const [name,        setName]        = useState(c.name);
  const [description, setDescription] = useState(c.description);
  const [basePrice,   setBasePrice]   = useState(c.basePrice);
  const [onlyRegions, setOnlyRegions] = useState(c.onlyRegions);
  const [tiers, setTiers] = useState(
    (c.kmTiers || []).slice().sort((a, b) => a.max_km - b.max_km)
      .map(t => ({ max_km: String(t.max_km), ppk: String(t.price_per_km) }))
  );
  const [extras, setExtras] = useState({
    driver_help: c.extras?.driver_help ?? 20000,
    helper:      c.extras?.helper      ?? 15000,
    floor:       c.extras?.floor       ?? 5000,
    packing:     c.extras?.packing     ?? 15000,
    included_m3: c.extras?.included_m3 ?? 3,
    extra_m3:    c.extras?.extra_m3    ?? 16000,
  });
  const [saving, setSaving] = useState(false);

  const addTier  = () => setTiers(t => [...t, { max_km: '', ppk: '' }]);
  const removeTier = i => setTiers(t => t.filter((_, idx) => idx !== i));
  const setTier  = (i, k, v) => setTiers(t => { const n = [...t]; n[i] = { ...n[i], [k]: v }; return n; });
  const setExtra = (k, v) => setExtras(e => ({ ...e, [k]: Number(v) }));

  // Preview ranges
  const previewRanges = buildRanges(
    tiers.filter(t => t.max_km && t.ppk).map(t => ({ max_km: Number(t.max_km), price_per_km: Number(t.ppk) }))
  );

  const handleSave = async () => {
    const kmTiers = tiers
      .filter(t => t.max_km && t.ppk)
      .map(t => ({ max_km: Number(t.max_km), price_per_km: Number(t.ppk) }))
      .sort((a, b) => a.max_km - b.max_km);
    if (!kmTiers.length) return toast('Agrega al menos un tramo de km');
    setSaving(true);
    try {
      await api.updateVehicleConfig(c._id || c.id, {
        name, description, basePrice: Number(basePrice), onlyRegions, kmTiers, extras,
      });
      onSaved();
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '96dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000020' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{VEHICLE_ICONS[c.vehicleType]} Editar {c.name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>✕</button>
        </div>

        <FL>Nombre del vehículo</FL>
        <input value={name} onChange={e => setName(e.target.value)} style={inp} />
        <FL>Descripción (visible en landing)</FL>
        <input value={description} onChange={e => setDescription(e.target.value)} style={inp} />

        <FL>Precio base (CLP)</FL>
        <input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} style={inp} />
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -6, marginBottom: 8 }}>Se cobra siempre independiente de la distancia</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '10px 0 16px', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyRegions} onChange={e => setOnlyRegions(e.target.checked)} />
          Solo disponible para viajes a regiones (distancia &gt; 100 km)
        </label>

        {/* Km tiers */}
        <div style={{ background: '#f8fbff', border: '1px solid #0052FF20', borderRadius: 12, padding: '13px 13px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: 'var(--accent)', marginBottom: 4 }}>TRAMOS DE PRECIO POR KM</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
            Cada tramo define el precio por km para toda la distancia si el viaje cae en ese rango.<br />
            El último tramo (km máximo muy alto, ej. 9999) actúa como "todo lo demás".
          </div>

          {/* Preview */}
          {previewRanges.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: 'var(--muted)', marginBottom: 6 }}>VISTA PREVIA DE TRAMOS</div>
              {previewRanges.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < previewRanges.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 12 }}>
                  <span style={{ color: '#475569' }}>
                    {r.from === 1 ? '0' : r.from} – {r.to >= 9000 ? '∞' : r.to} km
                  </span>
                  <span style={{ fontWeight: 800, color: 'var(--accent)' }}>${fmt(r.ppk)}/km</span>
                </div>
              ))}
            </div>
          )}

          {tiers.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <FL>Hasta km</FL>
                <input
                  type="number"
                  value={t.max_km}
                  onChange={e => setTier(i, 'max_km', e.target.value)}
                  placeholder="ej: 50"
                  style={inp}
                />
              </div>
              <div style={{ flex: 1 }}>
                <FL>$ por km</FL>
                <input
                  type="number"
                  value={t.ppk}
                  onChange={e => setTier(i, 'ppk', e.target.value)}
                  placeholder="ej: 1000"
                  style={inp}
                />
              </div>
              <button onClick={() => removeTier(i)} style={{ marginBottom: 1, padding: '9px 10px', background: 'none', border: '1px solid #fca5a5', borderRadius: 9, color: '#cc2244', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>✕</button>
            </div>
          ))}
          <button onClick={addTier} style={{ width: '100%', padding: 9, borderRadius: 9, border: '1px dashed var(--border)', background: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            + Agregar tramo de km
          </button>
        </div>

        {/* Servicio de carga */}
        <div style={{ background: '#f8fbff', border: '1px solid #0052FF20', borderRadius: 12, padding: '13px 13px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: 'var(--accent)', marginBottom: 4 }}>SERVICIO DE CARGA</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
            El cliente elige el nivel de servicio. "Solo traslado" no tiene costo extra — el precio es base + km.
          </div>
          <div>
            <FL>🚗 Solo traslado (costo adicional)</FL>
            <input type="number" value={0} disabled style={{ ...inp, background: '#f1f5f9', color: '#94a3b8' }} />
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, marginBottom: 10 }}>Sin cobro extra — cliente carga y descarga por su cuenta</div>
          </div>
          <div>
            <FL>👷 Ayuda del chofer (costo fijo)</FL>
            <input type="number" value={extras.driver_help} onChange={e => setExtra('driver_help', e.target.value)} style={inp} />
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, marginBottom: 10 }}>Se suma cuando el cliente pide que el chofer ayude a cargar y descargar</div>
          </div>
          <div>
            <FL>👷+ Ayudante adicional (por persona)</FL>
            <input type="number" value={extras.helper} onChange={e => setExtra('helper', e.target.value)} style={inp} />
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Precio por cada ayudante extra además del chofer. Se multiplica por la cantidad indicada</div>
          </div>
          {/* Live preview */}
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#EEF4FF', borderRadius: 10, fontSize: 11, color: '#0052FF', lineHeight: 2 }}>
            <strong>Vista previa del servicio de carga:</strong><br/>
            🚗 Solo traslado → +$0<br/>
            👷 + Ayuda del chofer → +${fmt(extras.driver_help)}<br/>
            👷👷 + Chofer y 2 ayudantes → +${fmt(Number(extras.driver_help) + 2 * Number(extras.helper))}
          </div>
        </div>

        {/* Other extras */}
        <div style={{ background: '#f8fbff', border: '1px solid #0052FF20', borderRadius: 12, padding: '13px 13px', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: 'var(--accent)', marginBottom: 12 }}>OTROS EXTRAS (se suman al total)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <FL>🏢 Piso sin ascensor</FL>
              <input type="number" value={extras.floor} onChange={e => setExtra('floor', e.target.value)} style={inp} />
            </div>
            <div>
              <FL>📦 Embalaje</FL>
              <input type="number" value={extras.packing} onChange={e => setExtra('packing', e.target.value)} style={inp} />
            </div>
            {!isMudanza && (
              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <FL>m3 incluidos gratis</FL>
                  <input type="number" min="0" step="0.1" value={extras.included_m3} onChange={e => setExtra('included_m3', e.target.value)} style={inp} />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Volumen incluido antes de cobrar adicional.</div>
                </div>
                <div>
                  <FL>m3 adicional</FL>
                  <input type="number" value={extras.extra_m3} onChange={e => setExtra('extra_m3', e.target.value)} style={inp} />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Precio por cada m3 sobre el volumen incluido.</div>
                </div>
              </div>
            )}
            {isMudanza && (
              <div style={{ gridColumn: '1 / -1', padding: '10px 12px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 11, lineHeight: 1.45 }}>
                En mudanzas no se cobra m3 adicional. Ajusta el precio base del camion para reflejar que se vende como camion completo.
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', marginBottom: 8 }}
        >
          {saving ? 'Guardando…' : '✓ Guardar precios'}
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FL({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: 'var(--muted)', textTransform: 'uppercase', margin: '8px 0 3px' }}>{children}</div>;
}

const inp = { width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 14, padding: '9px 12px', outline: 'none', display: 'block', boxSizing: 'border-box', WebkitAppearance: 'none' };

function btn(color) {
  return { padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${color}30`, background: `${color}12`, color };
}
