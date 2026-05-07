import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

const ROLES = ['admin', 'driver', 'company'];
const ROLE_LABELS = { admin: '⚙️ Admin', driver: '🚗 Driver', company: '🏢 Empresa' };
const VEHICLE_TYPES = ['Camión', 'Camión 3/4', 'Camión largo', 'Camioneta', 'Furgón', 'Auto', 'Moto'];

const emptyForm = { name: '', email: '', password: '', role: 'driver', companyId: '', phone: '', vehicles: [], companyName: '', rut: '' };

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [mode, setMode] = useState(null); // null | 'create' | { user }
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getUsers(), api.getCompanies()])
      .then(([u, c]) => { setUsers(u); setCompanies(c); })
      .catch(e => toast('❌ ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => {
    setForm(emptyForm);
    setMode('create');
  };

  const openEdit = (user) => {
    const vehicles = Array.isArray(user.vehicles) && user.vehicles.length > 0
      ? user.vehicles
      : (user.vehicle ? [{ type: user.vehicle, plate: user.licensePlate || '' }] : []);
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'driver',
      companyId: user.companyId?._id || user.companyId || '',
      phone: user.phone || '',
      vehicles,
      companyName: user.companyName || '',
      rut: user.rut || ''
    });
    setMode(user);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return toast('⚠️ Nombre y email requeridos');
    if (mode === 'create' && !form.password) return toast('⚠️ Contraseña requerida');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        phone: form.phone || undefined,
        companyId: form.companyId || undefined,
        vehicles: form.role === 'driver' ? form.vehicles.filter(v => v.type) : undefined,
        companyName: form.role === 'company' ? form.companyName || undefined : undefined,
        rut: form.role === 'company' ? form.rut || undefined : undefined
      };
      if (form.password) payload.password = form.password;

      if (mode === 'create') {
        const user = await api.createUser(payload);
        setUsers(prev => [user, ...prev]);
        toast('✅ Usuario creado');
      } else {
        const updated = await api.updateUser(mode._id, payload);
        setUsers(prev => prev.map(u => u._id === mode._id ? updated : u));
        toast('✅ Usuario actualizado');
      }
      setMode(null);
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
        onClick={mode ? () => setMode(null) : openCreate}
        style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: mode ? 'var(--border)' : 'var(--accent)', color: mode ? 'var(--text)' : '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}
      >
        {mode ? '✕ Cancelar' : '＋ Nuevo usuario'}
      </button>

      {mode && (
        <UserForm
          form={form}
          set={set}
          companies={companies}
          saving={saving}
          isEdit={mode !== 'create'}
          onSave={handleSave}
        />
      )}

      {!mode && users.map(user => (
        <UserCard
          key={user._id}
          user={user}
          companies={companies}
          onEdit={() => openEdit(user)}
          onDeactivate={() => handleDeactivate(user)}
        />
      ))}
    </div>
  );
}

function UserForm({ form, set, companies, saving, isEdit, onSave }) {
  const inp = (key, label, opts = {}) => (
    <div style={{ marginBottom: 8 }}>
      <div style={labelStyle}>{label}</div>
      <input
        type={opts.type || 'text'}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={opts.placeholder || ''}
        style={inputStyle}
      />
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 14, marginBottom: 14 }}>
      {inp('name', 'Nombre', { placeholder: 'Juan Pérez' })}
      {inp('email', 'Email', { type: 'email', placeholder: 'juan@email.com' })}
      {inp('password', isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña', { type: 'password', placeholder: '••••••••' })}
      {inp('phone', 'Teléfono', { placeholder: '+56 9 1234 5678' })}

      <div style={{ marginBottom: 8 }}>
        <div style={labelStyle}>Rol</div>
        <select value={form.role} onChange={e => set('role', e.target.value)} style={inputStyle}>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      {form.role === 'driver' && (
        <div style={{ marginBottom: 8 }}>
          <div style={labelStyle}>Vehículos</div>
          {form.vehicles.map((v, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <select
                value={v.type}
                onChange={e => set('vehicles', form.vehicles.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="">Tipo…</option>
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                value={v.plate}
                onChange={e => set('vehicles', form.vehicles.map((x, j) => j === i ? { ...x, plate: e.target.value } : x))}
                placeholder="Patente"
                style={{ ...inputStyle, width: 110 }}
              />
              <button
                type="button"
                onClick={() => set('vehicles', form.vehicles.filter((_, j) => j !== i))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }}
              >✕</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set('vehicles', [...form.vehicles, { type: '', plate: '' }])}
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'none', border: '1.5px dashed var(--accent)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', width: '100%', marginTop: 2 }}
          >
            + Agregar vehículo
          </button>
        </div>
      )}

      {form.role === 'company' && (
        <>
          {inp('companyName', 'Nombre empresa', { placeholder: 'MiEmpresa Ltda.' })}
          {inp('rut', 'RUT empresa', { placeholder: '76.543.210-K' })}
          <div style={{ marginBottom: 8 }}>
            <div style={labelStyle}>Empresa vinculada</div>
            <select value={form.companyId} onChange={e => set('companyId', e.target.value)} style={inputStyle}>
              <option value="">Sin empresa</option>
              {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        </>
      )}

      <button
        onClick={onSave}
        disabled={saving}
        style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', marginTop: 8, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
      >
        {saving ? 'Guardando…' : isEdit ? '✓ Guardar cambios' : '✓ Crear usuario'}
      </button>
    </div>
  );
}

function UserCard({ user, companies, onEdit, onDeactivate }) {
  const company = companies.find(c => c._id === (user.companyId?._id || user.companyId));
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid var(--border)',
      padding: '12px 14px', marginBottom: 8, opacity: user.active === false ? 0.5 : 1
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{user.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{user.email}</div>
          {user.phone && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>📞 {user.phone}</div>}
          {(Array.isArray(user.vehicles) && user.vehicles.length > 0
            ? user.vehicles
            : user.vehicle ? [{ type: user.vehicle, plate: user.licensePlate || '' }] : []
          ).map((v, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
              🚘 {v.type}{v.plate ? ` · ${v.plate}` : ''}{i === 0 && user.vehicles?.length > 1 ? ' (principal)' : ''}
            </div>
          ))}
          {user.companyName && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>🏢 {user.companyName}{user.rut ? ` · ${user.rut}` : ''}</div>}
          {company && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Vinculado a: {company.name}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#0052FF12', color: 'var(--accent)', border: '1px solid #0052FF28' }}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
            {user.active === false && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#cc224415', color: 'var(--danger)', border: '1px solid #cc224428' }}>Inactivo</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 10, flexShrink: 0 }}>
          <button onClick={onEdit} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 10px' }}>
            ✏️ Editar
          </button>
          {user.active !== false && (
            <button onClick={onDeactivate} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>
              Desactivar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 };
const inputStyle = { width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', WebkitAppearance: 'none', display: 'block' };
