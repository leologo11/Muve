import React, { useState, useEffect } from 'react';
import { api } from '../../api/index.js';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';
import { toast } from '../../components/Toast.jsx';

const IVA_RATE = 19;
const fmt = n => Math.round(Number(n) || 0).toLocaleString('es-CL');
const UNITS = ['unidad', 'servicio', 'viaje', 'hora', 'día', 'persona', 'm³', 'km', 'caja', 'piso'];

const QUICK_ITEMS = [
  { icon: '🚐', label: 'Furgón',            description: 'Traslado en furgón',               unit: 'viaje',    unitPrice: 35000  },
  { icon: '🚚', label: 'Camión 3/4',        description: 'Traslado en camión 3/4',            unit: 'viaje',    unitPrice: 80000  },
  { icon: '🚛', label: 'Camión grande',     description: 'Traslado en camión largo',           unit: 'viaje',    unitPrice: 150000 },
  { icon: '📦', label: 'Embalaje',          description: 'Embalaje profesional de artículos',  unit: 'servicio', unitPrice: 45000  },
  { icon: '👷', label: 'Ayudante',          description: 'Ayudante de carga/descarga',         unit: 'persona',  unitPrice: 25000  },
  { icon: '🔧', label: 'Armado/Desarmado',  description: 'Armado y desarmado de muebles',      unit: 'servicio', unitPrice: 30000  },
  { icon: '🏗️', label: 'Piso sin ascensor', description: 'Cargo por piso sin ascensor',        unit: 'piso',     unitPrice: 6000   },
  { icon: '🚨', label: 'Urgente',           description: 'Cargo adicional por urgencia',       unit: 'servicio', unitPrice: 20000  },
];

function newItem(id) {
  return { id, description: '', qty: 1, unit: 'unidad', unitPrice: '' };
}

function randomCode() {
  return `P-${new Date().getFullYear()}-${Math.floor(Math.random() * 8000 + 1000)}`;
}

function buildPDFHtml({ code, date, validDays, clientName, clientPhone, clientEmail,
  originAddress, destinationAddress, distanceKm, showKm,
  items, subtotal, discountAmount, ivaAmount, total, includeIVA, notes }) {

  const dateStr = new Date(date + 'T12:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  const validDate = new Date(date + 'T12:00');
  validDate.setDate(validDate.getDate() + (Number(validDays) || 7));
  const validStr = validDate.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

  const hasRoute = originAddress || destinationAddress;

  const rowsHtml = items.filter(i => i.description || Number(i.unitPrice) > 0).map(item => {
    const rowTotal = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
    return `<tr>
      <td>${item.description || '—'}</td>
      <td class="center">${item.qty}</td>
      <td class="center">${item.unit}</td>
      <td class="right">$${fmt(item.unitPrice)}</td>
      <td class="right bold">$${fmt(rowTotal)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Presupuesto ${code} · MUVE</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;background:#fff;padding:40px;font-size:13.5px;line-height:1.5}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:22px;border-bottom:3px solid #0052FF;margin-bottom:28px}
.logo{font-size:32px;font-weight:900;color:#0052FF;letter-spacing:-1.5px}.logo span{color:#00DAFF}
.logo-sub{font-size:11px;color:#64748b;margin-top:2px;font-weight:500}
.doc-info{text-align:right}
.doc-title{font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.8px}
.doc-number{font-size:26px;font-weight:900;color:#0052FF;margin:2px 0}
.doc-date{font-size:12px;color:#64748b}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:22px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px}
.card-label{font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:7px}
.card-name{font-size:15px;font-weight:800;color:#1e293b;margin-bottom:3px}
.card-detail{font-size:12px;color:#64748b;margin-top:2px}
.route-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 16px;margin-bottom:22px;display:flex;flex-wrap:wrap;gap:8px 32px}
.route-item{font-size:12.5px;color:#1e293b}
.route-item span{font-weight:700}
table{width:100%;border-collapse:collapse;margin-bottom:22px}
thead tr{background:#0052FF}
thead th{padding:10px 14px;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:left}
.center{text-align:center!important}.right{text-align:right!important}.bold{font-weight:700}
tbody tr:nth-child(even){background:#f8fafc}
tbody td{padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px}
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:22px}
.totals{width:280px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
.totals-row{display:flex;justify-content:space-between;padding:9px 16px;border-bottom:1px solid #e2e8f0;font-size:13px}
.totals-row:last-child{border-bottom:none;background:#0052FF;color:#fff;font-size:16px;font-weight:900;border-radius:0 0 9px 9px;padding:12px 16px}
.totals-row.discount{color:#059669}
.notes-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px 16px;margin-bottom:26px}
.notes-label{font-size:10px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
.notes-text{font-size:12.5px;color:#1e293b;line-height:1.65;white-space:pre-wrap}
.footer{display:flex;justify-content:space-between;align-items:flex-end;padding-top:18px;border-top:1px solid #e2e8f0}
.validity{font-size:12px;color:#64748b}
.validity strong{color:#1e293b}
.badge{display:inline-block;margin-top:6px;background:#0052FF12;color:#0052FF;border:1px solid #0052FF30;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:800}
.contact-col{text-align:right;font-size:12px;color:#64748b;line-height:1.8}
@media print{body{padding:20px}@page{margin:1.5cm;size:A4}}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">MU<span>VE</span></div>
    <div class="logo-sub">Logística y Delivery · Chile</div>
  </div>
  <div class="doc-info">
    <div class="doc-title">Presupuesto de Servicios</div>
    <div class="doc-number">${code}</div>
    <div class="doc-date">Fecha: ${dateStr}</div>
  </div>
</div>

<div class="grid2">
  <div class="card">
    <div class="card-label">Emitido por</div>
    <div class="card-name">MUVE Logística</div>
    <div class="card-detail">📞 +56 9 5202 3504</div>
    <div class="card-detail">✉️ contacto@muve.cl</div>
    <div class="card-detail">🌐 muve.cl</div>
  </div>
  <div class="card">
    <div class="card-label">Para</div>
    <div class="card-name">${clientName || 'Cliente'}</div>
    ${clientPhone ? `<div class="card-detail">📞 ${clientPhone}</div>` : ''}
    ${clientEmail ? `<div class="card-detail">✉️ ${clientEmail}</div>` : ''}
  </div>
</div>

${hasRoute ? `<div class="route-box">
  ${originAddress      ? `<div class="route-item">📍 <span>Origen:</span> ${originAddress}</div>` : ''}
  ${destinationAddress ? `<div class="route-item">🏁 <span>Destino:</span> ${destinationAddress}</div>` : ''}
  ${showKm && distanceKm ? `<div class="route-item">📏 <span>Distancia:</span> ${distanceKm} km</div>` : ''}
</div>` : ''}

<table>
  <thead>
    <tr>
      <th style="width:42%">Descripción</th>
      <th style="width:10%;text-align:center">Cant.</th>
      <th style="width:12%;text-align:center">Unidad</th>
      <th style="width:18%;text-align:right">Precio unit.</th>
      <th style="width:18%;text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>

<div class="totals-wrap">
  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span class="bold">$${fmt(subtotal)}</span></div>
    ${discountAmount > 0 ? `<div class="totals-row discount"><span>Descuento</span><span>−$${fmt(discountAmount)}</span></div>` : ''}
    ${includeIVA ? `<div class="totals-row"><span>IVA (${IVA_RATE}%)</span><span class="bold">$${fmt(ivaAmount)}</span></div>` : ''}
    <div class="totals-row"><span>TOTAL</span><span>$${fmt(total)}</span></div>
  </div>
</div>

${notes ? `<div class="notes-box"><div class="notes-label">Notas y condiciones</div><div class="notes-text">${notes}</div></div>` : ''}

<div class="footer">
  <div class="validity">
    <div>Válido hasta el <strong>${validStr}</strong></div>
    <div class="badge">⏳ ${validDays} días</div>
  </div>
  <div class="contact-col">
    <div>+56 9 5202 3504</div>
    <div>contacto@muve.cl</div>
    <div>muve.cl</div>
  </div>
</div>
<script>window.onload=function(){window.print()}<\/script>
</body>
</html>`;
}

export default function PresupuestoView({ onBack }) {
  const today = new Date().toISOString().split('T')[0];

  const [tab,         setTab]         = useState('nuevo');
  const [savedId,     setSavedId]     = useState(null);   // ID en DB si ya fue guardado
  const [saving,      setSaving]      = useState(false);
  const [list,        setList]        = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Form fields
  const [code,        setCode]        = useState(randomCode);
  const [date,        setDate]        = useState(today);
  const [validDays,   setValidDays]   = useState(7);
  const [clientName,  setClientName]  = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [origin,      setOrigin]      = useState({ address: '', lat: null, lng: null });
  const [dest,        setDest]        = useState({ address: '', lat: null, lng: null });
  const [distanceKm,  setDistanceKm]  = useState('');
  const [showKm,      setShowKm]      = useState(false);
  const [loadingDist, setLoadingDist] = useState(false);
  const [includeIVA,  setIncludeIVA]  = useState(false);
  const [discount,    setDiscount]    = useState('');
  const [notes,       setNotes]       = useState('Precios informados en pesos chilenos (CLP).\nCualquier servicio adicional no incluido será cotizado por separado.');
  const [items,       setItems]       = useState([newItem(1)]);
  const [nextId,      setNextId]      = useState(2);

  // Totales
  const subtotal       = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  const discountAmount = Math.min(Number(discount) || 0, subtotal);
  const taxable        = subtotal - discountAmount;
  const ivaAmount      = includeIVA ? Math.round(taxable * IVA_RATE / 100) : 0;
  const total          = taxable + ivaAmount;

  // Auto-calcular km cuando ambas direcciones tienen coordenadas
  useEffect(() => {
    if (!origin.lat || !dest.lat) return;
    setLoadingDist(true);
    api.calculateDistance({
      originLat: origin.lat, originLng: origin.lng,
      destLat: dest.lat,     destLng: dest.lng,
    }).then(({ distanceKm: km }) => {
      setDistanceKm(km);
      setShowKm(true);
    }).catch(() => {}).finally(() => setLoadingDist(false));
  }, [origin.lat, origin.lng, dest.lat, dest.lng]);

  // Cargar lista al abrir tab Guardados
  useEffect(() => {
    if (tab === 'guardados') loadList();
  }, [tab]);

  const loadList = async () => {
    setLoadingList(true);
    try { setList(await api.getPresupuestos()); }
    catch { toast('Error al cargar presupuestos'); }
    finally { setLoadingList(false); }
  };

  // Carga un presupuesto guardado en el form
  const loadIntoForm = (p) => {
    setSavedId(p.id);
    setCode(p.code);
    setDate(p.date || today);
    setValidDays(p.validDays || 7);
    setClientName(p.clientName || '');
    setClientPhone(p.clientPhone || '');
    setClientEmail(p.clientEmail || '');
    setOrigin({ address: p.originAddress || '', lat: null, lng: null });
    setDest({ address: p.destinationAddress || '', lat: null, lng: null });
    setDistanceKm(p.distanceKm || '');
    setShowKm(p.showKm || false);
    setIncludeIVA(p.includeIVA || false);
    setDiscount(p.discount || '');
    setNotes(p.notes || '');
    const loadedItems = (p.items || []).map((it, i) => ({ ...it, id: i + 1 }));
    setItems(loadedItems.length ? loadedItems : [newItem(1)]);
    setNextId((loadedItems.length || 1) + 1);
    setTab('nuevo');
    toast('Presupuesto cargado para editar');
  };

  const handleNew = () => {
    if (!confirm('¿Descartar y crear nuevo presupuesto?')) return;
    setSavedId(null);
    setCode(randomCode());
    setDate(today); setValidDays(7);
    setClientName(''); setClientPhone(''); setClientEmail('');
    setOrigin({ address: '', lat: null, lng: null });
    setDest({ address: '', lat: null, lng: null });
    setDistanceKm(''); setShowKm(false);
    setIncludeIVA(false); setDiscount('');
    setNotes('Precios informados en pesos chilenos (CLP).\nCualquier servicio adicional no incluido será cotizado por separado.');
    setItems([newItem(1)]); setNextId(2);
  };

  const getPayload = () => ({
    code, date, validDays: Number(validDays) || 7,
    clientName, clientPhone, clientEmail,
    originAddress: origin.address || null,
    destinationAddress: dest.address || null,
    distanceKm: distanceKm ? Number(distanceKm) : null,
    showKm, items,
    subtotal, discount: Number(discount) || 0,
    includeIVA, ivaAmount, total, notes,
  });

  const handleSave = async () => {
    if (!code.trim()) return toast('El código es obligatorio');
    setSaving(true);
    try {
      if (savedId) {
        await api.updatePresupuesto(savedId, getPayload());
        toast('✅ Presupuesto actualizado');
      } else {
        const saved = await api.createPresupuesto(getPayload());
        setSavedId(saved.id);
        toast('✅ Presupuesto guardado');
      }
    } catch (e) { toast('Error al guardar: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, cd) => {
    if (!confirm(`¿Eliminar presupuesto ${cd}?`)) return;
    try {
      await api.deletePresupuesto(id);
      setList(l => l.filter(p => p.id !== id));
      if (savedId === id) { handleNew(); setSavedId(null); }
      toast('Presupuesto eliminado');
    } catch { toast('Error al eliminar'); }
  };

  const handleGeneratePDF = () => {
    const html = buildPDFHtml({
      code, date, validDays: Number(validDays) || 7,
      clientName, clientPhone, clientEmail,
      originAddress: origin.address, destinationAddress: dest.address,
      distanceKm, showKm, items, subtotal, discountAmount, ivaAmount, total, includeIVA, notes,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url; a.download = `presupuesto-${code}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const addItem = () => { setItems(p => [...p, newItem(nextId)]); setNextId(n => n + 1); };
  const removeItem = id => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id, field, value) => setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));
  const addQuick = q => { setItems(p => [...p, { ...q, id: nextId, qty: 1 }]); setNextId(n => n + 1); };

  const inp = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#fff', color: 'var(--text)', width: '100%' };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' };
  const sec = { background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'max(12px,env(safe-area-inset-top)) 16px 0', background: '#fff', flexShrink: 0 }}>
        <button onClick={onBack} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '2px 6px' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>📄 Presupuestos</div>
          {tab === 'nuevo' && <div style={{ fontSize: 11, color: savedId ? '#059669' : 'var(--muted)', fontWeight: 600 }}>
            {savedId ? `✓ Guardado · ${code}` : code}
          </div>}
        </div>
        {tab === 'nuevo' && (
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={handleNew} style={{ border: '1px solid var(--border)', background: 'var(--card2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--muted)' }}>+ Nuevo</button>
            <button onClick={handleSave} disabled={saving} style={{ border: 'none', borderRadius: 9, padding: '7px 12px', fontSize: 12, fontWeight: 900, cursor: 'pointer', background: '#059669', color: '#fff', opacity: saving ? .6 : 1 }}>
              {saving ? '…' : '💾 Guardar'}
            </button>
            <button onClick={handleGeneratePDF} style={{ border: 'none', borderRadius: 9, padding: '7px 12px', fontSize: 12, fontWeight: 900, cursor: 'pointer', background: 'var(--accent)', color: '#fff' }}>
              📥 PDF
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '0 16px', borderBottom: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
        {[['nuevo','✏️ Crear / Editar'], ['guardados','📂 Guardados']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 14px', border: 'none', background: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            color: tab === t ? 'var(--accent)' : 'var(--muted)',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {/* ── TAB GUARDADOS ───────────────────────────────────────────────── */}
      {tab === 'guardados' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={loadList} style={{ border: '1px solid var(--border)', background: 'var(--card2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--muted)' }}>🔄 Actualizar</button>
          </div>
          {loadingList && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>}
          {!loadingList && list.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>Sin presupuestos guardados aún.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map(p => (
              <div key={p.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--accent)' }}>{p.code}</span>
                      <span style={{ fontSize: 11, background: '#f1f5f9', borderRadius: 6, padding: '2px 7px', fontWeight: 700, color: 'var(--muted)' }}>
                        {new Date(p.createdAt).toLocaleDateString('es-CL')}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, color: 'var(--text)' }}>{p.clientName || 'Sin nombre'}</div>
                    {p.clientPhone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.clientPhone}</div>}
                    {(p.originAddress || p.destinationAddress) && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        {p.originAddress} → {p.destinationAddress}
                        {p.showKm && p.distanceKm ? ` · ${p.distanceKm} km` : ''}
                      </div>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--accent)', marginTop: 6 }}>${fmt(p.total)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => loadIntoForm(p)} style={{ border: '1px solid #0052FF30', background: '#0052FF10', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', color: 'var(--accent)' }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => {
                      // Open PDF from saved data
                      const disc = Math.min(Number(p.discount) || 0, Number(p.subtotal) || 0);
                      const html = buildPDFHtml({
                        code: p.code, date: p.date, validDays: p.validDays,
                        clientName: p.clientName, clientPhone: p.clientPhone, clientEmail: p.clientEmail,
                        originAddress: p.originAddress, destinationAddress: p.destinationAddress,
                        distanceKm: p.distanceKm, showKm: p.showKm,
                        items: p.items, subtotal: p.subtotal, discountAmount: disc,
                        ivaAmount: p.ivaAmount, total: p.total, includeIVA: p.includeIVA, notes: p.notes,
                      });
                      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                      setTimeout(() => URL.revokeObjectURL(url), 60000);
                    }} style={{ border: '1px solid var(--border)', background: 'var(--card2)', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', color: 'var(--muted)' }}>
                      📥 PDF
                    </button>
                    <button onClick={() => handleDelete(p.id, p.code)} style={{ border: 'none', background: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', color: '#ef4444' }}>
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB NUEVO / EDITAR ──────────────────────────────────────────── */}
      {tab === 'nuevo' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Datos del presupuesto */}
          <div style={sec}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>Datos del presupuesto</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>Código</label>
                <input style={inp} value={code} onChange={e => setCode(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Fecha</label>
                <input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={lbl}>Validez (días)</label>
              <input style={{ ...inp, width: 110 }} type="number" min="1" max="90" value={validDays} onChange={e => setValidDays(e.target.value)} />
            </div>
          </div>

          {/* Cliente */}
          <div style={sec}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>Cliente</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={lbl}>Nombre / Empresa</label>
                <input style={inp} placeholder="Nombre del cliente" value={clientName} onChange={e => setClientName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Teléfono</label>
                  <input style={inp} placeholder="+56 9..." value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Email</label>
                  <input style={inp} placeholder="correo@..." value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Direcciones + km */}
          <div style={sec}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>Dirección del servicio</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={lbl}>Dirección de origen</label>
                <AddressAutocomplete
                  value={origin.address}
                  onChange={v => setOrigin({ address: v, lat: null, lng: null })}
                  onSelect={({ address, lat, lng }) => setOrigin({ address, lat, lng })}
                  placeholder="Calle, número, ciudad..."
                />
              </div>
              <div>
                <label style={lbl}>Dirección de destino</label>
                <AddressAutocomplete
                  value={dest.address}
                  onChange={v => setDest({ address: v, lat: null, lng: null })}
                  onSelect={({ address, lat, lng }) => setDest({ address, lat, lng })}
                  placeholder="Calle, número, ciudad..."
                />
              </div>

              {/* km */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <label style={lbl}>Distancia (km)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      style={{ ...inp, width: 110 }}
                      type="number" min="0" step="0.1" placeholder="0"
                      value={distanceKm}
                      onChange={e => setDistanceKm(e.target.value)}
                    />
                    {loadingDist && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Calculando…</span>}
                    {!loadingDist && origin.lat && dest.lat && distanceKm && (
                      <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓ Auto</span>
                    )}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', marginTop: 16 }}>
                  <input type="checkbox" checked={showKm} onChange={e => setShowKm(e.target.checked)} style={{ width: 15, height: 15 }} />
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Mostrar km en el PDF</span>
                </label>
              </div>
            </div>
          </div>

          {/* Ítems rápidos */}
          <div style={sec}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Agregar ítem rápido</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {QUICK_ITEMS.map(q => (
                <button key={q.label} onClick={() => addQuick(q)} style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', background: 'var(--card2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text)' }}>
                  {q.icon} {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div style={sec}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>Ítems del presupuesto</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((item, idx) => (
                <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: '#fafbfc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Ítem {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(item.id)} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#ef4444', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
                    )}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={lbl}>Descripción</label>
                    <input style={inp} placeholder="Ej: Camión 3/4 — traslado completo" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={lbl}>Cant.</label>
                      <input style={inp} type="number" min="0.5" step="0.5" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} />
                    </div>
                    <div>
                      <label style={lbl}>Unidad</label>
                      <select style={inp} value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)}>
                        {UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Precio unit. ($)</label>
                      <input style={inp} type="number" min="0" step="1000" placeholder="0" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', e.target.value)} />
                    </div>
                  </div>
                  {Number(item.qty) > 0 && Number(item.unitPrice) > 0 && (
                    <div style={{ marginTop: 8, textAlign: 'right', fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>
                      ${fmt((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addItem} style={{ marginTop: 10, width: '100%', border: '1.5px dashed var(--border)', background: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>
              + Agregar ítem
            </button>
          </div>

          {/* Totales */}
          <div style={sec}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>Totales</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
              <div>
                <label style={lbl}>Descuento ($)</label>
                <input style={{ ...inp, width: 160 }} type="number" min="0" step="1000" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 20 }}>
                <input type="checkbox" checked={includeIVA} onChange={e => setIncludeIVA(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>IVA 19%</span>
              </label>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Subtotal',            value: `$${fmt(subtotal)}`,       show: true },
                { label: 'Descuento',           value: `−$${fmt(discountAmount)}`, show: discountAmount > 0, color: '#059669' },
                { label: `IVA (${IVA_RATE}%)`, value: `$${fmt(ivaAmount)}`,       show: includeIVA },
              ].filter(r => r.show).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: r.color || 'var(--text)' }}>
                  <span style={{ fontWeight: 600 }}>{r.label}</span><span style={{ fontWeight: 800 }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 19, fontWeight: 900, color: 'var(--accent)', marginTop: 6, paddingTop: 10, borderTop: '2px solid var(--accent)' }}>
                <span>TOTAL</span><span>${fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div style={sec}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Notas y condiciones</div>
            <textarea style={{ ...inp, height: 90, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Botones finales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{ border: 'none', borderRadius: 14, padding: '15px', fontSize: 14, fontWeight: 900, cursor: 'pointer', background: '#059669', color: '#fff', opacity: saving ? .6 : 1 }}>
              💾 {savedId ? 'Actualizar' : 'Guardar'}
            </button>
            <button onClick={handleGeneratePDF} style={{ border: 'none', borderRadius: 14, padding: '15px', fontSize: 14, fontWeight: 900, cursor: 'pointer', background: 'linear-gradient(135deg,#0052FF,#00DAFF)', color: '#fff' }}>
              📥 Generar PDF
            </button>
          </div>
          <div style={{ height: 16 }} />
        </div>
      )}
    </div>
  );
}
