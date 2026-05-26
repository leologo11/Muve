import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

// Local text parser — fast, no AI cost
function parsePriceText(raw) {
  if (!raw?.trim()) return [];
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
  const results = [];
  const seen = new Set();
  let i = 0;
  while (i < lines.length) {
    const a = lines[i], b = lines[i + 1];
    if (b !== undefined && !/^\d+$/.test(a) && /^\d+$/.test(b.replace(/[.,]/g, ''))) {
      const commune = cap(a);
      const price = Number(b.replace(/[.,]/g, ''));
      if (price > 0 && !seen.has(commune.toLowerCase())) { results.push({ commune, price }); seen.add(commune.toLowerCase()); }
      i += 2; continue;
    }
    const tabP = a.split('\t'), commaP = a.split(',');
    let parsed = null;
    if (tabP.length >= 2) {
      const price = Number(tabP[tabP.length - 1].trim().replace(/[.,]/g, ''));
      if (tabP[0].trim() && price > 0) parsed = { commune: cap(tabP[0].trim()), price };
    } else if (commaP.length >= 2) {
      const price = Number(commaP[commaP.length - 1].trim().replace(/[.,]/g, ''));
      if (commaP[0].trim() && price > 0) parsed = { commune: cap(commaP[0].trim()), price };
    } else {
      const m = a.match(/^(.+?)\s+(\d[\d.,]*)$/);
      if (m) { const price = Number(m[2].replace(/[.,]/g, '')); if (price > 0) parsed = { commune: cap(m[1].trim()), price }; }
    }
    if (parsed && !seen.has(parsed.commune.toLowerCase())) { results.push(parsed); seen.add(parsed.commune.toLowerCase()); }
    i++;
  }
  return results;
}

function cap(str) { return str.replace(/\b\w/g, c => c.toUpperCase()); }

const INP = {
  border: '1px solid var(--border)', borderRadius: 7, padding: '5px 6px',
  fontSize: 12, fontWeight: 600, outline: 'none', textAlign: 'right',
  width: '100%', boxSizing: 'border-box', background: '#fff',
};

export default function ImportPricesModal({ onClose, onImported }) {
  const [tab, setTab]         = useState('text');   // 'text' | 'file'
  const [text, setText]       = useState('');
  const [file, setFile]       = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [parsed, setParsed]   = useState(null);     // [{commune,t1,t2,t3}]
  const [result, setResult]   = useState(null);
  const [saving, setSaving]   = useState(false);

  // Global tier thresholds (shared for all communes)
  const [qty2, setQty2] = useState(4);
  const [qty3, setQty3] = useState(8);

  // Generalizer
  const [genOpen, setGenOpen]     = useState(true);
  const [genMode, setGenMode]     = useState('flat');   // 'flat' | 'pct'
  const [genD2, setGenD2]         = useState('');
  const [genD3, setGenD3]         = useState('');

  // Presets
  const [templates, setTemplates]       = useState([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName]     = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [editingPreset, setEditingPreset]   = useState(null);  // id being renamed
  const [editPresetName, setEditPresetName] = useState('');

  const fileRef = useRef(null);

  useEffect(() => {
    api.getTierTemplates().then(setTemplates).catch(() => {});
  }, []);

  // ── AI extraction ─────────────────────────────────────────────────────────
  const analyzeWithAI = async (source) => {
    setAiLoading(true);
    try {
      const { items } = await api.parsePricesAI(source);
      if (!items?.length) return toast('⚠ La IA no encontró precios. Intenta con un archivo más claro.');
      setParsed(items.map(({ commune, price }) => ({ commune, t1: price, t2: price, t3: price })));
    } catch (err) { toast('❌ ' + err.message); }
    finally { setAiLoading(false); }
  };

  const handleTextAnalyze = () => {
    const local = parsePriceText(text);
    if (local.length > 0) {
      setParsed(local.map(({ commune, price }) => ({ commune, t1: price, t2: price, t3: price })));
    } else {
      analyzeWithAI(text);
    }
  };

  // ── Preset helpers ────────────────────────────────────────────────────────
  const loadPreset = (t) => {
    setQty2(t.qty2); setQty3(t.qty3);
    setGenMode(t.mode); setGenD2(String(t.discount2)); setGenD3(String(t.discount3));
    toast(`Preset "${t.name}" cargado`);
  };

  const savePreset = async () => {
    if (!presetName.trim()) return toast('⚠ Escribe un nombre');
    setSavingPreset(true);
    try {
      const t = await api.createTierTemplate({ name: presetName.trim(), qty2: Number(qty2), qty3: Number(qty3), mode: genMode, discount2: Number(genD2) || 0, discount3: Number(genD3) || 0 });
      setTemplates(prev => [t, ...prev]);
      setPresetName(''); setShowSavePreset(false);
      toast(`✅ Preset "${t.name}" guardado`);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSavingPreset(false); }
  };

  const updatePresetName = async (id) => {
    if (!editPresetName.trim()) return;
    try {
      const updated = await api.updateTierTemplate(id, { name: editPresetName.trim() });
      setTemplates(prev => prev.map(t => t._id === id ? { ...t, name: updated.name } : t));
      setEditingPreset(null);
      toast('✅ Nombre actualizado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const deletePreset = async (id, name) => {
    if (!confirm(`¿Eliminar preset "${name}"?`)) return;
    try {
      await api.deleteTierTemplate(id);
      setTemplates(prev => prev.filter(t => t._id !== id));
      toast('🗑️ Eliminado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  // ── Generalizer ───────────────────────────────────────────────────────────
  const applyGeneralizer = () => {
    const d2 = Number(genD2) || 0;
    const d3 = Number(genD3) || 0;
    if (!d2 && !d3) return toast('⚠ Ingresa al menos un descuento');
    setParsed(prev => prev.map(item => ({
      ...item,
      t2: Math.max(0, genMode === 'flat' ? item.t1 - d2 : Math.round(item.t1 * (1 - d2 / 100))),
      t3: Math.max(0, genMode === 'flat' ? item.t1 - d3 : Math.round(item.t1 * (1 - d3 / 100))),
    })));
    toast(`✅ Tramos aplicados a ${parsed.length} comunas`);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!parsed?.length || saving) return;
    const q2 = Number(qty2), q3 = Number(qty3);
    if (q2 <= 1 || q3 <= q2) return toast('⚠ T2 debe ser > 1 pkg, T3 debe ser > T2');
    setSaving(true);
    try {
      const items = parsed.map(({ commune, t1, t2, t3 }) => ({
        commune,
        price: t1,
        tiers: [
          { minQty: 1,  price: t1 },
          { minQty: q2, price: t2 },
          { minQty: q3, price: t3 },
        ],
      }));
      const res = await api.bulkZoneTiers(items);
      setResult(res);
      toast(`✅ ${res.updated} zonas actualizadas con tramos`);
      onImported?.();
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const setT = (i, f, v) => setParsed(prev => prev.map((x, j) => j === i ? { ...x, [f]: Number(v) || 0 } : x));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#00000070', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && !saving && !aiLoading && onClose()}
    >
      <div style={{ background: 'var(--card)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 660, maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 60px #0006' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>💰 Importar precios con IA</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Sube foto, Excel o lista · configura 3 tramos por volumen</div>
          </div>
          <button onClick={onClose} disabled={saving || aiLoading} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '0 4px' }}>✕</button>
        </div>

        {/* ── Success ──────────────────────────────────────────────────────── */}
        {result ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>¡Tramos guardados!</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>
              {result.updated} zonas actualizadas con precios por volumen
            </div>
            <button onClick={onClose} style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Cerrar y ver mapa
            </button>
          </div>

        /* ── Preview + generalizer ──────────────────────────────────────────── */
        ) : parsed ? (
          <>
            {/* Generalizer panel */}
            <div style={{ background: '#f4f7ff', border: '1px solid #0052FF20', borderRadius: 12, padding: '10px 14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: genOpen ? 10 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>⚡ Generalizar tramos</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>aplica descuentos a todas las comunas a la vez</span>
                <button onClick={() => setGenOpen(v => !v)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: 'var(--muted)', padding: 0 }}>
                  {genOpen ? '▲' : '▼'}
                </button>
              </div>

              {genOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
                    {/* Mode toggle */}
                    <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid #0052FF30' }}>
                      {[['flat','$ CLP'],['pct','% %']].map(([m, label]) => (
                        <button key={m} onClick={() => setGenMode(m)} style={{
                          padding: '5px 10px', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          background: genMode === m ? 'var(--accent)' : '#fff',
                          color: genMode === m ? '#fff' : 'var(--muted)',
                        }}>{label}</button>
                      ))}
                    </div>
                    <div />
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.5, marginBottom: 3 }}>DESCUENTO T2</div>
                      <input type="number" value={genD2} onChange={e => setGenD2(e.target.value)}
                        placeholder={genMode === 'flat' ? 'ej: 500' : 'ej: 10'}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #0052FF30', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#7b1fa2', letterSpacing: 0.5, marginBottom: 3 }}>DESCUENTO T3</div>
                      <input type="number" value={genD3} onChange={e => setGenD3(e.target.value)}
                        placeholder={genMode === 'flat' ? 'ej: 1000' : 'ej: 20'}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #7b1fa230', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={applyGeneralizer} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      ⚡ Aplicar a {parsed.length} comunas
                    </button>
                    <button onClick={() => setShowSavePreset(v => !v)} title="Guardar como preset"
                      style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #0052FF30', background: showSavePreset ? 'var(--accent)' : '#f4f7ff', color: showSavePreset ? '#fff' : 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      💾
                    </button>
                  </div>

                  {/* Save preset form */}
                  {showSavePreset && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={presetName} onChange={e => setPresetName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setShowSavePreset(false); }}
                        placeholder="Nombre del preset…" autoFocus
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--accent)', fontSize: 12, outline: 'none' }} />
                      <button onClick={savePreset} disabled={savingPreset || !presetName.trim()}
                        style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {savingPreset ? '…' : '✓'}
                      </button>
                      <button onClick={() => setShowSavePreset(false)}
                        style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                    </div>
                  )}
                </div>
              )}

              {/* Preset list — always visible if there are templates */}
              {templates.length > 0 && (
                <div style={{ borderTop: genOpen ? '1px solid #0052FF15' : 'none', marginTop: genOpen ? 10 : 0, paddingTop: genOpen ? 10 : 0 }}>
                  {!genOpen && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>PRESETS GUARDADOS</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {templates.map(t => (
                      <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 8, padding: '6px 10px', border: '1px solid #0052FF15' }}>
                        {editingPreset === t._id ? (
                          <>
                            <input value={editPresetName} onChange={e => setEditPresetName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') updatePresetName(t._id); if (e.key === 'Escape') setEditingPreset(null); }}
                              autoFocus style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--accent)', fontSize: 12, outline: 'none' }} />
                            <button onClick={() => updatePresetName(t._id)}
                              style={{ padding: '3px 9px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                            <button onClick={() => setEditingPreset(null)}
                              style={{ padding: '3px 7px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}>✕</button>
                          </>
                        ) : (
                          <>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                T2 ≥{t.qty2} · T3 ≥{t.qty3} · {t.mode === 'flat' ? `$${t.discount2}/$${t.discount3}` : `${t.discount2}%/${t.discount3}%`}
                              </div>
                            </div>
                            <button onClick={() => loadPreset(t)} title="Cargar"
                              style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #0052FF30', background: '#f4f7ff', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cargar</button>
                            <button onClick={() => { setEditingPreset(t._id); setEditPresetName(t.name); }} title="Renombrar"
                              style={{ padding: '4px 7px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}>✏️</button>
                            <button onClick={() => deletePreset(t._id, t.name)} title="Eliminar"
                              style={{ padding: '4px 7px', borderRadius: 7, border: '1px solid #cc224430', background: 'none', color: '#cc2244', fontSize: 11, cursor: 'pointer' }}>🗑️</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, color: 'var(--muted)', letterSpacing: 0.8 }}>COMUNA</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: 10, color: '#334155', width: 88, letterSpacing: 0.5 }}>T1 · 1 pkg</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, fontSize: 10, color: 'var(--accent)', width: 100 }}>
                      <div>T2 · ≥
                        <input type="number" value={qty2} onChange={e => setQty2(e.target.value)} min={2}
                          title="Cantidad mínima del tramo 2"
                          style={{ width: 32, textAlign: 'center', border: '1px solid #0052FF40', borderRadius: 5, padding: '1px 3px', fontSize: 10, fontWeight: 700, color: 'var(--accent)', outline: 'none', background: '#f4f7ff', marginLeft: 3 }} />
                        &nbsp;pkg
                      </div>
                    </th>
                    <th style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, fontSize: 10, color: '#7b1fa2', width: 100 }}>
                      <div>T3 · ≥
                        <input type="number" value={qty3} onChange={e => setQty3(e.target.value)} min={3}
                          title="Cantidad mínima del tramo 3"
                          style={{ width: 32, textAlign: 'center', border: '1px solid #7b1fa240', borderRadius: 5, padding: '1px 3px', fontSize: 10, fontWeight: 700, color: '#7b1fa2', outline: 'none', background: '#fdf4ff', marginLeft: 3 }} />
                        &nbsp;pkg
                      </div>
                    </th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((item, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : 'var(--card2)' }}>
                      <td style={{ padding: '4px 10px', fontWeight: 600 }}>{item.commune}</td>
                      <td style={{ padding: '3px 5px' }}>
                        <input type="number" value={item.t1} onChange={e => setT(i, 't1', e.target.value)} style={INP} />
                      </td>
                      <td style={{ padding: '3px 5px' }}>
                        <input type="number" value={item.t2} onChange={e => setT(i, 't2', e.target.value)}
                          style={{ ...INP, background: '#f4f7ff', borderColor: '#0052FF30' }} />
                      </td>
                      <td style={{ padding: '3px 5px' }}>
                        <input type="number" value={item.t3} onChange={e => setT(i, 't3', e.target.value)}
                          style={{ ...INP, background: '#fdf4ff', borderColor: '#7b1fa230' }} />
                      </td>
                      <td style={{ padding: '3px 5px', textAlign: 'center' }}>
                        <button onClick={() => setParsed(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', color: '#e5534b', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setParsed(null)} disabled={saving}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ← Volver
              </button>
              <button onClick={handleSave} disabled={saving || !parsed.length}
                style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Guardando…' : `Guardar tramos en ${parsed.length} comunas →`}
              </button>
            </div>
          </>

        /* ── Input ──────────────────────────────────────────────────────────── */
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
              {[['text','📋 Pegar lista'],['file','📷 Foto / Excel']].map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '10px', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: tab === t ? 'var(--accent)' : '#fff',
                  color: tab === t ? '#fff' : 'var(--muted)',
                }}>{label}</button>
              ))}
            </div>

            {tab === 'text' ? (
              <>
                <div style={{ background: '#f4f7ff', border: '1px solid #0052FF20', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#334155', flexShrink: 0 }}>
                  <strong>Formatos:</strong> líneas alternas (nombre / precio), tab-separado, coma-separado, o texto libre.<br />
                  Si el texto es complejo o está en otro idioma, usa <strong>Analizar con IA ✨</strong>.
                </div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={'Santiago\n4500\nProvidencia\n4000\nBuin\n12000\n...'}
                  rows={10}
                  style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', outline: 'none', resize: 'vertical', background: '#f8fbff', lineHeight: 1.6 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleTextAnalyze} disabled={!text.trim() || aiLoading}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', fontSize: 13, fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed', color: 'var(--text)' }}>
                    Analizar →
                  </button>
                  <button onClick={() => analyzeWithAI(text)} disabled={!text.trim() || aiLoading}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: text.trim() && !aiLoading ? '#5c35cc' : '#E2E8F0', color: text.trim() && !aiLoading ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 800, cursor: text.trim() && !aiLoading ? 'pointer' : 'not-allowed' }}>
                    {aiLoading ? '⏳ Analizando…' : '✨ Analizar con IA'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Dropzone */}
                <div
                  onClick={() => !aiLoading && fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
                  style={{
                    border: `2px dashed ${file ? '#5c35cc' : 'var(--border)'}`, borderRadius: 14,
                    padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
                    background: file ? '#5c35cc08' : 'var(--card2)', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: 34, marginBottom: 8 }}>{file ? '📄' : '📤'}</div>
                  {file ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#5c35cc' }}>{file.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB · clic para cambiar</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Arrastra o haz clic para subir</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>JPG · PNG · Excel (.xlsx) · CSV</div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*,.xlsx,.xls,.csv" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />

                <button onClick={() => analyzeWithAI(file)} disabled={!file || aiLoading}
                  style={{ padding: '13px', borderRadius: 12, border: 'none', background: file && !aiLoading ? '#5c35cc' : '#E2E8F0', color: file && !aiLoading ? '#fff' : '#94a3b8', fontSize: 14, fontWeight: 800, cursor: file && !aiLoading ? 'pointer' : 'not-allowed' }}>
                  {aiLoading ? '⏳ Analizando con IA…' : '✨ Analizar con IA'}
                </button>

                <div style={{ background: '#f4f7ff', border: '1px solid #0052FF20', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#334155' }}>
                  <strong>Acepta:</strong> foto de tabla de precios, planilla Excel con columnas commune/price, o CSV estructurado.
                  La IA extrae los precios automáticamente.
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
