import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';

const STATUS_META = {
  draft:     { label: 'Borrador',       color: '#888',    bg: '#88888812' },
  sent:      { label: 'Enviada',        color: '#f57c00', bg: '#f57c0012' },
  submitted: { label: '● Recibida',     color: '#0077aa', bg: '#0077aa12' },
  approved:  { label: '✓ Aprobada',     color: '#008855', bg: '#00885512' },
  rejected:  { label: '✗ Rechazada',    color: '#cc2244', bg: '#cc224412' },
};

function normalize(str) {
  return (str || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function QuotesView() {
  const [quotes, setQuotes]     = useState([]);
  const [drivers, setDrivers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    Promise.all([api.getQuotes(), api.getUsers()])
      .then(([qs, us]) => {
        setQuotes(qs);
        setDrivers(us.filter(u => u.role === 'driver' && u.active));
      })
      .catch(err => toast('❌ ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const reload = () => api.getQuotes().then(setQuotes).catch(() => {});

  const handleReject = async (id) => {
    if (!confirm('¿Rechazar esta cotización?')) return;
    try {
      await api.rejectQuote(id);
      reload();
      toast('✗ Rechazada');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta cotización?')) return;
    try {
      await api.deleteQuote(id);
      setQuotes(prev => prev.filter(q => q._id !== id));
      toast('🗑️ Eliminada');
    } catch (err) { toast('❌ ' + err.message); }
  };

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px calc(90px + env(safe-area-inset-bottom))' }}>
      {quotes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
          <p style={{ fontSize: 14 }}>No hay cotizaciones. Crea la primera.</p>
        </div>
      )}

      {quotes.map(q => (
        <QuoteCard
          key={q._id}
          quote={q}
          drivers={drivers}
          expanded={expanded === q._id}
          onToggle={() => setExpanded(prev => prev === q._id ? null : q._id)}
          onReject={handleReject}
          onDelete={handleDelete}
          onReload={reload}
        />
      ))}

      <button
        onClick={() => setCreating(true)}
        style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16, width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px #00885540', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >＋</button>

      {creating && (
        <CreateQuoteModal
          onClose={() => setCreating(false)}
          onCreated={(q) => { setQuotes(prev => [q, ...prev]); setCreating(false); setExpanded(q._id); }}
        />
      )}
    </div>
  );
}

// ── Quote card with expand/collapse ──────────────────────────────────────────
function QuoteCard({ quote: q, drivers, expanded, onToggle, onReject, onDelete, onReload }) {
  const [driverId, setDriverId] = useState('');
  const [approving, setApproving] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [editing, setEditing] = useState(false);
  const meta = STATUS_META[q.status] || STATUS_META.draft;

  const handleApprove = async () => {
    if (!confirm(`¿Aprobar la cotización ${q.quoteCode} y crear la ruta automáticamente?`)) return;
    setApproving(true);
    try {
      const { route } = await api.approveQuote(q._id, { driverId: driverId || undefined });
      toast(`✅ Ruta creada: ${route.routeCode}`);
      onReload();
    } catch (err) { toast('❌ ' + err.message); }
    finally { setApproving(false); }
  };

  const handleSendAndCopy = async () => {
    try {
      const { shareToken } = await api.sendQuote(q._id);
      const url = `${window.location.origin}/quote/${shareToken}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast('📋 Enlace copiado');
      onReload();
    } catch (err) { toast('❌ ' + err.message); }
  };

  const copyUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast('📋 Copiado');
  };

  const total = (q.items || []).reduce((s, i) => s + (i.price || 0), 0);
  const isDone = ['approved', 'rejected'].includes(q.status);

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px #0000000a' }}>
      {/* Header row */}
      <div onClick={onToggle} style={{ padding: '13px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{q.quoteCode}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}28` }}>
              {meta.label}
            </span>
            {q.status === 'submitted' && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: '#0077aa', color: '#fff', animation: 'pulse 1.4s ease infinite' }}>NUEVA</span>
            )}
          </div>
          {q.clientCompany && <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>🏢 {q.clientCompany}</div>}
          {q.contactPerson && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>👤 {q.contactPerson}</div>}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{(q.items || []).length} paquetes</span>
            {total > 0 && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>${total.toLocaleString('es-CL')}</span>}
          </div>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{expanded ? '▴' : '▾'}</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>

          {/* Client notes (if submitted) */}
          {q.clientNotes && (
            <div style={{ padding: '9px 12px', borderRadius: 10, background: '#e3f2fd', border: '1px solid #0077aa20', marginBottom: 12, fontSize: 12, color: '#0077aa' }}>
              💬 Nota del cliente: {q.clientNotes}
            </div>
          )}

          {/* Converted route link */}
          {q.convertedRouteId && (
            <div style={{ padding: '9px 12px', borderRadius: 10, background: '#e8f5e9', border: '1px solid #00885528', marginBottom: 12, fontSize: 12, color: '#008855', fontWeight: 700 }}>
              ✓ Ruta creada: {q.convertedRouteId.routeCode}
            </div>
          )}

          {/* Share link */}
          {shareUrl ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 6 }}>{shareUrl}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={copyUrl} style={ab('var(--accent)')}>📋 Copiar</button>
                <a href={shareUrl} target="_blank" rel="noreferrer" style={{ ...ab('#0077aa'), textDecoration: 'none' }}>👁 Ver</a>
              </div>
            </div>
          ) : (
            <button onClick={handleSendAndCopy} style={{ ...ab('var(--accent)'), marginBottom: 12, width: '100%' }}>
              🔗 Generar enlace y copiar
            </button>
          )}

          {/* Package list (compact) */}
          {(q.items || []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 6 }}>PAQUETES</div>
              <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                {q.items.map((item, i) => (
                  <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.customerName} {item.customerLastName}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.address}{item.commune ? `, ${item.commune}` : ''}</div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent)', flexShrink: 0, marginLeft: 8 }}>${(item.price || 0).toLocaleString('es-CL')}</span>
                  </div>
                ))}
                <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', background: 'var(--card2)', fontWeight: 800 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--accent)' }}>${total.toLocaleString('es-CL')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Approve block */}
          {q.status === 'submitted' && (
            <div style={{ padding: '12px', borderRadius: 12, background: '#e8f5e9', border: '1px solid #00885530', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#008855', marginBottom: 8 }}>✅ Aprobar y crear ruta</div>
              <select value={driverId} onChange={e => setDriverId(e.target.value)} style={sinp}>
                <option value="">Sin driver asignado aún</option>
                {drivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
              <button onClick={handleApprove} disabled={approving} style={{ ...ab('#008855'), marginTop: 8, width: '100%', padding: '11px', fontSize: 13, fontWeight: 800, border: 'none', background: approving ? 'var(--border)' : '#008855', color: '#fff', borderRadius: 10, cursor: approving ? 'not-allowed' : 'pointer' }}>
                {approving ? 'Creando ruta…' : '✅ Aprobar y crear ruta'}
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {!isDone && (
              <button onClick={() => setEditing(true)} style={ab('var(--accent)')}>✏️ Editar</button>
            )}
            {!isDone && (
              <button onClick={() => onReject(q._id)} style={ab('#cc2244')}>✗ Rechazar</button>
            )}
            <button onClick={() => onDelete(q._id)} style={ab('var(--muted)')}>🗑️ Eliminar</button>
          </div>
        </div>
      )}

      {editing && (
        <EditQuoteModal
          quote={q}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onReload(); }}
        />
      )}
    </div>
  );
}

// ── Edit Quote Modal ──────────────────────────────────────────────────────────
function EditQuoteModal({ quote, onClose, onSaved }) {
  const [form, setForm] = useState({
    clientCompany: quote.clientCompany || '',
    contactPerson: quote.contactPerson || '',
    contactEmail:  quote.contactEmail  || '',
    contactPhone:  quote.contactPhone  || '',
    deliveryDate:  quote.deliveryDate  ? new Date(quote.deliveryDate).toISOString().slice(0, 10) : '',
    adminNotes:    quote.adminNotes    || '',
  });
  const [items, setItems] = useState([...(quote.items || [])]);
  const [addForm, setAddForm] = useState({ customerName: '', customerLastName: '', customerPhone: '', address: '', commune: '', note: '', price: '', lat: '', lng: '' });
  const [zones, setZones] = useState([]);
  const [tariff, setTariff] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getZones().then(setZones).catch(() => {});
    if (quote.tariffId) {
      api.getTariffs()
        .then(ts => setTariff(ts.find(t => t._id === (quote.tariffId?._id || quote.tariffId)) || null))
        .catch(() => {});
    }
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAdd = (k, v) => setAddForm(f => ({ ...f, [k]: v }));

  const suggestPrice = (commune) => {
    if (tariff?.items?.length) {
      const item = tariff.items.find(i => normalize(i.commune) === normalize(commune));
      if (item) return item.price;
      if (tariff.defaultPrice) return tariff.defaultPrice;
    }
    const zone = zones.find(z => normalize(z.name) === normalize(commune));
    return zone?.price || 0;
  };

  const handleAddItem = () => {
    if (!addForm.address) return;
    const price = Number(addForm.price) || suggestPrice(addForm.commune);
    setItems(prev => [...prev, {
      customerName: addForm.customerName,
      customerLastName: addForm.customerLastName,
      customerPhone: addForm.customerPhone,
      address: addForm.address,
      commune: addForm.commune,
      note: addForm.note,
      price,
      lat: addForm.lat ? Number(addForm.lat) : undefined,
      lng: addForm.lng ? Number(addForm.lng) : undefined,
    }]);
    setAddForm({ customerName: '', customerLastName: '', customerPhone: '', address: '', commune: '', note: '', price: '', lat: '', lng: '' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateQuote(quote._id, {
        ...form,
        items,
        deliveryDate: form.deliveryDate || undefined,
      });
      toast('✅ Cotización actualizada');
      onSaved();
      onClose();
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const autoPrice = suggestPrice(addForm.commune);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '95dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000015' }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>✏️ Editar cotización</h2>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{quote.quoteCode}</span>
        </div>

        {/* ── Client info ── */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 4 }}>🏢 DATOS DEL CLIENTE</div>
        <CLabel>Empresa</CLabel>
        <input value={form.clientCompany} onChange={e => set('clientCompany', e.target.value)} style={cinp} placeholder="Empresa cliente" />
        <CLabel>Responsable</CLabel>
        <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} style={cinp} placeholder="Nombre y apellido" />
        <CLabel>Email</CLabel>
        <input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} style={cinp} placeholder="correo@empresa.com" />
        <CLabel>Teléfono</CLabel>
        <input value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} style={cinp} placeholder="+56 9 xxxx xxxx" />
        <CLabel>Fecha de entrega</CLabel>
        <input type="date" value={form.deliveryDate} onChange={e => set('deliveryDate', e.target.value)} style={cinp} />
        <CLabel>Notas internas (no ve el cliente)</CLabel>
        <textarea value={form.adminNotes} onChange={e => set('adminNotes', e.target.value)} rows={2} style={{ ...cinp, resize: 'vertical' }} placeholder="Solo visible para el admin" />

        {/* ── Package list ── */}
        <div style={{ margin: '16px 0 8px', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--accent)' }}>📦 PAQUETES ({items.length})</div>
        {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textAlign: 'center', padding: '10px 0' }}>Sin paquetes aún</div>}
        {items.map((item, i) => (
          <div key={i} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', marginBottom: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{i + 1}. {item.customerName} {item.customerLastName}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.address}{item.commune ? `, ${item.commune}` : ''}</div>
              {item.price > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>${Number(item.price).toLocaleString('es-CL')}</div>}
            </div>
            <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, padding: '0 0 0 10px', flexShrink: 0, lineHeight: 1 }}>✕</button>
          </div>
        ))}

        {/* ── Add package form ── */}
        <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 8 }}>+ AGREGAR PAQUETE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <div>
              <CLabel>Nombre</CLabel>
              <input value={addForm.customerName} onChange={e => setAdd('customerName', e.target.value)} style={cinp} placeholder="Nombre" />
            </div>
            <div>
              <CLabel>Apellido</CLabel>
              <input value={addForm.customerLastName} onChange={e => setAdd('customerLastName', e.target.value)} style={cinp} placeholder="Apellido" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <CLabel>Dirección *</CLabel>
              <AddressAutocomplete
                value={addForm.address}
                onChange={v => setAdd('address', v)}
                onSelect={({ address, commune, lat, lng }) => {
                  const price = suggestPrice(commune || addForm.commune);
                  setAddForm(f => ({ ...f, address, commune: commune || f.commune, lat: lat || '', lng: lng || '', price: price || f.price }));
                }}
                placeholder="Av. Providencia 1100…"
                dropdownFixed
              />
            </div>
            <div>
              <CLabel>Comuna</CLabel>
              <input
                value={addForm.commune}
                onChange={e => {
                  const commune = e.target.value;
                  setAdd('commune', commune);
                  const suggested = suggestPrice(commune);
                  if (suggested > 0) setAdd('price', suggested);
                }}
                style={cinp}
                placeholder="Providencia"
              />
            </div>
            <div>
              <CLabel>Precio CLP {autoPrice > 0 && !addForm.price ? '(sugerido)' : ''}</CLabel>
              <input
                type="number"
                value={addForm.price}
                onChange={e => setAdd('price', e.target.value)}
                style={{ ...cinp, color: (addForm.price || autoPrice) ? 'var(--accent)' : 'var(--muted)', fontWeight: 700 }}
                placeholder={autoPrice > 0 ? autoPrice.toString() : '0'}
              />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <CLabel>Nota</CLabel>
              <input value={addForm.note} onChange={e => setAdd('note', e.target.value)} style={cinp} placeholder="Depto, instrucciones…" />
            </div>
          </div>
          <button
            onClick={handleAddItem}
            disabled={!addForm.address}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', marginTop: 10, background: addForm.address ? 'var(--accent)' : 'var(--card2)', color: addForm.address ? '#fff' : 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: addForm.address ? 'pointer' : 'not-allowed' }}
          >
            + Agregar paquete
          </button>
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Guardando…' : '✓ Guardar cambios'}
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Create Quote Modal ────────────────────────────────────────────────────────
function CreateQuoteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    clientCompany: '', contactPerson: '', contactEmail: '', contactPhone: '',
    deliveryDate: '', adminNotes: '', tariffId: ''
  });
  const [tariffs, setTariffs] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getTariffs().then(setTariffs).catch(() => {}); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        tariffId: form.tariffId || undefined,
        deliveryDate: form.deliveryDate || undefined,
      };
      const q = await api.createQuote(payload);
      onCreated(q);
      toast('✅ Cotización creada');
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 900, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000015' }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>💼 Nueva cotización</h2>

        <CLabel>Empresa cliente</CLabel>
        <input value={form.clientCompany} onChange={e => set('clientCompany', e.target.value)} placeholder="Importadora ABC" style={cinp} />
        <CLabel>Responsable / Contacto</CLabel>
        <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="Nombre y apellido" style={cinp} />
        <CLabel>Email</CLabel>
        <input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder="correo@empresa.com" style={cinp} />
        <CLabel>Teléfono / WhatsApp</CLabel>
        <input value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="+56 9 xxxx xxxx" style={cinp} />
        <CLabel>Fecha de entrega (estimada)</CLabel>
        <input type="date" value={form.deliveryDate} onChange={e => set('deliveryDate', e.target.value)} style={cinp} />
        <CLabel>Configuración de precios (opcional)</CLabel>
        <select value={form.tariffId} onChange={e => set('tariffId', e.target.value)} style={cinp}>
          <option value="">Sin configuración de precios</option>
          {tariffs.map(t => <option key={t._id} value={t._id}>{t.name}{t.description ? ` — ${t.description}` : ''}</option>)}
        </select>
        <CLabel>Notas internas (no ve el cliente)</CLabel>
        <textarea value={form.adminNotes} onChange={e => set('adminNotes', e.target.value)} placeholder="Instrucciones para el repartidor, requisitos especiales…" rows={3} style={{ ...cinp, resize: 'vertical' }} />

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 12, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Creando…' : '✓ Crear cotización'}
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function CLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: 'var(--muted)', textTransform: 'uppercase', margin: '10px 0 4px' }}>{children}</div>;
}

const cinp = { width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none', display: 'block', boxSizing: 'border-box', WebkitAppearance: 'none' };
const sinp = { width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, padding: '9px 11px', outline: 'none', display: 'block', boxSizing: 'border-box', WebkitAppearance: 'none' };
function ab(color) {
  return { padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${color}30`, background: `${color}12`, color, display: 'inline-flex', alignItems: 'center', gap: 4 };
}
