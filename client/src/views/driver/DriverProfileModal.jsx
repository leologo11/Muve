import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../api/index.js';

export default function DriverProfileModal({ onClose }) {
  const { user, login } = useAuth();
  const [tab, setTab] = useState('profile'); // 'profile' | 'password'

  // Profile tab state
  const [name, setName]   = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Password tab state
  const [cur, setCur]   = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [pwSaving, setPwSaving]  = useState(false);
  const [pwMsg, setPwMsg]        = useState('');
  const [pwError, setPwError]    = useState('');

  const ROLE = { admin: 'Administrador', driver: 'Conductor', company: 'Empresa' };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setSaveMsg('');
    try {
      await api.updateProfile({ name: name.trim(), phone });
      setSaveMsg('✓ Perfil actualizado');
    } catch (err) {
      setSaveMsg('⚠ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwError(''); setPwMsg('');
    if (next !== conf) { setPwError('Las contraseñas nuevas no coinciden'); return; }
    if (next.length < 6) { setPwError('Mínimo 6 caracteres'); return; }
    setPwSaving(true);
    try {
      await api.changePassword(cur, next);
      setPwMsg('✓ Contraseña actualizada');
      setCur(''); setNext(''); setConf('');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  const initials = (user?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 980, display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}>
      <div style={{ background: 'var(--card)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0', width: '100%', maxHeight: '92dvh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Avatar */}
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),var(--a2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {user?.photoUrl
                  ? <img src={user.photoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : initials}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{user?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user?.email}</div>
                <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 'var(--r-full)', border: '1px solid var(--accent-dim)' }}>
                  {ROLE[user?.role] || user?.role}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>×</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
            {[['profile', '👤 Perfil'], ['password', '🔒 Contraseña']].map(([t, lbl]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '10px 4px', fontSize: 13, fontWeight: 700, border: 'none',
                background: 'none', cursor: 'pointer',
                color: tab === t ? 'var(--accent)' : 'var(--muted)',
                borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))' }}>

          {/* ── Profile tab ── */}
          {tab === 'profile' && (
            <form onSubmit={saveProfile}>
              <Field label="Nombre completo">
                <input value={name} onChange={e => setName(e.target.value)} required
                  style={inputSt} placeholder="Tu nombre" />
              </Field>
              <Field label="Teléfono">
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  style={inputSt} placeholder="+56 9 XXXX XXXX" type="tel" />
              </Field>
              <Field label="Email (no editable)">
                <input value={user?.email || ''} disabled style={{ ...inputSt, opacity: .5 }} />
              </Field>
              {saveMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', marginBottom: 14, fontSize: 13, fontWeight: 600, background: saveMsg.startsWith('✓') ? 'var(--success-dim)' : 'var(--danger-dim)', color: saveMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>
                  {saveMsg}
                </div>
              )}
              <button type="submit" disabled={saving} style={btnSt('var(--accent)')}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          )}

          {/* ── Password tab ── */}
          {tab === 'password' && (
            <form onSubmit={savePassword}>
              <Field label="Contraseña actual">
                <input value={cur} onChange={e => setCur(e.target.value)} required type="password"
                  style={inputSt} placeholder="Tu contraseña actual" autoComplete="current-password" />
              </Field>
              <Field label="Nueva contraseña">
                <input value={next} onChange={e => setNext(e.target.value)} required type="password"
                  style={inputSt} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
              </Field>
              <Field label="Confirmar nueva contraseña">
                <input value={conf} onChange={e => setConf(e.target.value)} required type="password"
                  style={inputSt} placeholder="Repite la nueva contraseña" autoComplete="new-password" />
              </Field>
              {pwError && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', marginBottom: 14, fontSize: 13, fontWeight: 600, background: 'var(--danger-dim)', color: 'var(--danger)' }}>
                  ⚠ {pwError}
                </div>
              )}
              {pwMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', marginBottom: 14, fontSize: 13, fontWeight: 600, background: 'var(--success-dim)', color: 'var(--success)' }}>
                  {pwMsg}
                </div>
              )}
              <button type="submit" disabled={pwSaving} style={btnSt()}>
                {pwSaving ? 'Actualizando…' : 'Cambiar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputSt = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--card2)', border: '1.5px solid var(--border)',
  borderRadius: 'var(--r-sm)', padding: '13px 14px',
  fontSize: 15, color: 'var(--text)', outline: 'none',
  fontFamily: 'Inter,system-ui,sans-serif',
};

const btnSt = (color = 'var(--accent)') => ({
  width: '100%', padding: '15px 20px', borderRadius: 'var(--r-md)', border: 'none',
  background: `linear-gradient(90deg, ${color}, var(--accent-hover))`,
  color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
  fontFamily: 'Inter,system-ui,sans-serif',
  boxShadow: 'var(--shadow-md)',
});
