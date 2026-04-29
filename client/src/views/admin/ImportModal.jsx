import React, { useState, useRef } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

const STATUS_COLORS = { pendiente: '#d4650a', entregado: '#008855', 'no-entregado': '#cc2244' };

export default function ImportModal({ routeId, onClose, onImported }) {
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

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

  const removePkg = (idx) => {
    setPreview(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = async () => {
    if (!preview.length) return;
    setSaving(true);
    try {
      const { count } = await api.importConfirm(routeId, preview);
      toast(`🚀 ${count} paquetes agregados a la ruta`);
      onImported();
      onClose();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 900, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{
        background: '#fff', borderRadius: '20px 20px 0 0', width: '100%',
        maxHeight: '95dvh', overflowY: 'auto',
        padding: '18px 16px calc(30px + env(safe-area-inset-bottom))',
        boxShadow: '0 -4px 30px #00000020'
      }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>🤖 Importar con IA</h2>
          {step === 'preview' && (
            <button onClick={() => setStep('upload')} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
              ← Cambiar archivo
            </button>
          )}
        </div>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <>
            <div style={{ background: 'var(--card2)', borderRadius: 14, border: '2px dashed var(--border)', padding: '28px 20px', textAlign: 'center', marginBottom: 16, cursor: 'pointer' }}
              onClick={() => fileRef.current.click()}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📎</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                {file ? file.name : 'Toca para seleccionar archivo'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Soporta: imagen (foto del Excel/lista), archivo Excel (.xlsx), CSV
              </div>
              <input ref={fileRef} type="file" accept="image/*,.xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
            </div>

            {/* Instructions */}
            <div style={{ background: '#00885508', border: '1px solid #00885520', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              <b style={{ color: 'var(--accent)', display: 'block', marginBottom: 4 }}>¿Cómo funciona?</b>
              📸 <b>Foto del Excel:</b> Toma una foto de tu planilla y Claude lee los datos<br />
              📊 <b>Archivo Excel:</b> Sube tu .xlsx directamente<br />
              📄 <b>CSV:</b> Exporta desde cualquier programa y sube el archivo<br />
              <br />
              Claude detecta automáticamente: nombre, dirección, teléfono, depto y precio. Si no hay precio, sugiere uno según la comuna.
            </div>

            {file && (
              <div style={{ background: '#00885512', border: '1px solid #00885530', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                ✅ Archivo listo: <b>{file.name}</b> ({(file.size / 1024).toFixed(0)} KB)
              </div>
            )}

            <button onClick={handleAnalyze} disabled={!file || loading} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: !file || loading ? 'var(--border)' : 'var(--accent)',
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: !file || loading ? 'not-allowed' : 'pointer'
            }}>
              {loading ? '🤖 Claude analizando…' : '🤖 Analizar con IA'}
            </button>

            {loading && (
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                Esto puede tomar 10-20 segundos…
              </p>
            )}
          </>
        )}

        {/* STEP 2: Preview & Edit */}
        {step === 'preview' && (
          <>
            <div style={{ background: '#00885510', border: '1px solid #00885528', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
              🤖 Claude detectó <b>{preview.length} paquetes</b>. Revisa y edita antes de confirmar.
            </div>

            {preview.map((pkg, idx) => (
              <div key={idx} style={{
                background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                padding: '12px', marginBottom: 10, position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>PAQUETE {idx + 1}</span>
                  <button onClick={() => removePkg(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 16, cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  <PreviewField label="Nombre" value={pkg.customerName || ''} onChange={v => updatePkg(idx, 'customerName', v)} />
                  <PreviewField label="Apellido" value={pkg.customerLastName || ''} onChange={v => updatePkg(idx, 'customerLastName', v)} />
                  <div style={{ gridColumn: '1/-1' }}>
                    <PreviewField label="Dirección" value={pkg.address || ''} onChange={v => updatePkg(idx, 'address', v)} />
                  </div>
                  <PreviewField label="Comuna" value={pkg.commune || ''} onChange={v => updatePkg(idx, 'commune', v)} />
                  <PreviewField label="Depto/Casa" value={pkg.aptFloor || ''} onChange={v => updatePkg(idx, 'aptFloor', v)} />
                  <PreviewField label="Teléfono" value={pkg.customerPhone || ''} onChange={v => updatePkg(idx, 'customerPhone', v)} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 3, textTransform: 'uppercase' }}>
                      Precio CLP {pkg._suggestedPrice && <span style={{ color: '#d4650a' }}>(sugerido)</span>}
                    </div>
                    <select
                      value={pkg.price || 3500}
                      onChange={e => updatePkg(idx, 'price', Number(e.target.value))}
                      style={{ width: '100%', background: pkg._suggestedPrice ? '#d4650a08' : 'var(--card2)', border: `1px solid ${pkg._suggestedPrice ? '#d4650a30' : 'var(--border)'}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }}
                    >
                      {[2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 7000, 8000, 10000, 11500].map(p => (
                        <option key={p} value={p}>${p.toLocaleString('es-CL')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ position: 'sticky', bottom: 0, background: '#fff', paddingTop: 10 }}>
              <button onClick={handleConfirm} disabled={saving || !preview.length} style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none',
                background: saving ? 'var(--border)' : 'var(--accent)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}>
                {saving ? 'Guardando…' : `✓ AGREGAR ${preview.length} PAQUETES A LA RUTA`}
              </button>
              <button onClick={onClose} style={{
                width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', marginTop: 7
              }}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PreviewField({ label, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }}
      />
    </div>
  );
}
