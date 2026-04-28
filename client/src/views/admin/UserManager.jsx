import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

const ROLES = ['admin', 'driver', 'company', 'customer'];
const ROLE_LABELS = { admin: '⚙️ Admin', driver: '🚗 Driver', company: '🏢 Empresa', customer: '📦 Cliente' };

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'driver', companyId: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getUsers(), api.getCompanies()])
      .then(([u, c]) => { setUsers(u); setCompanies(c); })
      .catch(e => toast('❌ ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) return toast('⚠️ Nombre, email y contraseña requeridos');
    setSaving(true);
    try {
      const user = await api.createUser({ ...form, companyId: form.companyId || undefined });
      setUsers(prev => [user, ...prev]);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'driver', companyId: '' });
      toast('✅ Usuario creado');
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (user) => {
    if (!confirm(`¿Desactivar a ${user.name}?`)) return;
    try {
      await api.deleteUser(user._id);
      setUsers(prev => prev.map(u => u._id === user._id ? { ...u, active: false } : u));
      toast('👤 Usuario desactivado');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Cargando…</div>;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px calc(90px + env(safe-area-inset-bottom))' }}>
      <button
        onClick={() => setShowForm(v => !v)}
        style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}
      >
        {showForm ? '✕ Cancelar' : '＋ Nuevo usuario'}
      </button>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 14, marginBottom: 14 }}>
          {[
            { label: 'Nombre', key: 'name', placeholder: 'Juan Pérez' },
            { label: 'Email', key: 'email', placeholder: 'juan@email.com', type: 'email' },
            { label: 'Contraseña', key: 'password', placeholder: '••••••••', type: 'password' }
          ].map(({ label, key, placeholder, type = 'text' }) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
              <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
                style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none' }} />
            </div>
          ))}

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Rol</div>
            <select value={form.role} onChange={e => set('role', e.target.value)}
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', WebkitAppearance: 'none' }}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          {form.role === 'company' && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Empresa</div>
              <select value={form.companyId} onChange={e => set('companyId', e.target.value)}
                style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', WebkitAppearance: 'none' }}>
                <option value="">Sin empresa</option>
                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <button onClick={handleCreate} disabled={saving}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', marginTop: 8, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Creando…' : '✓ Crear usuario'}
          </button>
        </div>
      )}

      {users.map(user => (
        <div key={user._id} style={{
          background: '#fff', borderRadius: 12, border: '1px solid var(--border)',
          padding: '12px 14px', marginBottom: 8, opacity: user.active ? 1 : 0.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user.email}</div>
            <span style={{
              display: 'inline-block', marginTop: 5, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: '#00885512', color: 'var(--accent)', border: '1px solid #00885528'
            }}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
            {!user.active && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--danger)' }}>Inactivo</span>}
          </div>
          {user.active && (
            <button onClick={() => handleDeactivate(user)}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              Desactivar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
