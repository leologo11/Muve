import React, { useState } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';
import { RESET_TARGETS } from './adminHelpers.js';

export default function ResetDataBtn({ onDone, wide = false }) {
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = React.useState({});
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const toggle = id => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const anyChecked = RESET_TARGETS.some(t => checked[t.id]);
  const canSubmit = anyChecked && confirm === 'CONFIRMAR' && !busy;

  const handleOpen = () => {
    setChecked({});
    setConfirm('');
    setOpen(true);
  };

  const handleReset = async () => {
    if (!canSubmit) return;
    const targets = RESET_TARGETS.filter(t => checked[t.id]).map(t => t.id);
    setBusy(true);
    try {
      const result = await api.resetAllData(targets);
      const d = result.deleted;
      const parts = [];
      if (d.routes)    parts.push(`${d.routes} rutas`);
      if (d.packages)  parts.push(`${d.packages} paquetes`);
      if (d.quotes)    parts.push(`${d.quotes} cotizaciones`);
      if (d.tariffs)   parts.push(`${d.tariffs} tarifas`);
      if (d.prices)    parts.push(`${d.prices} precios`);
      if (d.zones)     parts.push(`${d.zones} zonas`);
      if (d.companies) parts.push(`${d.companies} empresas`);
      toast(`🗑️ Eliminado: ${parts.join(', ') || 'nada'}`);
      setOpen(false);
      onDone?.();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        style={{ background: '#cc224408', border: '1px solid #cc224430', borderRadius: wide ? 12 : 8, padding: wide ? '11px 12px' : '4px 10px', fontSize: wide ? 13 : 11, fontWeight: wide ? 900 : 700, color: '#cc2244', cursor: 'pointer', width: wide ? '100%' : 'auto', textAlign: wide ? 'left' : 'center' }}
      >
        🗑️ Reset DB
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000070', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && !busy && setOpen(false)}
        >
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px #0006' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#cc2244' }}>Borrar datos</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Los usuarios NO se eliminan</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {RESET_TARGETS.map(t => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, border: `1px solid ${checked[t.id] ? '#cc224440' : 'var(--border)'}`, background: checked[t.id] ? '#cc224408' : 'var(--card2)', cursor: 'pointer', transition: 'all .15s' }}>
                  <input
                    type="checkbox"
                    checked={!!checked[t.id]}
                    onChange={() => toggle(t.id)}
                    style={{ marginTop: 2, accentColor: '#cc2244', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: checked[t.id] ? '#cc2244' : 'var(--text)' }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {anyChecked && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                  Escribe <strong style={{ color: '#cc2244' }}>CONFIRMAR</strong> para habilitar el botón
                </div>
                <input
                  autoFocus
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="CONFIRMAR"
                  style={{ ...inp, borderColor: confirm === 'CONFIRMAR' ? '#cc2244' : 'var(--border)', fontWeight: confirm === 'CONFIRMAR' ? 700 : 400 }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card2)', fontSize: 13, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={!canSubmit}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: canSubmit ? '#cc2244' : '#cc224430', color: canSubmit ? '#fff' : '#cc224480', fontSize: 13, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'all .15s' }}
              >
                {busy ? '⏳ Borrando…' : '🗑️ Borrar selección'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

