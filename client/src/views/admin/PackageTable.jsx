import React, { useState, useRef } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';

const STATUS_OPTS = [
  { value: 'pendiente', label: '⏳ Pendiente', bg: '#fff8e1', color: '#f57c00' },
  { value: 'entregado', label: '✅ Entregado', bg: '#f4f7ff', color: '#2e7d32' },
  { value: 'no-entregado', label: '❌ No entregado', bg: '#fce4ec', color: '#c62828' }
];

function hasNumber(address) {
  return !address || /\d/.test(address.trim());
}

export default function PackageTable({ packages, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(null);
  const [locked, setLocked] = useState(false);
  const addrPickedRef = useRef(false);

  const active = packages.filter(p => p.status !== 'eliminado');

  const startEdit = (pkg, field) => {
    addrPickedRef.current = false;
    setEditing({ id: pkg._id, field });
    setVal(String(pkg[field] ?? ''));
  };

  const commitEdit = async (pkg, field) => {
    if (!editing || editing.id !== pkg._id || editing.field !== field) return;
    if (field === 'address' && addrPickedRef.current) { setEditing(null); return; }
    setEditing(null);
    const newVal = field === 'price' ? (Number(val) || 0) : val.trim();
    if (String(newVal) === String(pkg[field] ?? '')) return;
    const updates = { [field]: newVal };
    if (field === 'address') { updates.lat = null; updates.lng = null; }
    setSaving(pkg._id);
    try {
      const updated = await api.updatePackage(pkg._id, updates);
      onUpdate(updated);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(null);
    }
  };

  const saveFromAutocomplete = async (pkg, { address, commune, lat, lng }) => {
    addrPickedRef.current = true;
    setEditing(null);
    setSaving(pkg._id);
    try {
      const updates = { address };
      if (commune) updates.commune = commune;
      if (lat)     updates.lat = lat;
      if (lng)     updates.lng = lng;
      const updated = await api.updatePackage(pkg._id, updates);
      onUpdate(updated);
      toast('📍 Dirección actualizada y geocodificada');
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleStatusChange = async (pkg, status) => {
    setSaving(pkg._id);
    try {
      const updated = await api.updatePackage(pkg._id, { status });
      onUpdate(updated);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(null);
    }
  };

  const cell = (pkg, field, display, type = 'text') => {
    const isEditing = editing?.id === pkg._id && editing?.field === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          value={val}
          type={type}
          onChange={e => setVal(e.target.value)}
          onBlur={() => commitEdit(pkg, field)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit(pkg, field);
            if (e.key === 'Escape') setEditing(null);
          }}
          style={{ width: '100%', border: '2px solid var(--accent)', borderRadius: 4, padding: '3px 5px', fontSize: 12, outline: 'none', background: '#fffbe6', boxSizing: 'border-box' }}
        />
      );
    }
    return (
      <span
        onClick={() => saving !== pkg._id && startEdit(pkg, field)}
        title="Clic para editar"
        style={{ cursor: 'text', display: 'block', padding: '2px 4px', borderRadius: 4, minHeight: 18, wordBreak: 'break-word' }}
      >
        {display !== undefined ? display : (pkg[field] ?? '—')}
      </span>
    );
  };

  const addressCell = (pkg) => {
    const isEditing = editing?.id === pkg._id && editing?.field === 'address';
    const noCoords  = !pkg.lat || !pkg.lng;
    const noNumber  = pkg.address && !hasNumber(pkg.address);
    const aiFlag    = pkg.aiFlags?.includes('address');

    if (isEditing) {
      return (
        <div style={{ minWidth: 220 }}>
          <AddressAutocomplete
            value={val}
            onChange={v => setVal(v)}
            onSelect={sel => saveFromAutocomplete(pkg, sel)}
            placeholder="Dirección con número…"
          />
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>
            Selecciona del menú para geocodificar · Esc = cancelar
          </div>
        </div>
      );
    }

    const badges = [];
    if (noCoords) badges.push(
      <span key="geo"
        onClick={() => saving !== pkg._id && startEdit(pkg, 'address')}
        style={badge('#d4650a', true)}
      >📍 Sin mapa · clic para corregir</span>
    );
    if (noNumber) badges.push(
      <span key="num" style={badge('#b34a00', false)}>⚠ Falta número</span>
    );
    if (aiFlag) badges.push(
      <span key="ai" style={badge('#7b1fa2', false)}>🤖 IA incierta</span>
    );

    return (
      <div>
        <span
          onClick={() => saving !== pkg._id && startEdit(pkg, 'address')}
          title="Clic para editar dirección"
          style={{
            cursor: 'text', display: 'block', padding: '2px 4px', borderRadius: 4,
            wordBreak: 'break-word', minHeight: 18,
            color: noCoords ? '#b34a00' : 'inherit',
            fontWeight: noCoords ? 600 : 'inherit',
          }}
        >
          {pkg.address ?? '—'}
        </span>
        {badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
            {badges}
          </div>
        )}
      </div>
    );
  };

  if (active.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>
        Sin paquetes activos
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'auto', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 680 }}>
        <thead>
          <tr style={{ background: 'var(--card2)', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 1px 0 var(--border)' }}>
            {['#', 'Nombre', 'Dirección / Comuna', 'Teléfono', 'Precio', 'Estado', 'Nota', '📷', ''].map(h => (
              <th key={h} style={{ padding: '8px 8px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: 'var(--muted)', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)' }}>{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {active.map((pkg, i) => {
            const isSaving  = saving === pkg._id;
            const st        = STATUS_OPTS.find(o => o.value === pkg.status);
            const needsWork = (!pkg.lat || !pkg.lng) && pkg.status === 'pendiente';
            return (
              <tr
                key={pkg._id}
                style={{
                  background: isSaving ? '#f0f9f0' : needsWork ? '#fffaf3' : i % 2 === 0 ? '#fff' : 'var(--card2)',
                  borderBottom: `1px solid ${needsWork ? '#d4650a22' : 'var(--border)'}`,
                  borderLeft: `3px solid ${needsWork ? '#d4650a' : 'transparent'}`,
                  opacity: isSaving ? 0.7 : 1,
                  transition: 'background .2s'
                }}
              >
                <td style={{ padding: '6px 8px', color: needsWork ? '#d4650a' : 'var(--muted)', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{i + 1}</td>

                <td style={{ padding: '4px 6px', minWidth: 120, verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600 }}>{cell(pkg, 'customerName')}</div>
                  <div style={{ color: 'var(--muted)' }}>{cell(pkg, 'customerLastName')}</div>
                </td>

                <td style={{ padding: '4px 6px', minWidth: 170, verticalAlign: 'top' }}>
                  {addressCell(pkg)}
                  <div style={{ color: 'var(--muted)' }}>{cell(pkg, 'commune')}</div>
                  {pkg.aptFloor && <div style={{ color: 'var(--muted)', fontSize: 11 }}>{cell(pkg, 'aptFloor')}</div>}
                </td>

                <td style={{ padding: '4px 6px', minWidth: 105, verticalAlign: 'top' }}>
                  {cell(pkg, 'customerPhone')}
                </td>

                <td style={{ padding: '4px 6px', minWidth: 80, verticalAlign: 'top' }}>
                  {cell(pkg, 'price', pkg.price ? `$${pkg.price.toLocaleString('es-CL')}` : '—', 'number')}
                </td>

                <td style={{ padding: '4px 6px', minWidth: 130, verticalAlign: 'top' }}>
                  <select
                    value={pkg.status}
                    disabled={isSaving}
                    onChange={e => handleStatusChange(pkg, e.target.value)}
                    style={{ fontSize: 11, padding: '4px 6px', borderRadius: 8, border: '1px solid var(--border)', background: st?.bg || '#fff', color: st?.color || 'var(--text)', fontWeight: 700, cursor: 'pointer', WebkitAppearance: 'none', width: '100%' }}
                  >
                    {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>

                <td style={{ padding: '4px 6px', minWidth: 120, verticalAlign: 'top' }}>
                  {cell(pkg, 'note')}
                </td>

                <td style={{ padding: '4px 6px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {pkg.photoUrl && (
                      <img
                        src={pkg.photoUrl}
                        alt="foto 1"
                        onClick={() => window.open(pkg.photoUrl, '_blank')}
                        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', transition: 'opacity .15s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '.7'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        title="Ver foto 1"
                      />
                    )}
                    {pkg.photo2Url && (
                      <img
                        src={pkg.photo2Url}
                        alt="foto 2"
                        onClick={() => window.open(pkg.photo2Url, '_blank')}
                        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', transition: 'opacity .15s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '.7'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        title="Ver foto 2"
                      />
                    )}
                  </div>
                </td>

                <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(pkg)}
                      disabled={isSaving}
                      title="Eliminar paquete"
                      style={{ background: 'none', border: '1px solid #e5534b', borderRadius: 6, color: '#e5534b', cursor: 'pointer', fontSize: 13, padding: '3px 7px', lineHeight: 1, opacity: isSaving ? 0.4 : 1, transition: 'background .15s, color .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e5534b'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#e5534b'; }}
                    >
                      🗑
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function badge(color, clickable) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 2,
    fontSize: 9, fontWeight: 700,
    color, background: `${color}10`, border: `1px solid ${color}28`,
    borderRadius: 20, padding: '1px 6px',
    whiteSpace: 'nowrap',
    cursor: clickable ? 'pointer' : 'default',
  };
}
