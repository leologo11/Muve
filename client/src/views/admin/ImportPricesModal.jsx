import React, { useState, useRef } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

// ── Parser ────────────────────────────────────────────────────────────────────
// Supports formats:
//   Alternating lines:  CommuneName\n30000\nCommuneName\n12000
//   Tab-separated:      CommuneName\t30000
//   Comma-separated:    CommuneName,30000
//   Space-separated:    CommuneName 30000  (price at end)
function parsePriceText(raw) {
  if (!raw || !raw.trim()) return [];

  const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
  const results = [];
  const seen = new Set();

  // Try alternating lines first (most common user format)
  let i = 0;
  while (i < lines.length) {
    const a = lines[i];
    const b = lines[i + 1];

    // If a is not a number and b is a number → alternating format
    if (b !== undefined && !/^\d+$/.test(a) && /^\d+$/.test(b.replace(/[.,]/g, ''))) {
      const commune = capitalize(a);
      const price = Number(b.replace(/[.,]/g, ''));
      if (price > 0 && !seen.has(commune.toLowerCase())) {
        results.push({ commune, price });
        seen.add(commune.toLowerCase());
      }
      i += 2;
      continue;
    }

    // Try tab or comma separated within the line
    const tabParts = a.split('\t');
    const commaParts = a.split(',');
    let parsed = null;

    if (tabParts.length >= 2) {
      const name = tabParts[0].trim();
      const price = Number(tabParts[tabParts.length - 1].trim().replace(/[.,]/g, ''));
      if (name && price > 0) parsed = { commune: capitalize(name), price };
    } else if (commaParts.length >= 2) {
      const name = commaParts[0].trim();
      const price = Number(commaParts[commaParts.length - 1].trim().replace(/[.,]/g, ''));
      if (name && price > 0) parsed = { commune: capitalize(name), price };
    } else {
      // Last resort: number at end of line after whitespace
      const m = a.match(/^(.+?)\s+(\d[\d.,]*)$/);
      if (m) {
        const name = m[1].trim();
        const price = Number(m[2].replace(/[.,]/g, ''));
        if (name && price > 0) parsed = { commune: capitalize(name), price };
      }
    }

    if (parsed && !seen.has(parsed.commune.toLowerCase())) {
      results.push(parsed);
      seen.add(parsed.commune.toLowerCase());
    }
    i++;
  }

  return results;
}

function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

const fmt = n => Number(n || 0).toLocaleString('es-CL');

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImportPricesModal({ onClose, onImported }) {
  const [text, setText]     = useState('');
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const textRef             = useRef(null);

  const handleParse = () => {
    const items = parsePriceText(text);
    if (!items.length) return toast('⚠️ No se encontraron precios válidos. Asegúrate de pegar nombre y precio en líneas alternas.');
    setParsed(items);
  };

  const handleImport = async () => {
    if (!parsed?.length) return;
    setSaving(true);
    try {
      const res = await api.bulkUpsertPrices(parsed);
      setResult(res);
      toast(`✅ ${res.priceConfigs} comunas guardadas · ${res.zonesUpdated} zonas actualizadas en el mapa`);
      onImported?.();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditPrice = (i, val) => {
    setParsed(prev => prev.map((x, j) => j === i ? { ...x, price: Number(val) || 0 } : x));
  };

  const handleRemove = (i) => {
    setParsed(prev => prev.filter((_, j) => j !== i));
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#00000070', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && !saving && onClose()}
    >
      <div style={{ background: 'var(--card)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 20px 60px #0006' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>📋 Importar precios por zona</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Pega el listado de comunas y precios — cualquier formato
            </div>
          </div>
          <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '0 4px' }}>✕</button>
        </div>

        {/* Format hint */}
        <div style={{ background: '#f4f7ff', border: '1px solid #0052FF20', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#334155' }}>
          <strong>Formatos aceptados:</strong>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>Líneas alternas</div>
              <code style={{ fontSize: 10 }}>Santiago<br/>4500<br/>Buin<br/>12000</code>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>Con tabulación</div>
              <code style={{ fontSize: 10 }}>Santiago	4500<br/>Buin	12000</code>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>Con coma</div>
              <code style={{ fontSize: 10 }}>Santiago,4500<br/>Buin,12000</code>
            </div>
          </div>
        </div>

        {!parsed ? (
          <>
            {/* Textarea */}
            <textarea
              ref={textRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={'Santiago\n4500\nProvidencia\n4000\nBuin\n12000\n...'}
              rows={12}
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', outline: 'none', resize: 'vertical', background: '#f8fbff', boxSizing: 'border-box', lineHeight: 1.6 }}
            />
            <button
              onClick={handleParse}
              disabled={!text.trim()}
              style={{ padding: '12px', borderRadius: 12, border: 'none', background: text.trim() ? 'var(--accent)' : '#E2E8F0', color: text.trim() ? '#fff' : '#94a3b8', fontSize: 14, fontWeight: 800, cursor: text.trim() ? 'pointer' : 'not-allowed' }}
            >
              Analizar texto →
            </button>
          </>
        ) : result ? (
          /* Result */
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>¡Importación completada!</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 4 }}>{result.priceConfigs} precios guardados en base de datos</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>{result.zonesUpdated} zonas actualizadas en el mapa</div>
            <button
              onClick={onClose}
              style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
            >
              Cerrar y ver mapa
            </button>
          </div>
        ) : (
          /* Preview */
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Vista previa — <span style={{ color: 'var(--accent)' }}>{parsed.length} comunas</span>
              </div>
              <button
                onClick={() => setParsed(null)}
                style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontWeight: 700 }}
              >
                ← Editar texto
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>COMUNA</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>PRECIO</th>
                    <th style={{ width: 36 }}/>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((item, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : 'var(--card2)' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 600 }}>{item.commune}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={item.price}
                          onChange={e => handleEditPrice(i, e.target.value)}
                          style={{ width: 90, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}
                        />
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleRemove(i)}
                          title="Quitar"
                          style={{ background: 'none', border: 'none', color: '#e5534b', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                disabled={saving}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={saving || !parsed.length}
                style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '⏳ Guardando…' : `Guardar ${parsed.length} precios →`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
