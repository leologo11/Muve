import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';

function normalize(str) {
  return (str || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function suggestPriceFromZone(zones, commune) {
  if (!zones?.length || !commune) return null;
  const zone = zones.find(z => normalize(z.name) === normalize(commune));
  return zone?.price ?? null;
}

export default function AddPackageModal({ routeId, onClose, onCreated }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'import'

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 800, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '95dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000015' }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 14px' }} />

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 0, background: 'var(--card2)', borderRadius: 12, padding: 3, marginBottom: 16 }}>
          {[['manual', '✏️ Manual'], ['import', '🤖 Importar con IA']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', transition: 'all .15s',
                background: mode === id ? '#fff' : 'transparent',
                color: mode === id ? 'var(--accent)' : 'var(--muted)',
                boxShadow: mode === id ? '0 1px 4px #00000012' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'manual'
          ? <ManualForm routeId={routeId} onClose={onClose} onCreated={onCreated} />
          : <ImportForm routeId={routeId} onClose={onClose} onCreated={onCreated} />
        }
      </div>
    </div>
  );
}

// ── Manual single-package form ────────────────────────────────────────────────
function ManualForm({ routeId, onClose, onCreated }) {
  const [form, setForm] = useState({
    customerName: '', customerLastName: '', customerPhone: '',
    address: '', commune: '', aptFloor: '',
    price: '', lat: '', lng: '', note: ''
  });
  const [zones, setZones] = useState([]);
  const [priceSuggested, setPriceSuggested] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getZones().then(setZones).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCommuneChange = (val) => {
    set('commune', val);
    const suggested = suggestPriceFromZone(zones, val);
    if (suggested != null) {
      set('price', suggested);
      setPriceSuggested(true);
    } else {
      setPriceSuggested(false);
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
        lat:   form.lat ? Number(form.lat) : undefined,
        lng:   form.lng ? Number(form.lng) : undefined,
        zone:  undefined,
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
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="Nombre *" value={form.customerName} onChange={v => set('customerName', v)} placeholder="María" />
        <Field label="Apellido" value={form.customerLastName} onChange={v => set('customerLastName', v)} placeholder="González" />
        <div style={{ gridColumn: '1/-1' }}>
          <Field label="Teléfono" value={form.customerPhone} onChange={v => set('customerPhone', v)} placeholder="+56912345678" type="tel" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <div style={lbl}>Dirección *</div>
          <AddressAutocomplete
            value={form.address}
            onChange={v => set('address', v)}
            onSelect={({ address, commune, lat, lng }) => {
              setForm(f => ({ ...f, address, commune: commune || f.commune, lat: lat || f.lat, lng: lng || f.lng }));
              if (commune) handleCommuneChange(commune);
            }}
            placeholder="Av. Providencia 1100, Santiago"
            dropdownFixed
          />
        </div>

        <div>
          <div style={lbl}>Comuna</div>
          <input
            value={form.commune}
            onChange={e => handleCommuneChange(e.target.value)}
            placeholder="Providencia"
            style={inp}
          />
        </div>

        <Field label="Depto/Casa" value={form.aptFloor} onChange={v => set('aptFloor', v)} placeholder="Dpto 202" />

        <div>
          <div style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            Precio CLP
            {priceSuggested && (
              <span style={{ fontSize: 9, background: '#d4650a15', color: '#d4650a', border: '1px solid #d4650a28', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>
                SUGERIDO
              </span>
            )}
          </div>
          <input
            type="number"
            value={form.price}
            onChange={e => { set('price', e.target.value); setPriceSuggested(false); }}
            placeholder="0"
            style={{ ...inp, background: priceSuggested ? '#d4650a08' : 'var(--card2)', border: `1px solid ${priceSuggested ? '#d4650a30' : 'var(--border)'}`, fontWeight: priceSuggested ? 700 : 400 }}
          />
        </div>

        <div style={{ gridColumn: '1/-1' }}>
          <div style={lbl}>Notas / Adicional</div>
          <textarea
            value={form.note}
            onChange={e => set('note', e.target.value)}
            placeholder="Ej: tocar timbre, dejar en conserjería, código #204…"
            rows={2}
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {priceSuggested && form.commune && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#d4650a08', border: '1px solid #d4650a20', borderRadius: 9, fontSize: 12, color: '#d4650a' }}>
          💡 Precio zona <b>{form.commune}</b>: ${Number(form.price).toLocaleString('es-CL')} — puedes cambiarlo arriba
        </div>
      )}

      <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 14, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Guardando…' : '✓ AGREGAR A LA RUTA'}
      </button>
      <button onClick={onClose} style={{ width: '100%', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}>Cancelar</button>
    </>
  );
}

// ── AI Import flow (upload → preview → confirm) ───────────────────────────────
function ImportForm({ routeId, onClose, onCreated }) {
  const [step, setStep]       = useState('upload'); // upload | preview
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const fileRef = useRef();

  const handleAnalyze = async () => {
    if (!file) return toast('⚠️ Selecciona un archivo primero');
    setLoading(true);
    try {
      const { packages, count } = await api.importPreview(routeId, file);
      if (!count) return toast('⚠️ Claude no encontró datos en el archivo');
      setPreview(packages);
      setStep('preview');
      toast(`✅ ${count} paquetes detectados — revisa y confirma`);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePkg = (idx, field, value) => {
    setPreview(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const handleConfirm = async () => {
    if (!preview.length) return;
    setSaving(true);
    try {
      const { count } = await api.importConfirm(routeId, preview);
      toast(`🚀 ${count} paquetes agregados a la ruta`);
      onCreated();
      onClose();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'preview') {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
            🤖 Claude detectó <b style={{ color: 'var(--text)' }}>{preview.length} paquetes</b>
          </div>
          <button onClick={() => setStep('upload')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ← Cambiar archivo
          </button>
        </div>

        {preview.map((pkg, idx) => {
          const flags = pkg._flags || [];
          const hasFlags = flags.length > 0;
          return (
            <div key={idx} style={{
              background: '#fff',
              border: `1px solid ${hasFlags ? '#d4650a50' : 'var(--border)'}`,
              borderRadius: 12, padding: '11px 12px', marginBottom: 9
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>#{idx + 1}</span>
                  {hasFlags && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#d4650a', background: '#d4650a12', border: '1px solid #d4650a30', borderRadius: 20, padding: '1px 7px' }}>
                      ⚠ Revisar: {flags.join(', ')}
                    </span>
                  )}
                </div>
                <button onClick={() => setPreview(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 15, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <ImportField label="Nombre" value={pkg.customerName || ''} onChange={v => updatePkg(idx, 'customerName', v)} flagged={flags.includes('customerName')} />
                <ImportField label="Apellido" value={pkg.customerLastName || ''} onChange={v => updatePkg(idx, 'customerLastName', v)} flagged={flags.includes('customerLastName')} />
                <div style={{ gridColumn: '1/-1' }}>
                  <ImportField label="Dirección" value={pkg.address || ''} onChange={v => updatePkg(idx, 'address', v)} flagged={flags.includes('address')} />
                </div>
                <ImportField label="Comuna" value={pkg.commune || ''} onChange={v => updatePkg(idx, 'commune', v)} flagged={flags.includes('commune')} />
                <ImportField label="Teléfono" value={pkg.customerPhone || ''} onChange={v => updatePkg(idx, 'customerPhone', v)} flagged={flags.includes('customerPhone')} />
                <ImportField label="Depto/Casa" value={pkg.aptFloor || ''} onChange={v => updatePkg(idx, 'aptFloor', v)} flagged={flags.includes('aptFloor')} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 3, textTransform: 'uppercase' }}>
                    Precio CLP {pkg._suggestedPrice && <span style={{ color: '#d4650a' }}>(auto)</span>}
                  </div>
                  <select
                    value={pkg.price || 3500}
                    onChange={e => updatePkg(idx, 'price', Number(e.target.value))}
                    style={{ width: '100%', background: pkg._suggestedPrice ? '#d4650a08' : 'var(--card2)', border: `1px solid ${pkg._suggestedPrice ? '#d4650a30' : 'var(--border)'}`, borderRadius: 8, padding: '7px 9px', fontSize: 13, outline: 'none' }}
                  >
                    {[2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 7000, 8000, 10000, 11500].map(p => (
                      <option key={p} value={p}>${p.toLocaleString('es-CL')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ position: 'sticky', bottom: 0, background: '#fff', paddingTop: 10 }}>
          <button onClick={handleConfirm} disabled={saving || !preview.length} style={{
            width: '100%', padding: 14, borderRadius: 12, border: 'none',
            background: saving ? 'var(--border)' : 'var(--accent)',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer'
          }}>
            {saving ? '⏳ Geocodificando y guardando…' : `✓ AGREGAR ${preview.length} PAQUETES A LA RUTA`}
          </button>
          {saving && (
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              Puede tardar unos segundos mientras se geolocalizan las direcciones…
            </p>
          )}
          <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}>Cancelar</button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Upload area */}
      <div
        onClick={() => fileRef.current.click()}
        style={{ background: 'var(--card2)', borderRadius: 14, border: '2px dashed var(--border)', padding: '28px 20px', textAlign: 'center', marginBottom: 14, cursor: 'pointer' }}
      >
        <div style={{ fontSize: 38, marginBottom: 8 }}>📎</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: file ? 'var(--accent)' : 'var(--text)', marginBottom: 4 }}>
          {file ? file.name : 'Toca para seleccionar archivo'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Imagen (foto/screenshot), Excel (.xlsx) o CSV
        </div>
        <input ref={fileRef} type="file" accept="image/*,.xlsx,.xls,.csv" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
      </div>

      {/* Tips */}
      <div style={{ background: '#00885508', border: '1px solid #00885520', borderRadius: 12, padding: '11px 13px', marginBottom: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        <b style={{ color: 'var(--accent)', display: 'block', marginBottom: 4 }}>¿Cómo funciona?</b>
        📸 <b>Screenshot / foto:</b> Captura tu planilla o lista y Claude la lee<br />
        📊 <b>Excel:</b> Sube tu .xlsx directamente<br />
        📄 <b>CSV:</b> Exporta desde cualquier programa<br />
        <br />
        Claude detecta: nombre, dirección, teléfono, depto y precio. Si un dato no está claro lo marcará para que lo revises.
      </div>

      {file && (
        <div style={{ background: '#00885512', border: '1px solid #00885530', borderRadius: 10, padding: '9px 13px', marginBottom: 12, fontSize: 13 }}>
          ✅ <b>{file.name}</b> · {(file.size / 1024).toFixed(0)} KB
        </div>
      )}

      <button onClick={handleAnalyze} disabled={!file || loading} style={{
        width: '100%', padding: 14, borderRadius: 12, border: 'none',
        background: !file || loading ? 'var(--border)' : '#9c27b0',
        color: '#fff', fontSize: 14, fontWeight: 700, cursor: !file || loading ? 'not-allowed' : 'pointer'
      }}>
        {loading ? '🤖 Claude analizando…' : '🤖 Analizar con IA'}
      </button>
      {loading && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          Esto puede tardar 10-20 segundos…
        </p>
      )}
      <button onClick={onClose} style={{ width: '100%', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 9 }}>Cancelar</button>
    </>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  );
}

function ImportField({ label, value, onChange, flagged }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: flagged ? '#d4650a' : 'var(--muted)', letterSpacing: 1, marginBottom: 3, textTransform: 'uppercase' }}>
        {label}{flagged ? ' ⚠' : ''}
      </div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: flagged ? '#fff8f0' : 'var(--card2)', border: `1px solid ${flagged ? '#d4650a60' : 'var(--border)'}`, borderRadius: 8, padding: '7px 9px', fontSize: 13, outline: 'none' }}
      />
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 5 };
const inp = { width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none' };
