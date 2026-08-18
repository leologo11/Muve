import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';
import { formatCLP as fmt } from '../../utils/format.js';
import { openPrintWindow } from '../../utils/printWindow.js';
import { isPayableForDriver } from '../../utils/driverEarnings.js';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';
import { actBtn } from './adminHelpers.js';

function MiniMoney({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 800, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color, fontWeight: 900 }}>${Number(value || 0).toLocaleString('es-CL')}</div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', textTransform: 'uppercase', margin: '8px 0 3px' }}>{children}</div>;
}

const inp = { width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, padding: '9px 12px', outline: 'none', display: 'block', WebkitAppearance: 'none', boxSizing: 'border-box' };

export default function AdminReport({ packages, route, geocoding, onGeocode, onRouteUpdate, onReopen, onDelete, onRefresh }) {
  const [editingRoute, setEditingRoute] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tariffs, setTariffs] = React.useState([]);
  const [drivers, setDrivers] = React.useState([]);
  const [clientCompanies, setClientCompanies] = React.useState([]);
  const [geocodingStart, setGeocodingStart] = useState(false);
  const [shareToken, setShareToken] = useState(route?.shareToken || null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareRevoked, setShareRevoked] = useState(false);
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const [selectedCos, setSelectedCos] = useState(new Set());

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const data = await api.generateShareLink(route._id);
      setShareToken(data.shareToken);
      setShareRevoked(false);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setShareLoading(false); }
  };

  const handleRevokeShare = async () => {
    if (!confirm('¿Revocar el enlace? Las personas con el enlace actual ya no podrán acceder.')) return;
    try {
      await api.revokeShareLink(route._id);
      setShareToken(null);
      setShareRevoked(true);
      toast('✅ Enlace revocado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const shareUrl = shareToken ? `${window.location.origin}/route/${shareToken}` : null;

  const copyShare = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => toast('📋 Enlace copiado'));
  };

  const handleGeocodeStart = async () => {
    if (!route?.startPoint?.address) return;
    setGeocodingStart(true);
    try {
      const updated = await api.updateRoute(route._id, { startPoint: { address: route.startPoint.address } });
      onRouteUpdate(updated);
      if (updated.startPoint?.lat) toast('✅ Punto de inicio ubicado en el mapa');
      else toast('⚠ No se encontró la dirección exacta — intenta editarla');
    } catch (err) { toast('❌ ' + err.message); }
    finally { setGeocodingStart(false); }
  };

  useEffect(() => {
    api.getTariffs().then(setTariffs).catch(() => {});
    api.getUsers().then(u => setDrivers(u.filter(x => x.role === 'driver' && x.active))).catch(() => {});
    api.getCompanies().then(list => setClientCompanies(list.filter(c => c.active !== false))).catch(() => {});
  }, []);

  useEffect(() => {
    setForm({
      name: route?.name || '',
      driverId: route?.driverId?._id || (typeof route?.driverId === 'string' ? route.driverId : '') || '',
      tariffId: route?.tariffId?._id || route?.tariffId || '',
      clientCompany: { name: route?.clientCompany?.name || '', contactPerson: route?.clientCompany?.contactPerson || '', contactPhone: route?.clientCompany?.contactPhone || '' },
      invoice: {
        status: route?.invoice?.status || 'none',
        amount: route?.invoice?.amount ?? '',
        invoiceDate: route?.invoice?.invoiceDate ? new Date(route.invoice.invoiceDate).toISOString().slice(0, 10) : '',
        notes: route?.invoice?.notes || ''
      },
      driverPayout: route?.driverPayout ?? '',
      driverSettlement: {
        status: route?.driverSettlement?.status || 'pending',
        mode: route?.driverSettlement?.mode || 'proportional_delivered',
        adjustment: route?.driverSettlement?.adjustment ?? 0,
        approvedAmount: route?.driverSettlement?.approvedAmount ?? '',
        note: route?.driverSettlement?.note || ''
      },
      startPoint: { address: route?.startPoint?.address || '', lat: route?.startPoint?.lat ?? '', lng: route?.startPoint?.lng ?? '' }
    });
  }, [route]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCompany = (k, v) => setForm(f => ({ ...f, clientCompany: { ...f.clientCompany, [k]: v } }));
  const setInvoice = (k, v) => setForm(f => ({ ...f, invoice: { ...f.invoice, [k]: v } }));
  const setSettlement = (k, v) => setForm(f => ({ ...f, driverSettlement: { ...f.driverSettlement, [k]: v } }));
  const setStart = (k, v) => setForm(f => ({ ...f, startPoint: { ...f.startPoint, [k]: v } }));

  const saveRoute = async () => {
    setSaving(true);
    const prevDriverId = route?.driverId?._id || (typeof route?.driverId === 'string' ? route.driverId : '') || '';
    const driverChanged = form.driverId !== prevDriverId;
    try {
      const updated = await api.updateRoute(route._id, {
        name: form.name,
        driverId: form.driverId || null,
        tariffId: form.tariffId || null,
        clientCompany: form.clientCompany,
        invoice: { ...form.invoice, amount: form.invoice.amount !== '' ? Number(form.invoice.amount) : undefined, invoiceDate: form.invoice.invoiceDate || undefined },
        driverPayout: form.driverPayout !== '' ? Number(form.driverPayout) : null,
        driverSettlement: {
          ...form.driverSettlement,
          adjustment: Number(form.driverSettlement.adjustment || 0),
          approvedAmount: form.driverSettlement.approvedAmount !== '' ? Number(form.driverSettlement.approvedAmount) : undefined,
        },
        startPoint: { address: form.startPoint.address || undefined, lat: form.startPoint.lat !== '' ? Number(form.startPoint.lat) : undefined, lng: form.startPoint.lng !== '' ? Number(form.startPoint.lng) : undefined }
      });
      onRouteUpdate(updated);
      setEditingRoute(false);
      toast('✅ Ruta actualizada');
      // Refresh fully when driver changes so banner populates name/phone correctly
      if (driverChanged && onRefresh) onRefresh();
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const active = packages.filter(p => p.status !== 'eliminado');
  const delivered = active.filter(p => p.status === 'entregado');
  const failed = active.filter(p => p.status === 'no-entregado');
  const pending = active.filter(p => p.status === 'pendiente');

  const routeCompanies = React.useMemo(() => {
    const map = {};
    active.forEach(p => {
      if (!p.companyId) return;
      if (!map[p.companyId]) {
        const co = clientCompanies.find(c => c._id === p.companyId);
        map[p.companyId] = { id: p.companyId, name: co?.name || 'Sin empresa', count: 0 };
      }
      map[p.companyId].count++;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [active, clientCompanies]);
  const payable = active.filter(isPayableForDriver);
  const total = active.reduce((s, p) => s + (p.price || 0), 0);
  const collected = delivered.reduce((s, p) => s + (p.price || 0), 0);
  const driverSettlement = route?.driverSettlement || {};
  const driverBase = Number(route?.driverPayout || driverSettlement.baseAmount || 0);
  const driverUnitValue = active.length ? Math.round(driverBase / active.length) : 0;
  const unpaidDriverPackages = active.filter(p => !isPayableForDriver(p));
  const deliveredRatio = active.length ? payable.length / active.length : 0;
  const suggestedDriverPay = driverSettlement.mode === 'fixed'
    ? driverBase
    : driverSettlement.mode === 'manual'
      ? Number(driverSettlement.approvedAmount || driverBase || 0)
      : Math.round(driverBase * deliveredRatio);
  const driverDiscount = driverSettlement.mode === 'proportional_delivered'
    ? Math.max(0, driverBase - suggestedDriverPay)
    : 0;
  const driverAdjustment = Number(driverSettlement.adjustment || 0);
  const driverFinal = Math.max(0, Number(driverSettlement.approvedAmount || suggestedDriverPay + driverAdjustment || 0));
  const companyMargin = total - driverFinal;
  const inv = route?.invoice;
  const dueDate = inv?.dueDate ? new Date(inv.dueDate) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - Date.now()) / 86400000) : null;
  const noCoordsPackages = active.filter(p => !p.lat || !p.lng);
  const noCoords = noCoordsPackages.length;

  if (!form) return null;

  const saveDriverSettlement = async (patch = {}) => {
    const next = {
      ...form.driverSettlement,
      ...patch,
      mode: patch.mode || form.driverSettlement.mode,
      adjustment: Number((patch.adjustment ?? form.driverSettlement.adjustment) || 0),
      baseAmount: driverBase,
      calculatedAmount: suggestedDriverPay,
      driverUnitValue,
      discountAmount: driverDiscount,
      approvedAmount: patch.approvedAmount !== undefined
        ? Number(patch.approvedAmount || 0)
        : (form.driverSettlement.approvedAmount !== '' ? Number(form.driverSettlement.approvedAmount) : driverFinal),
      delivered: delivered.length,
      payable: payable.length,
      failed: failed.length,
      pending: pending.length,
      discountedPackages: unpaidDriverPackages.length,
      totalPackages: active.length,
      updatedAt: new Date().toISOString(),
    };
    if (next.status === 'paid' && !next.paidAt) next.paidAt = new Date().toISOString();
    try {
      const updated = await api.updateRoute(route._id, {
        driverPayout: driverBase || null,
        driverSettlement: next,
      });
      onRouteUpdate(updated);
      setForm(f => ({ ...f, driverSettlement: { ...f.driverSettlement, ...next } }));
      toast('Liquidacion de driver actualizada');
    } catch (err) { toast('Error: ' + err.message); }
  };

  const reviewPackagePay = async (pkg, payStatus) => {
    try {
      await api.updatePackage(pkg._id, {
        deliveryMeta: {
          ...(pkg.deliveryMeta || {}),
          payStatus,
          payReviewedAt: new Date().toISOString(),
        }
      });
      toast(payStatus === 'rejected' ? 'Pago del paquete rechazado' : 'Pago del paquete aprobado');
      onRefresh?.();
    } catch (err) { toast('Error: ' + err.message); }
  };

  const handlePrintPDF = () => {
    const delivered = packages.filter(p => p.status === 'entregado');
    const failed    = packages.filter(p => p.status === 'no-entregado');
    const pending   = packages.filter(p => p.status === 'pendiente');
    const billed    = [...delivered, ...failed];
    const total     = billed.reduce((s, p) => s + Number(p.price || 0), 0);
    const pendingAmt= pending.reduce((s, p) => s + Number(p.price || 0), 0);
    const dateStr = route.date ? new Date(route.date + 'T12:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
    const client = route.clientCompany?.name || route.companyName || '';

    const pkgRows = (list, color, badge) => list.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.customerName || ''} ${p.customerLastName || ''}</td>
        <td>${p.address || ''}${p.commune ? ', ' + p.commune : ''}${p.aptFloor ? ' · ' + p.aptFloor : ''}</td>
        <td>${p.trackingId || ''}</td>
        <td style="text-align:center"><span style="background:${color}20;color:${color};border:1px solid ${color}40;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">${badge}</span></td>
        <td style="text-align:right;font-weight:700">$${fmt(p.price)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Liquidación ${route.routeCode} · MUVE</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;background:#fff;padding:36px;font-size:13px;line-height:1.5}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:3px solid #0052FF;margin-bottom:24px}
.logo{font-size:28px;font-weight:900;color:#0052FF;letter-spacing:-1px}.logo span{color:#00DAFF}
.doc-title{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.8px;text-align:right}
.doc-number{font-size:22px;font-weight:900;color:#0052FF;text-align:right}
.doc-date{font-size:11px;color:#64748b;text-align:right}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
.card-label{font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px}
.card-value{font-size:14px;font-weight:700;color:#1e293b}
.card-sub{font-size:11px;color:#64748b;margin-top:2px}
h3{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin:18px 0 8px}
table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:12px}
thead tr{background:#0052FF}
thead th{padding:8px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;text-align:left}
tbody tr:nth-child(even){background:#f8fafc}
tbody td{padding:8px 10px;border-bottom:1px solid #e2e8f0}
.totals{display:flex;justify-content:flex-end;margin-top:20px}
.totals-box{width:260px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
.t-row{display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid #e2e8f0;font-size:12px}
.t-row:last-child{background:#0052FF;color:#fff;font-size:15px;font-weight:900;border-bottom:none}
.t-row.pending{color:#94a3b8}
.note{font-size:10px;color:#94a3b8;margin-top:6px;text-align:right}
.footer{margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
@media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <div><div class="logo">MU<span>VE</span></div><div style="font-size:10px;color:#64748b;margin-top:2px">Logística y Delivery · Chile</div></div>
  <div>
    <div class="doc-title">Liquidación de Ruta</div>
    <div class="doc-number">${route.routeCode}</div>
    <div class="doc-date">${dateStr}</div>
  </div>
</div>
<div class="info-grid">
  <div class="card"><div class="card-label">Cliente</div><div class="card-value">${client || '—'}</div>${route.clientCompany?.contactPerson ? `<div class="card-sub">${route.clientCompany.contactPerson}</div>` : ''}</div>
  <div class="card"><div class="card-label">Ruta</div><div class="card-value">${route.routeCode}${route.name ? ' · ' + route.name : ''}</div><div class="card-sub">${route.driverId?.name ? '🚗 ' + route.driverId.name : 'Sin driver'}</div></div>
</div>
${delivered.length ? `<h3>✅ Entregados (${delivered.length})</h3>
<table><thead><tr><th>#</th><th>Cliente</th><th>Dirección</th><th>Tracking</th><th>Estado</th><th style="text-align:right">Precio</th></tr></thead>
<tbody>${pkgRows(delivered, '#16a34a', 'Entregado')}</tbody></table>` : ''}
${failed.length ? `<h3>❌ No entregados — cobro por intento (${failed.length})</h3>
<table><thead><tr><th>#</th><th>Cliente</th><th>Dirección</th><th>Tracking</th><th>Estado</th><th style="text-align:right">Precio</th></tr></thead>
<tbody>${pkgRows(failed, '#ef4444', 'No entregado')}</tbody></table>` : ''}
${pending.length ? `<h3>⏳ Pendientes — sin cobrar aún (${pending.length})</h3>
<table><thead><tr><th>#</th><th>Cliente</th><th>Dirección</th><th>Tracking</th><th>Estado</th><th style="text-align:right">Precio ref.</th></tr></thead>
<tbody>${pkgRows(pending, '#94a3b8', 'Pendiente')}</tbody></table>` : ''}
<div class="totals"><div class="totals-box">
  <div class="t-row"><span>Entregados (${delivered.length})</span><span>$${fmt(delivered.reduce((s,p)=>s+Number(p.price||0),0))}</span></div>
  ${failed.length ? `<div class="t-row"><span>No entregados — cobro (${failed.length})</span><span>$${fmt(failed.reduce((s,p)=>s+Number(p.price||0),0))}</span></div>` : ''}
  ${pending.length ? `<div class="t-row pending"><span>Pendientes (${pending.length})</span><span>$${fmt(pendingAmt)}</span></div>` : ''}
  <div class="t-row"><span>TOTAL A COBRAR</span><span>$${fmt(total)}</span></div>
</div></div>
${total ? `<div class="note">* Los paquetes "No entregados" se cobran porque el repartidor se presentó en la dirección.</div>` : ''}
<div class="footer"><span>Generado por MUVE · ${new Date().toLocaleDateString('es-CL')}</span><span>📞 Consultas: ${route.clientCompany?.contactPhone || '—'}</span></div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;

    openPrintWindow(html, `liquidacion-${route.routeCode}.html`);
  };

  return (
    <div style={{ padding: '14px 10px calc(80px + env(safe-area-inset-bottom))', overflowY: 'auto', height: '100%' }}>

      {/* Geocode alert — shows exactly which packages need fixing */}
      {noCoords > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #f57c0040', borderRadius: 13, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#d4650a', fontWeight: 700 }}>
              📍 {noCoords} paquete{noCoords > 1 ? 's' : ''} sin coordenadas
            </span>
            <button
              onClick={onGeocode}
              disabled={geocoding}
              style={{ padding: '7px 14px', borderRadius: 20, border: 'none', background: geocoding ? 'var(--border)' : '#f57c00', color: '#fff', fontSize: 12, fontWeight: 700, cursor: geocoding ? 'not-allowed' : 'pointer', flexShrink: 0 }}
            >
              {geocoding ? '⏳ Geocodificando…' : '🗺️ Geocodificar ruta'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#b34a00', marginBottom: 8, lineHeight: 1.4 }}>
            Estos paquetes no aparecen en el mapa. Corrígelos en la pestaña TABLA (clic en la dirección) o llama al cliente:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {noCoordsPackages.map((p, i) => (
              <div key={p._id} style={{ background: '#fff', border: '1px solid #f57c0030', borderRadius: 9, padding: '8px 11px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#f57c00', minWidth: 18 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {p.customerName} {p.customerLastName}
                  </div>
                  <div style={{ fontSize: 11, color: '#b34a00', marginTop: 2, fontWeight: 600 }}>
                    {p.address || '—'}{p.commune ? `, ${p.commune}` : ''}{p.aptFloor ? ` · ${p.aptFloor}` : ''}
                    {p.address && !/\d/.test(p.address.trim()) && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#cc2244', background: '#cc224412', border: '1px solid #cc224428', borderRadius: 20, padding: '1px 5px' }}>
                        ⚠ Falta número
                      </span>
                    )}
                  </div>
                  {p.customerPhone && (
                    <a href={`tel:${p.customerPhone}`} style={{ fontSize: 11, color: '#0052FF', fontWeight: 600, textDecoration: 'none', marginTop: 2, display: 'block' }}>
                      📞 {p.customerPhone}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route info card */}
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)' }}>INFO DE RUTA</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handlePrintPDF} style={{ background: '#0052FF10', border: '1px solid #0052FF40', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}>
              📄 Liquidación
            </button>
            <button onClick={() => setEditingRoute(v => !v)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>
              {editingRoute ? '✕ Cancelar' : '✏️ Editar'}
            </button>
          </div>
        </div>

        {editingRoute ? (
          <div>
            <Label>Nombre de ruta</Label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Ruta Lunes Norte" style={inp} />

            <Label>Driver asignado</Label>
            <select value={form.driverId} onChange={e => set('driverId', e.target.value)} style={inp}>
              <option value="">Sin driver</option>
              {drivers.map(d => (
                <option key={d._id} value={d._id}>{d.name}{d.phone ? ` · ${d.phone}` : ''}</option>
              ))}
            </select>

            <Label>Configuración de precios</Label>
            <select value={form.tariffId} onChange={e => set('tariffId', e.target.value)} style={inp}>
              <option value="">Sin configuración de precios</option>
              {tariffs.map(t => <option key={t._id} value={t._id}>{t.name}{t.description ? ` — ${t.description}` : ''}</option>)}
            </select>

            <div style={{ margin: '14px 0 6px', padding: '11px 13px', background: '#00507808', border: '1px solid #00507820', borderRadius: 11 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#005078', marginBottom: 10 }}>🏢 EMPRESA CLIENTE</div>

              {/* Selector de empresas registradas — auto-llena los campos */}
              {clientCompanies.length > 0 && (
                <>
                  <Label>Seleccionar empresa registrada</Label>
                  <select
                    value={clientCompanies.find(c => c.name === form.clientCompany.name)?._id || ''}
                    onChange={e => {
                      const c = clientCompanies.find(x => x._id === e.target.value);
                      if (c) setForm(f => ({ ...f, clientCompany: { name: c.name, contactPerson: c.contactPerson || '', contactPhone: c.contactPhone || '' } }));
                      else setForm(f => ({ ...f, clientCompany: { name: '', contactPerson: '', contactPhone: '' } }));
                    }}
                    style={{ ...inp, marginBottom: 10 }}
                  >
                    <option value="">— Elegir empresa registrada —</option>
                    {clientCompanies.map(c => (
                      <option key={c._id} value={c._id}>{c.name}{c.contactPerson ? ` · ${c.contactPerson}` : ''}</option>
                    ))}
                  </select>
                </>
              )}

              <Label>Nombre empresa</Label>
              <input value={form.clientCompany.name} onChange={e => setCompany('name', e.target.value)} placeholder="Importadora ABC" style={inp} />
              <Label>Responsable / Contacto</Label>
              <input value={form.clientCompany.contactPerson} onChange={e => setCompany('contactPerson', e.target.value)} placeholder="Nombre y apellido" style={inp} />
              <Label>Teléfono WhatsApp</Label>
              <input value={form.clientCompany.contactPhone} onChange={e => setCompany('contactPhone', e.target.value)} placeholder="+56 9 xxxx xxxx" style={inp} />
            </div>

            <div style={{ margin: '14px 0 4px', fontSize: 11, fontWeight: 700, color: '#f57c00', letterSpacing: 1 }}>💳 FACTURA / PAGO</div>
            <Label>Estado de pago</Label>
            <select value={form.invoice.status} onChange={e => setInvoice('status', e.target.value)} style={inp}>
              <option value="none">Sin factura</option>
              <option value="pending">Pendiente de cobro</option>
              <option value="net30">Crédito 30 días (Neto 30)</option>
              <option value="paid">Pagada ✓</option>
              <option value="overdue">Vencida</option>
            </select>
            {form.invoice.status !== 'none' && (<>
              <Label>Monto (CLP)</Label>
              <input type="number" value={form.invoice.amount} onChange={e => setInvoice('amount', e.target.value)} placeholder="0" style={inp} />
              <Label>Fecha de factura</Label>
              <input type="date" value={form.invoice.invoiceDate} onChange={e => setInvoice('invoiceDate', e.target.value)} style={inp} />
              <Label>Notas</Label>
              <input value={form.invoice.notes} onChange={e => setInvoice('notes', e.target.value)} placeholder="Notas de pago" style={inp} />
            </>)}

            <div style={{ margin: '14px 0 8px', padding: '12px 14px', background: '#0052FF08', border: '1px solid #0052FF25', borderRadius: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, marginBottom: 6 }}>📍 PUNTO DE INICIO / DIRECCIÓN DE RETIRO</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Desde aquí parte el repartidor. Será el punto nº1 y el origen para la optimización de ruta.</div>
              <AddressAutocomplete
                value={form.startPoint.address}
                onChange={v => setStart('address', v)}
                onSelect={({ address, lat, lng }) => setForm(f => ({ ...f, startPoint: { address, lat, lng } }))}
                placeholder="Ej: Av. Vitacura 2939, Vitacura…"
                dropdownFixed
              />
              {form.startPoint.lat && form.startPoint.lng
                ? <div style={{ fontSize: 11, color: '#16a34a', marginTop: 6, fontWeight: 600 }}>✓ Coordenadas listas — se usará como origen en la optimización</div>
                : form.startPoint.address
                  ? <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>⚠ Selecciona una sugerencia del listado para obtener coordenadas exactas</div>
                  : null
              }
            </div>

            <div style={{ margin: '14px 0 4px', fontSize: 11, fontWeight: 700, color: '#0077aa', letterSpacing: 1 }}>PAGO DRIVER</div>
            <Label>Monto base pactado</Label>
            <input type="number" value={form.driverPayout} onChange={e => set('driverPayout', e.target.value)} placeholder="Ej: 60000" style={inp} />
            <Label>Regla de liquidacion</Label>
            <select value={form.driverSettlement.mode} onChange={e => setSettlement('mode', e.target.value)} style={inp}>
              <option value="proportional_delivered">Proporcional a entregados</option>
              <option value="fixed">Fijo si se revisa manualmente</option>
              <option value="manual">Manual</option>
            </select>
            <Label>Ajuste manual (+/-)</Label>
            <input type="number" value={form.driverSettlement.adjustment} onChange={e => setSettlement('adjustment', e.target.value)} placeholder="0" style={inp} />

            <button onClick={saveRoute} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', marginTop: 14, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Guardando…' : '✓ Guardar cambios'}
            </button>
          </div>
        ) : (
          <div>
            {/* Driver — always shown; "Asignar" button opens edit form */}
            {route?.driverId ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '9px 12px', background: '#0077aa08', border: '1px solid #0077aa20', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0077aa' }}>🚗 {route.driverId.name}</div>
                  {route.driverId.phone && (
                    <a href={`tel:${route.driverId.phone}`} style={{ fontSize: 11, color: '#0052FF', fontWeight: 600, textDecoration: 'none', marginTop: 2, display: 'block' }}>
                      📞 {route.driverId.phone}
                    </a>
                  )}
                </div>
                <button onClick={() => setEditingRoute(true)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', cursor: 'pointer', fontWeight: 700 }}>
                  Cambiar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '9px 12px', background: '#f57c0008', border: '1px solid #f57c0028', borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: '#f57c00', fontWeight: 600 }}>⚠ Sin driver asignado</span>
                <button onClick={() => setEditingRoute(true)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                  + Asignar driver
                </button>
              </div>
            )}

            {route?.name && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{route.name}</div>}
            {route?.tariffId && (
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 6 }}>
                💰 Config: {route.tariffId?.name || route.tariffId}
              </div>
            )}
            {route?.clientCompany?.name ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>🏢 {route.clientCompany.name}</div>
                {route.clientCompany.contactPerson && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>👤 {route.clientCompany.contactPerson}</div>}
                {route.clientCompany.contactPhone && (
                  <a href={`https://wa.me/${route.clientCompany.contactPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola, te contacto desde MUVE 🚚')}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#0052FF', fontWeight: 600, display: 'block', marginTop: 1 }}>
                    💬 {route.clientCompany.contactPhone}
                  </a>
                )}
              </div>
            ) : <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Sin empresa cliente asignada</div>}

            {inv && inv.status !== 'none' && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: inv.status === 'paid' ? '#f4f7ff' : inv.status === 'overdue' ? '#fce4ec' : '#fff8e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: inv.status === 'paid' ? 'var(--accent)' : inv.status === 'overdue' ? 'var(--danger)' : '#f57c00' }}>
                    💳 {{ pending: 'Por cobrar', net30: 'Neto 30', paid: 'Pagada ✓', overdue: 'Vencida' }[inv.status]}
                  </span>
                  {inv.amount ? <span style={{ fontSize: 13, fontWeight: 700 }}>${Number(inv.amount).toLocaleString('es-CL')}</span> : null}
                </div>
                {daysLeft !== null && inv.status !== 'paid' && (
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: daysLeft < 0 ? 'var(--danger)' : daysLeft <= 7 ? '#e65100' : '#f57c00' }}>
                    {daysLeft < 0 ? `⚠️ Vencida hace ${Math.abs(daysLeft)} días` : `⏳ Vence en ${daysLeft} días`}
                  </div>
                )}
                {inv.notes && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{inv.notes}</div>}
              </div>
            )}
            {route?.startPoint?.address && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>📍 Inicio: {route.startPoint.address}</span>
                {(!route.startPoint?.lat || !route.startPoint?.lng) && (
                  <button
                    onClick={handleGeocodeStart}
                    disabled={geocodingStart}
                    style={{ padding: '3px 10px', borderRadius: 20, border: 'none', background: '#f57c00', color: '#fff', fontSize: 10, fontWeight: 700, cursor: geocodingStart ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                  >
                    {geocodingStart ? '⏳…' : '🗺 Ubicar'}
                  </button>
                )}
                {route.startPoint?.lat && route.startPoint?.lng && (
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>✓ en mapa</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Driver settlement */}
      <div style={{ background: '#f8fafc', border: '1px solid #0077aa26', borderRadius: 13, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#0077aa', marginBottom: 4 }}>LIQUIDACION DRIVER</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Base ${driverBase.toLocaleString('es-CL')} · {delivered.length}/{active.length} entregados
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 20, padding: '4px 9px', color: '#0077aa', background: '#0077aa12', border: '1px solid #0077aa28' }}>
            {driverSettlement.status || 'pending'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '-4px 0 10px' }}>
          Neto ruta ${total.toLocaleString('es-CL')} · Oferta driver ${driverBase.toLocaleString('es-CL')} · {payable.length}/{active.length} pagables
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <MiniMoney label="Neto empresas" value={total} color="var(--text)" />
          <MiniMoney label="Oferta driver" value={driverBase} color="#0077aa" />
          <MiniMoney label="Valor por paquete" value={driverUnitValue} color="#64748b" />
          <MiniMoney label="Descuento no cumplidos" value={driverDiscount} color="var(--danger)" />
          <MiniMoney label="Ajuste manual" value={driverAdjustment} color={driverAdjustment < 0 ? 'var(--danger)' : '#f57c00'} />
          <MiniMoney label="Final sugerido" value={driverFinal} color="var(--accent)" />
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Regla actual: entregados e incidencias justificadas se pagan. Pendientes o incidencias sin motivo descuentan aprox. <strong>${driverUnitValue.toLocaleString('es-CL')}</strong>.
          <br />
          Pagables: <strong>{payable.length}</strong> · A revisar/descontar: <strong>{unpaidDriverPackages.length}</strong> · Marcados lejos: <strong>{active.filter(p => p.deliveryMeta?.onPoint === false).length}</strong> · Margen estimado empresa: <strong style={{ color: companyMargin < 0 ? 'var(--danger)' : 'var(--text)' }}>${companyMargin.toLocaleString('es-CL')}</strong>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => saveDriverSettlement({ status: 'calculated', approvedAmount: driverFinal })} style={actBtn('#0077aa')}>Calcular</button>
          <button onClick={() => saveDriverSettlement({ status: 'approved', approvedAmount: driverFinal })} style={actBtn('var(--accent)')}>Aprobar</button>
          <button onClick={() => saveDriverSettlement({ status: 'paid', approvedAmount: driverFinal })} style={actBtn('#16a34a')}>Marcar pagada</button>
          <button onClick={() => setEditingRoute(true)} style={actBtn('#f57c00')}>Editar regla</button>
        </div>
      </div>

      {/* Share link card */}
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 10 }}>🔗 ENLACE PARA EMPRESA</div>
        {shareUrl ? (
          <div>
            {/* Global link */}
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>TODA LA RUTA</div>
            <div style={{ background: '#f4f7ff', border: '1px solid #0052FF30', borderRadius: 10, padding: '9px 12px', marginBottom: 8, fontSize: 11, color: '#003BB5', wordBreak: 'break-all', fontFamily: 'monospace' }}>
              {shareUrl}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: routeCompanies.length > 1 ? 14 : 0 }}>
              <button onClick={copyShare} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📋 Copiar</button>
              <a href={shareUrl} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>👁 Ver</a>
              <button onClick={handleRevokeShare} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid #cc224430', background: 'none', color: '#cc2244', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🗑️</button>
            </div>

            {/* Per-company links — only shown when route has packages from multiple companies */}
            {routeCompanies.length > 1 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--muted)', marginBottom: 10 }}>POR EMPRESA</div>
                {routeCompanies.map(co => {
                  const url = `${shareUrl}?c=${co.id}`;
                  return (
                    <div key={co.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {co.name}
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 4 }}>({co.count} pkgs)</span>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(url); toast('📋 Copiado'); }}
                        style={{ padding: '5px 9px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                      >📋</button>
                      <a href={url} target="_blank" rel="noreferrer"
                        style={{ padding: '5px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 11, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                      >👁</a>
                    </div>
                  );
                })}

                {/* Multi-company selector */}
                <button
                  onClick={() => { setShowCompanyPicker(p => !p); setSelectedCos(new Set()); }}
                  style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 700 }}
                >
                  {showCompanyPicker ? '✕ Cancelar' : '⊕ Combinar empresas'}
                </button>

                {showCompanyPicker && (
                  <div style={{ marginTop: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                    {routeCompanies.map(co => (
                      <label key={co.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedCos.has(co.id)}
                          onChange={e => setSelectedCos(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(co.id); else next.delete(co.id);
                            return next;
                          })}
                        />
                        {co.name} <span style={{ color: 'var(--muted)', fontSize: 11 }}>({co.count})</span>
                      </label>
                    ))}
                    {selectedCos.size > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button
                          onClick={() => {
                            const url = `${shareUrl}?c=${[...selectedCos].join(',')}`;
                            navigator.clipboard.writeText(url);
                            toast('📋 Link combinado copiado');
                          }}
                          style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          📋 Copiar ({selectedCos.size} empresas)
                        </button>
                        <a
                          href={`${shareUrl}?c=${[...selectedCos].join(',')}`}
                          target="_blank" rel="noreferrer"
                          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                        >👁</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.4 }}>
              Genera un enlace para que la empresa vea el estado de la ruta en tiempo real sin necesidad de iniciar sesión.
            </div>
            {shareRevoked && <div style={{ fontSize: 11, color: '#cc2244', marginBottom: 8 }}>✓ Enlace anterior revocado</div>}
            <button
              onClick={handleShare}
              disabled={shareLoading}
              style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', background: shareLoading ? 'var(--border)' : '#0077aa', color: '#fff', fontSize: 13, fontWeight: 700, cursor: shareLoading ? 'not-allowed' : 'pointer' }}
            >
              {shareLoading ? '⏳ Generando…' : '🔗 Generar enlace de seguimiento'}
            </button>
          </div>
        )}
      </div>

      {/* Delivery stats */}
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 13, padding: 14, marginBottom: 14 }}>
        {[
          ['Ruta', route?.routeCode],
          ['Driver', route?.driverId?.name || 'Sin asignar'],
          ['Total paradas', active.length],
          ['Entregados', delivered.length],
          ['No entregados', failed.length],
          ['Pendientes', active.filter(p => p.status === 'pendiente').length],
          ['Eliminados', packages.filter(p => p.status === 'eliminado').length],
          ['Total ruta', '$' + total.toLocaleString('es-CL')],
          ['Cobrado', '$' + collected.toLocaleString('es-CL')],
          ['Por cobrar', '$' + (total - collected).toLocaleString('es-CL')]
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--muted)' }}>{label}</span>
            <span style={{ fontWeight: 700, color: label === 'Cobrado' ? 'var(--accent)' : 'var(--text)' }}>{val}</span>
          </div>
        ))}
      </div>

      {[
        { title: 'ENTREGADOS', items: delivered, color: 'var(--accent)', border: '#0052FF28' },
        { title: 'NO ENTREGADOS', items: failed, color: 'var(--danger)', border: '#cc224428' },
        { title: 'PENDIENTES', items: active.filter(p => p.status === 'pendiente'), color: 'var(--muted)', border: 'var(--border)' }
      ].map(({ title, items, color, border }) => items.length > 0 && (
        <div key={title}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', padding: '14px 0 7px' }}>{title} ({items.length})</div>
          {items.map(p => (
            <div key={p._id} style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.customerName} {p.customerLastName}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.address}{p.aptFloor ? `, ${p.aptFloor}` : ''}{p.commune ? `, ${p.commune}` : ''}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 5 }}>
                  ${(p.price || 0).toLocaleString('es-CL')}
                  {p.deliveredAt && ` · ${new Date(p.deliveredAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
                </div>
                {p.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>📝 {p.note}</div>}
                {p.failReason && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>↳ {p.failReason}</div>}
                {p.deliveryMeta?.distanceMeters != null && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: p.deliveryMeta.onPoint === false ? 'var(--danger)' : 'var(--accent)', marginTop: 4 }}>
                    GPS: {p.deliveryMeta.onPoint === false ? 'Lejos del punto' : 'En punto'} - {Math.round(p.deliveryMeta.distanceMeters)}m
                  </div>
                )}
                {p.deliveryMeta?.payStatus && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: p.deliveryMeta.payStatus === 'rejected' ? 'var(--danger)' : 'var(--accent)', marginTop: 4 }}>
                    Pago: {p.deliveryMeta.payStatus === 'rejected' ? 'rechazado' : 'aprobado'}
                  </div>
                )}
                {p.status === 'no-entregado' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                    <button onClick={() => reviewPackagePay(p, 'approved')} style={actBtn('var(--accent)')}>Aprobar pago</button>
                    <button onClick={() => reviewPackagePay(p, 'rejected')} style={actBtn('var(--danger)')}>Rechazar pago</button>
                  </div>
                )}
              </div>
              {(p.photoUrl || p.photo2Url) && (
                <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                  {p.photoUrl && <img src={p.photoUrl} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(p.photoUrl, '_blank')} />}
                  {p.photo2Url && <img src={p.photo2Url} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(p.photo2Url, '_blank')} />}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Reopen completed / cancelled route */}
      {(route?.status === 'completed' || route?.status === 'cancelled') && onReopen && (
        <div style={{ marginTop: 16, padding: '13px 14px', background: '#0052FF08', border: '1px solid #0052FF30', borderRadius: 13 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, letterSpacing: 1 }}>🔓 REABRIR RUTA</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Vuelve la ruta a estado "Activa" para poder editarla, agregar paquetes o corregir datos.
          </div>
          <button
            onClick={onReopen}
            style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid #0052FF50', background: '#0052FF12', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            🔓 Reabrir como activa
          </button>
        </div>
      )}

      {/* Delete route zone */}
      {onDelete && (
        <div style={{ marginTop: 16, padding: '14px', background: '#cc224408', border: '1px solid #cc224430', borderRadius: 13 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#cc2244', marginBottom: 8, letterSpacing: 1 }}>⚠️ ZONA PELIGROSA</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Eliminar la ruta borrará permanentemente todos los datos. Esta acción no se puede deshacer.
          </div>
          <button
            onClick={onDelete}
            style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid #cc224450', background: '#cc224412', color: '#cc2244', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            🗑️ Eliminar ruta permanentemente
          </button>
        </div>
      )}
    </div>
  );
}

