import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';

export default function AddRouteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    date: new Date().toISOString().slice(0, 10),
    driverId: '',
    companyId: '',
    tariffId: '',
    status: 'active',
    clientCompany: { name: '', contactPerson: '', contactPhone: '' },
    invoice: { status: 'none', amount: '', invoiceDate: '' },
    startPoint: { address: '', lat: '', lng: '' }
  });
  const [drivers, setDrivers]           = useState([]);
  const [companies, setCompanies]       = useState([]);
  const [clientCompanies, setClientCompanies] = useState([]); // registered client companies
  const [tariffs, setTariffs]           = useState([]);
  const [saving, setSaving]             = useState(false);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompany, setNewCompany]     = useState({ name: '', contactPerson: '', contactPhone: '' });
  const [savingCompany, setSavingCompany] = useState(false);

  const loadClientCompanies = () =>
    api.getCompanies().then(list => setClientCompanies(list.filter(c => c.active !== false))).catch(() => {});

  useEffect(() => {
    api.getUsers().then(users => setDrivers(users.filter(u => u.role === 'driver' && u.active))).catch(() => {});
    api.getCompanies().then(setCompanies).catch(() => {});
    api.getTariffs().then(setTariffs).catch(() => {});
    loadClientCompanies();
  }, []);

  const handleSelectClientCompany = (id) => {
    const c = clientCompanies.find(x => x._id === id);
    if (!c) { set('clientCompany', { name: '', contactPerson: '', contactPhone: '' }); return; }
    setForm(f => ({ ...f, clientCompany: { name: c.name, contactPerson: c.contactPerson || '', contactPhone: c.contactPhone || '' } }));
  };

  const handleSaveNewCompany = async () => {
    if (!newCompany.name.trim()) return toast('⚠️ Nombre requerido');
    setSavingCompany(true);
    try {
      const created = await api.createCompany(newCompany);
      await loadClientCompanies();
      setForm(f => ({ ...f, clientCompany: { name: created.name, contactPerson: created.contactPerson || '', contactPhone: created.contactPhone || '' } }));
      setShowNewCompany(false);
      setNewCompany({ name: '', contactPerson: '', contactPhone: '' });
      toast('✅ Empresa registrada');
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSavingCompany(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCompany = (k, v) => setForm(f => ({ ...f, clientCompany: { ...f.clientCompany, [k]: v } }));
  const setInvoice = (k, v) => setForm(f => ({ ...f, invoice: { ...f.invoice, [k]: v } }));
  const setStart = (k, v) => setForm(f => ({ ...f, startPoint: { ...f.startPoint, [k]: v } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        date: form.date,
        status: form.status,
        driverId: form.driverId || undefined,
        companyId: form.companyId || undefined,
        tariffId: form.tariffId || undefined,
        clientCompany: form.clientCompany,
        invoice: {
          status: form.invoice.status,
          amount: form.invoice.amount ? Number(form.invoice.amount) : undefined,
          invoiceDate: form.invoice.invoiceDate || undefined
        },
        startPoint: {
          address: form.startPoint.address || undefined,
          lat: form.startPoint.lat ? Number(form.startPoint.lat) : undefined,
          lng: form.startPoint.lng ? Number(form.startPoint.lng) : undefined
        }
      };
      const route = await api.createRoute(payload);
      toast('✅ Ruta creada: ' + route.routeCode);
      onCreated(route);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 800, display: 'flex', alignItems: 'flex-end' }}
    >
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '95dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000015' }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 13 }}>🗺 Nueva Ruta</h2>

        <Label>Nombre (opcional)</Label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Ruta Lunes Zona Norte" style={inp} />

        <Label>Fecha</Label>
        <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} />

        <Label>Estado</Label>
        <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
          <option value="draft">Borrador</option>
          <option value="active">Activa</option>
        </select>

        <Label>Driver (opcional)</Label>
        <select value={form.driverId} onChange={e => set('driverId', e.target.value)} style={inp}>
          <option value="">Sin asignar</option>
          {drivers.map(d => <option key={d._id} value={d._id}>{d.name} ({d.email})</option>)}
        </select>

        <Label>Empresa sistema (opcional)</Label>
        <select value={form.companyId} onChange={e => set('companyId', e.target.value)} style={inp}>
          <option value="">Sin empresa</option>
          {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>

        <Label>Configuración de precios (opcional)</Label>
        <select value={form.tariffId} onChange={e => set('tariffId', e.target.value)} style={inp}>
          <option value="">Sin configuración de precios</option>
          {tariffs.map(t => <option key={t._id} value={t._id}>{t.name}{t.description ? ` — ${t.description}` : ''}</option>)}
        </select>

        {/* Client company */}
        <div style={{ margin: '16px 0 5px', padding: '12px 14px', background: '#00507808', border: '1px solid #00507820', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#005078' }}>🏢 Empresa cliente</div>
            <button
              type="button"
              onClick={() => setShowNewCompany(v => !v)}
              style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 20, padding: '2px 9px', cursor: 'pointer' }}
            >
              {showNewCompany ? '✕ Cerrar' : '✚ Registrar empresa'}
            </button>
          </div>

          {/* Register new company inline */}
          {showNewCompany && (
            <div style={{ background: '#fff', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>Nueva empresa</div>
              <Label>Nombre empresa *</Label>
              <input value={newCompany.name} onChange={e => setNewCompany(n => ({ ...n, name: e.target.value }))} placeholder="Importadora ABC" style={inp} />
              <Label>Responsable / Contacto</Label>
              <input value={newCompany.contactPerson} onChange={e => setNewCompany(n => ({ ...n, contactPerson: e.target.value }))} placeholder="Nombre y apellido" style={inp} />
              <Label>Teléfono</Label>
              <input value={newCompany.contactPhone} onChange={e => setNewCompany(n => ({ ...n, contactPhone: e.target.value }))} placeholder="+56 9 xxxx xxxx" style={inp} />
              <button
                type="button"
                onClick={handleSaveNewCompany}
                disabled={savingCompany}
                style={{ width: '100%', marginTop: 9, padding: '9px', borderRadius: 9, border: 'none', background: savingCompany ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: savingCompany ? 'not-allowed' : 'pointer' }}
              >
                {savingCompany ? 'Guardando…' : '✓ Guardar empresa'}
              </button>
            </div>
          )}

          {/* Select from registered companies */}
          {clientCompanies.length > 0 && !showNewCompany && (
            <>
              <Label>Seleccionar empresa registrada</Label>
              <select
                onChange={e => handleSelectClientCompany(e.target.value)}
                defaultValue=""
                style={{ ...inp, marginBottom: 10, color: 'var(--muted)' }}
              >
                <option value="">— Elegir empresa registrada —</option>
                {clientCompanies.map(c => (
                  <option key={c._id} value={c._id}>{c.name}{c.contactPerson ? ` · ${c.contactPerson}` : ''}</option>
                ))}
              </select>
            </>
          )}

          <Label>Nombre empresa</Label>
          <input value={form.clientCompany.name} onChange={e => setCompany('name', e.target.value)} placeholder="Ej: Importadora ABC" style={inp} />
          <Label>Responsable / Contacto</Label>
          <input value={form.clientCompany.contactPerson} onChange={e => setCompany('contactPerson', e.target.value)} placeholder="Nombre y apellido" style={inp} />
          <Label>Teléfono</Label>
          <input value={form.clientCompany.contactPhone} onChange={e => setCompany('contactPhone', e.target.value)} placeholder="+56 9 xxxx xxxx" style={inp} />
        </div>

        {/* Invoice */}
        <div style={{ margin: '10px 0 5px', padding: '12px 14px', background: '#f57c0008', border: '1px solid #f57c0020', borderRadius: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f57c00', marginBottom: 10 }}>💳 Estado de factura / pago</div>
          <Label>Estado</Label>
          <select value={form.invoice.status} onChange={e => setInvoice('status', e.target.value)} style={inp}>
            <option value="none">Sin factura</option>
            <option value="pending">Pendiente de cobro</option>
            <option value="net30">Crédito 30 días (Neto 30)</option>
            <option value="paid">Pagada ✓</option>
          </select>
          {form.invoice.status !== 'none' && (
            <>
              <Label>Monto (CLP)</Label>
              <input type="number" value={form.invoice.amount} onChange={e => setInvoice('amount', e.target.value)} placeholder="0" style={inp} />
              <Label>Fecha de factura</Label>
              <input type="date" value={form.invoice.invoiceDate} onChange={e => setInvoice('invoiceDate', e.target.value)} style={inp} />
              {form.invoice.status === 'net30' && form.invoice.invoiceDate && (
                <div style={{ fontSize: 11, color: '#f57c00', marginTop: 6 }}>
                  Vence: {new Date(new Date(form.invoice.invoiceDate).getTime() + 30 * 86400000).toLocaleDateString('es-CL')}
                </div>
              )}
            </>
          )}
        </div>

        {/* Starting point */}
        <div style={{ margin: '10px 0 5px', padding: '12px 14px', background: '#00885508', border: '1px solid #00885520', borderRadius: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>📍 Punto de inicio / Bodega</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
            Desde aquí parte el repartidor. La IA usa este punto para optimizar el orden.
          </div>
          <Label>Dirección bodega / pickup</Label>
          <AddressAutocomplete
            value={form.startPoint.address}
            onChange={v => setStart('address', v)}
            onSelect={({ address, lat, lng }) => setForm(f => ({ ...f, startPoint: { address, lat, lng } }))}
            placeholder="Ej: Av. Vitacura 2939, Vitacura…"
            dropdownFixed
          />
          {form.startPoint.lat && form.startPoint.lng ? (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontWeight: 600 }}>
              ✓ Coordenadas obtenidas — aparecerá como punto #1 en el mapa
            </div>
          ) : form.startPoint.address ? (
            <div style={{ fontSize: 11, color: '#f57c00', marginTop: 6 }}>
              ⚠ Selecciona una sugerencia para obtener coordenadas exactas
            </div>
          ) : null}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 14, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Creando…' : '✓ CREAR RUTA'}
        </button>
        <button
          onClick={onClose}
          style={{ width: '100%', padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', margin: '10px 0 4px' }}>{children}</div>;
}

const inp = {
  width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10,
  color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none',
  display: 'block', WebkitAppearance: 'none', boxSizing: 'border-box'
};
