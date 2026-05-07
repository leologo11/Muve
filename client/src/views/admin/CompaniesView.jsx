import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

const empty = { name: '', rut: '', address: '', contactPerson: '', contactEmail: '', contactPhone: '', notes: '' };

export default function CompaniesView() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [mode, setMode]           = useState(null); // null | 'create' | company-object
  const [form, setForm]           = useState(empty);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');

  const load = () => {
    setLoading(true);
    api.getCompanies()
      .then(setCompanies)
      .catch(e => toast('❌ ' + e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(empty); setMode('create'); };
  const openEdit   = (c)  => {
    setForm({
      name:          c.name          || '',
      rut:           c.rut           || '',
      address:       c.address       || '',
      contactPerson: c.contactPerson || '',
      contactEmail:  c.contactEmail  || '',
      contactPhone:  c.contactPhone  || '',
      notes:         c.notes         || '',
    });
    setMode(c);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast('⚠️ Nombre requerido');
    setSaving(true);
    try {
      if (mode === 'create') {
        await api.createCompany(form);
        toast('✅ Empresa creada');
      } else {
        await api.updateCompany(mode._id, form);
        toast('✅ Empresa actualizada');
      }
      load();
      setMode(null);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (company) => {
    if (!confirm(`¿Eliminar "${company.name}"? Las rutas existentes mantienen sus datos.`)) return;
    try {
      await api.deleteCompany(company._id);
      setCompanies(prev => prev.filter(c => c._id !== company._id));
      toast('🗑️ Empresa eliminada');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    return !q || [c.name, c.rut, c.contactPerson, c.contactEmail, c.contactPhone].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toolbar */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '8px 12px', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar empresa, RUT, contacto…"
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 22, padding: '8px 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 6 }}>
          {loading ? 'Cargando…' : `${filtered.length} empresa${filtered.length !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px calc(90px + env(safe-area-inset-bottom))' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>No hay empresas registradas</div>
            <div style={{ fontSize: 12 }}>Crea la primera con el botón +</div>
          </div>
        ) : (
          filtered.map(c => (
            <CompanyCard key={c._id} company={c} onEdit={() => openEdit(c)} onDelete={() => handleDelete(c)} />
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={openCreate}
        style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16, width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px #0052FF40', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >＋</button>

      {/* Edit / Create sheet */}
      {mode !== null && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setMode(null); }}
          style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 800, display: 'flex', alignItems: 'flex-end' }}
        >
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '95dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000015' }}>
            <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
              {mode === 'create' ? '🏢 Nueva empresa' : `✏️ Editar: ${mode.name}`}
            </h2>

            <Label>Nombre *</Label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Importadora ABC SpA" style={inp} />

            <Label>RUT</Label>
            <input value={form.rut} onChange={e => set('rut', e.target.value)} placeholder="76.123.456-7" style={inp} />

            <Label>Dirección</Label>
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Av. Providencia 1234, Providencia" style={inp} />

            <div style={{ margin: '14px 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#005078', textTransform: 'uppercase' }}>📞 Contacto</div>

            <Label>Persona de contacto</Label>
            <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="Nombre y apellido" style={inp} />

            <Label>Teléfono / WhatsApp</Label>
            <input value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="+56 9 xxxx xxxx" style={inp} type="tel" />

            <Label>Email</Label>
            <input value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder="contacto@empresa.cl" style={inp} type="email" />

            <Label>Notas internas</Label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Ej: paga a 30 días, entregar en bodega B…"
              rows={2}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
            />

            <button
              onClick={handleSave}
              disabled={saving}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 14, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Guardando…' : mode === 'create' ? '✓ CREAR EMPRESA' : '✓ GUARDAR CAMBIOS'}
            </button>
            <button
              onClick={() => setMode(null)}
              style={{ width: '100%', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}
            >Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyCard({ company: c, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px #0000000a' }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '13px 14px', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, marginRight: 12 }}>
          🏢
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</div>
          {c.rut && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>RUT {c.rut}</div>}
          {c.contactPerson && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>👤 {c.contactPerson}</div>
          )}
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted)', transition: 'transform .15s', transform: expanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▾</div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {c.contactPhone && (
              <a href={`https://wa.me/${c.contactPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola, te contacto desde MUVE 🚚')}`}
                target="_blank" rel="noreferrer"
                style={{ fontSize: 13, color: '#0052FF', fontWeight: 600, textDecoration: 'none' }}>
                💬 {c.contactPhone}
              </a>
            )}
            {c.contactEmail && (
              <a href={`mailto:${c.contactEmail}`} style={{ fontSize: 12, color: '#0077aa', textDecoration: 'none' }}>
                ✉️ {c.contactEmail}
              </a>
            )}
            {c.address && <div style={{ fontSize: 12, color: 'var(--muted)' }}>📍 {c.address}</div>}
            {c.notes && (
              <div style={{ fontSize: 11, color: '#3366cc', background: '#3b82f608', borderRadius: 6, padding: '5px 9px', marginTop: 2 }}>
                📝 {c.notes}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={onEdit} style={actionBtn('var(--accent)')}>✏️ Editar</button>
            {c.contactPhone && (
              <a href={`tel:${c.contactPhone}`} style={{ ...actionBtn('#0052FF'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>📞 Llamar</a>
            )}
            <button onClick={onDelete} style={actionBtn('var(--danger)')}>🗑️ Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', margin: '10px 0 4px' }}>{children}</div>;
}

function actionBtn(color) {
  return { padding: '6px 12px', borderRadius: 20, border: `1px solid ${color}28`, background: `${color}12`, color, fontSize: 11, fontWeight: 700, cursor: 'pointer' };
}

const inp = { width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none', display: 'block', WebkitAppearance: 'none', boxSizing: 'border-box' };
