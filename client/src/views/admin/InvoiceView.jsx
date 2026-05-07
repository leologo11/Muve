import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

const INV_STATUS = {
  none:    { label: 'Sin factura',    color: '#aaa',          bg: '#f0f0f0' },
  pending: { label: 'Por cobrar',     color: '#f57c00',       bg: '#fff3e0' },
  net30:   { label: 'Neto 30',        color: '#0077aa',       bg: '#e3f2fd' },
  paid:    { label: '✓ Pagada',       color: '#0052FF',       bg: '#f4f7ff' },
  overdue: { label: '⚠ Vencida',      color: '#cc2244',       bg: '#fce4e8' }
};

function daysLeft(dueDate) {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate) - Date.now()) / 86400000);
}

function isEffectivelyOverdue(r) {
  const inv = r.invoice;
  if (!inv || inv.status === 'paid' || inv.status === 'none') return false;
  if (inv.status === 'overdue') return true;
  if (inv.dueDate && new Date(inv.dueDate) < new Date()) return true;
  return false;
}

export default function InvoiceView({ onBack }) {
  const [routes, setRoutes] = useState([]);
  const [filter, setFilter] = useState('all');
  const [groupBy, setGroupBy] = useState('company'); // company | status | date
  const [editRoute, setEditRoute] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRoutes()
      .then(r => setRoutes(r))
      .catch(e => toast('❌ ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = () => api.getRoutes().then(r => setRoutes(r)).catch(() => {});

  // Routes with any invoice data (exclude 'none' or undefined)
  const invoiced = routes.filter(r => r.invoice?.status && r.invoice.status !== 'none');
  // All routes for "Sin factura" section
  const noInvoice = routes.filter(r => !r.invoice?.status || r.invoice.status === 'none');

  const pendingRoutes  = invoiced.filter(r => ['pending', 'net30'].includes(r.invoice.status) && !isEffectivelyOverdue(r));
  const overdueRoutes  = invoiced.filter(r => isEffectivelyOverdue(r));
  const paidRoutes     = invoiced.filter(r => r.invoice.status === 'paid');

  const totalPending  = pendingRoutes.reduce((s, r) => s + (r.invoice?.amount || 0), 0);
  const totalOverdue  = overdueRoutes.reduce((s, r) => s + (r.invoice?.amount || 0), 0);
  const totalPaid     = paidRoutes.reduce((s, r) => s + (r.invoice?.amount || 0), 0);

  const filtered = filter === 'pending' ? pendingRoutes
    : filter === 'overdue' ? overdueRoutes
    : filter === 'paid' ? paidRoutes
    : invoiced;

  // Group routes
  function groupRoutes(list) {
    const groups = {};
    list.forEach(r => {
      const key = groupBy === 'company'
        ? (r.clientCompany?.name || 'Sin empresa cliente')
        : groupBy === 'status'
          ? (isEffectivelyOverdue(r) ? 'overdue' : r.invoice?.status || 'none')
          : new Date(r.date).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }

  const groups = groupRoutes(filtered);

  const markPaid = async (route) => {
    try {
      await api.updateRoute(route._id, { invoice: { status: 'paid' } });
      toast('✅ Marcada como pagada');
      refresh();
    } catch (err) { toast('❌ ' + err.message); }
  };

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Cargando…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '12px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--muted)', padding: '0 4px' }}>‹</button>
          <div style={{ fontSize: 17, fontWeight: 700 }}>💳 Cobros y Facturas</div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Por cobrar', amount: totalPending, color: '#f57c00', bg: '#fff3e0', onClick: () => setFilter('pending') },
            { label: 'Vencido', amount: totalOverdue, color: '#cc2244', bg: '#fce4e8', onClick: () => setFilter('overdue') },
            { label: 'Cobrado', amount: totalPaid, color: '#0052FF', bg: '#f4f7ff', onClick: () => setFilter('paid') }
          ].map(({ label, amount, color, bg, onClick }) => (
            <div key={label} onClick={onClick} style={{ background: bg, borderRadius: 12, padding: '10px 10px', cursor: 'pointer', border: `1px solid ${color}22` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color }}>
                ${amount.toLocaleString('es-CL')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters + group */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '8px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 7 }}>
          {[['all', `Todas (${invoiced.length})`], ['pending', `Por cobrar (${pendingRoutes.length})`], ['overdue', `⚠ Vencidas (${overdueRoutes.length})`], ['paid', `✓ Pagadas (${paidRoutes.length})`]].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: filter === val ? 'var(--accent)' : 'var(--card2)',
              color: filter === val ? '#fff' : 'var(--muted)'
            }}>{lbl}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Agrupar:</span>
          {[['company', '🏢 Empresa'], ['status', '📊 Estado'], ['date', '📅 Mes']].map(([val, lbl]) => (
            <button key={val} onClick={() => setGroupBy(val)} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: groupBy === val ? '#1a1a2e' : 'var(--card2)',
              color: groupBy === val ? '#fff' : 'var(--muted)'
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Route list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px calc(40px + env(safe-area-inset-bottom))' }}>
        {Object.keys(groups).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 14 }}>No hay facturas en esta categoría.</p>
          </div>
        ) : (
          Object.entries(groups).map(([groupKey, groupRoutes]) => {
            const groupTotal = groupRoutes.reduce((s, r) => s + (r.invoice?.amount || 0), 0);
            const groupPending = groupRoutes.filter(r => r.invoice?.status !== 'paid').reduce((s, r) => s + (r.invoice?.amount || 0), 0);
            const groupLabel = groupBy === 'status' ? (INV_STATUS[groupKey]?.label || groupKey) : groupKey;
            return (
              <div key={groupKey} style={{ marginBottom: 18 }}>
                {/* Group header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 2px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    {groupBy === 'company' ? '🏢 ' : groupBy === 'status' ? '📊 ' : '📅 '}{groupLabel}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    {groupPending > 0 && <span style={{ color: '#f57c00', marginRight: 8 }}>${groupPending.toLocaleString('es-CL')} pendiente</span>}
                    {groupTotal > 0 && <span style={{ color: 'var(--muted)' }}>${groupTotal.toLocaleString('es-CL')} total</span>}
                  </div>
                </div>

                {groupRoutes.map(route => (
                  <InvoiceCard
                    key={route._id}
                    route={route}
                    onMarkPaid={() => markPaid(route)}
                    onEdit={() => setEditRoute(route)}
                  />
                ))}
              </div>
            );
          })
        )}

        {/* Routes without invoices (collapsed by default) */}
        {filter === 'all' && noInvoice.length > 0 && (
          <NoInvoiceSection routes={noInvoice} onEdit={(r) => setEditRoute(r)} />
        )}
      </div>

      {/* Edit invoice modal */}
      {editRoute && (
        <InvoiceEditModal
          route={editRoute}
          saving={saving}
          onClose={() => setEditRoute(null)}
          onSave={async (data) => {
            setSaving(true);
            try {
              await api.updateRoute(editRoute._id, data);
              toast('✅ Factura actualizada');
              setEditRoute(null);
              refresh();
            } catch (err) { toast('❌ ' + err.message); }
            finally { setSaving(false); }
          }}
        />
      )}
    </div>
  );
}

function InvoiceCard({ route, onMarkPaid, onEdit }) {
  const inv = route.invoice || {};
  const overdue = isEffectivelyOverdue(route);
  const effectiveStatus = overdue ? 'overdue' : inv.status;
  const meta = INV_STATUS[effectiveStatus] || INV_STATUS.none;
  const days = daysLeft(inv.dueDate);
  const company = route.clientCompany?.name || route.driverId?.name || 'Sin empresa';

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${meta.color}28`,
      padding: '13px 15px', marginBottom: 8, boxShadow: '0 1px 4px #0000000a'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {route.name || route.routeCode}
            {route.name && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 5 }}>{route.routeCode}</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            📅 {new Date(route.date).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {route.driverId?.name && ` · 🚗 ${route.driverId.name}`}
          </div>
          {route.clientCompany?.contactPerson && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>👤 {route.clientCompany.contactPerson}</div>
          )}
          {route.clientCompany?.contactPhone && (
            <a href={`https://wa.me/${route.clientCompany.contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, te escribo desde MUVE sobre la factura de la ruta ${route.routeCode}.`)}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: '#0052FF', fontWeight: 600, display: 'block', marginTop: 1, textDecoration: 'none' }}>
              💬 {route.clientCompany.contactPhone}
            </a>
          )}
        </div>
        {/* Amount */}
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
          {inv.amount ? (
            <div style={{ fontSize: 17, fontWeight: 700, color: meta.color }}>
              ${Number(inv.amount).toLocaleString('es-CL')}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sin monto</div>
          )}
          <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Due date info */}
      {inv.dueDate && (
        <div style={{ marginBottom: 9, fontSize: 11, fontWeight: 600, color: overdue ? '#cc2244' : days != null && days <= 7 ? '#f57c00' : 'var(--muted)' }}>
          {overdue
            ? `⚠️ Vencida hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`
            : days === 0 ? '🔴 Vence hoy'
            : days != null ? `⏰ Vence en ${days} día${days !== 1 ? 's' : ''} · ${new Date(inv.dueDate).toLocaleDateString('es-CL')}`
            : null}
        </div>
      )}
      {inv.notes && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 9, padding: '6px 10px', background: 'var(--card2)', borderRadius: 8 }}>
          📝 {inv.notes}
        </div>
      )}

      {/* Stats row */}
      {route.stats && (
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--muted)', marginBottom: 9, padding: '6px 10px', background: 'var(--card2)', borderRadius: 8 }}>
          <span style={{ color: '#0052FF', fontWeight: 700 }}>✅ {route.stats.delivered}</span>
          <span style={{ color: '#cc2244', fontWeight: 700 }}>❌ {route.stats.failed}</span>
          <span>⏳ {route.stats.pending}</span>
          <span>/ {route.stats.total} pkgs</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {inv.status !== 'paid' && (
          <button onClick={onMarkPaid} style={btn('#0052FF')}>✓ Marcar pagada</button>
        )}
        <button onClick={onEdit} style={btn('#0077aa')}>✏️ Editar factura</button>
        {inv.status === 'paid' && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0052FF', padding: '5px 0', alignSelf: 'center' }}>
            ✓ Cobrada
          </span>
        )}
      </div>
    </div>
  );
}

function NoInvoiceSection({ routes, onEdit }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px dashed var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>📋 Rutas sin factura ({routes.length})</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {routes.map(r => (
            <div key={r._id} style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', padding: '10px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name || r.routeCode}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                  {new Date(r.date).toLocaleDateString('es-CL')}
                  {r.clientCompany?.name && ` · ${r.clientCompany.name}`}
                </div>
              </div>
              <button onClick={() => onEdit(r)} style={btn('#f57c00')}>+ Facturar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceEditModal({ route, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    status: route.invoice?.status || 'pending',
    amount: route.invoice?.amount ?? '',
    invoiceDate: route.invoice?.invoiceDate ? new Date(route.invoice.invoiceDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: route.invoice?.notes || '',
    clientCompany: {
      name: route.clientCompany?.name || '',
      contactPerson: route.clientCompany?.contactPerson || '',
      contactPhone: route.clientCompany?.contactPhone || ''
    },
    driverPayout: route.driverPayout ?? ''
  });
  const [uploadingInv, setUploadingInv] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [invFile, setInvFile] = useState(route.invoice?.invoiceFileUrl || null);
  const [proofFile, setProofFile] = useState(route.invoice?.paymentProofUrl || null);
  const invFileRef = useRef();
  const proofFileRef = useRef();

  const setInv = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCo = (k, v) => setForm(f => ({ ...f, clientCompany: { ...f.clientCompany, [k]: v } }));

  const net30Due = form.status === 'net30' && form.invoiceDate
    ? new Date(new Date(form.invoiceDate).getTime() + 30 * 86400000).toLocaleDateString('es-CL')
    : null;

  const margin = form.amount !== '' && form.driverPayout !== ''
    ? Number(form.amount) - Number(form.driverPayout) : null;

  const handleUpload = async (file, type) => {
    const setter = type === 'proof' ? setUploadingProof : setUploadingInv;
    setter(true);
    try {
      const result = await api.uploadInvoiceFile(route._id, file, type);
      if (type === 'proof') setProofFile(result.paymentProofUrl);
      else setInvFile(result.invoiceFileUrl);
      toast('✅ Archivo subido');
    } catch (err) { toast('❌ ' + err.message); }
    finally { setter(false); }
  };

  const handleSave = () => {
    onSave({
      invoice: {
        status: form.status,
        amount: form.amount !== '' ? Number(form.amount) : undefined,
        invoiceDate: form.invoiceDate || undefined,
        notes: form.notes || undefined
      },
      clientCompany: form.clientCompany,
      driverPayout: form.driverPayout !== '' ? Number(form.driverPayout) : undefined
    });
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 900, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '93dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000015' }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 14px' }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>💳 Factura · {route.name || route.routeCode}</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>{new Date(route.date).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

        {/* Company */}
        <SectionTitle color="#0077aa">🏢 Empresa cliente</SectionTitle>
        <FL label="Nombre empresa" value={form.clientCompany.name} onChange={v => setCo('name', v)} placeholder="Importadora ABC" />
        <FL label="Responsable" value={form.clientCompany.contactPerson} onChange={v => setCo('contactPerson', v)} placeholder="Juan Pérez" />
        <FL label="Teléfono / WhatsApp" value={form.clientCompany.contactPhone} onChange={v => setCo('contactPhone', v)} placeholder="+56 9 xxxx xxxx" />

        {/* Invoice */}
        <SectionTitle color="#f57c00">💳 Factura al cliente</SectionTitle>
        <FL label="Monto cobrado al cliente (CLP)" value={form.amount} onChange={v => setInv('amount', v)} placeholder="150000" type="number" />
        <FL label="Fecha de factura" value={form.invoiceDate} onChange={v => setInv('invoiceDate', v)} type="date" />

        <Label>Estado de pago</Label>
        <select value={form.status} onChange={e => setInv('status', e.target.value)} style={inp}>
          <option value="pending">💰 Pendiente de cobro</option>
          <option value="net30">📅 Crédito 30 días (Neto 30)</option>
          <option value="paid">✅ Pagada</option>
          <option value="overdue">⚠️ Vencida</option>
        </select>
        {net30Due && <div style={{ fontSize: 12, color: '#0077aa', padding: '6px 12px', background: '#e3f2fd', borderRadius: 8, marginTop: 6, marginBottom: 6 }}>📅 Vence el {net30Due}</div>}
        <FL label="Notas" value={form.notes} onChange={v => setInv('notes', v)} placeholder="Transferencia banco X, ref. 12345…" />

        {/* Driver payout + margin */}
        <SectionTitle color="#0052FF">🚗 Pago al repartidor</SectionTitle>
        <FL label="Monto a pagar al driver (CLP)" value={form.driverPayout} onChange={v => setForm(f => ({ ...f, driverPayout: v }))} placeholder="80000" type="number" />
        {margin !== null && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: margin >= 0 ? '#f4f7ff' : '#fce4e8', border: `1px solid ${margin >= 0 ? '#0052FF30' : '#cc224430'}`, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>GANANCIA NETA</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: margin >= 0 ? '#0052FF' : '#cc2244', marginTop: 2 }}>
              ${margin.toLocaleString('es-CL')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              ${Number(form.amount).toLocaleString('es-CL')} cliente − ${Number(form.driverPayout).toLocaleString('es-CL')} driver
            </div>
          </div>
        )}

        {/* Invoice file upload */}
        <SectionTitle color="#555">📎 Archivos</SectionTitle>
        <div style={{ marginBottom: 10 }}>
          <Label>Factura / documento</Label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => invFileRef.current.click()} disabled={uploadingInv} style={{ ...btn('#0077aa'), padding: '8px 14px', fontSize: 12, flexShrink: 0 }}>
              {uploadingInv ? '⏳…' : '📎 Subir factura'}
            </button>
            {invFile && (
              <a href={invFile} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#0077aa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Ver archivo ↗
              </a>
            )}
          </div>
          <input ref={invFileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'invoice')} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <Label>Comprobante de pago</Label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => proofFileRef.current.click()} disabled={uploadingProof} style={{ ...btn('#0052FF'), padding: '8px 14px', fontSize: 12, flexShrink: 0 }}>
              {uploadingProof ? '⏳…' : '✅ Subir comprobante'}
            </button>
            {proofFile && (
              <a href={proofFile} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#0052FF', fontWeight: 600 }}>
                Ver comprobante ↗
              </a>
            )}
          </div>
          <input ref={proofFileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'proof')} />
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Guardando…' : '✓ Guardar'}
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}>Cancelar</button>
      </div>
    </div>
  );
}

function SectionTitle({ children, color = 'var(--muted)' }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color, textTransform: 'uppercase', margin: '14px 0 6px' }}>{children}</div>;
}
function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: 'var(--muted)', textTransform: 'uppercase', margin: '10px 0 4px' }}>{children}</div>;
}
function FL({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={inp} />
    </div>
  );
}
function btn(color) {
  return { padding: '6px 13px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${color}30`, background: `${color}12`, color };
}
const inp = { width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', WebkitAppearance: 'none', display: 'block', color: 'var(--text)' };
