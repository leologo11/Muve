import React, { useState } from 'react';

const IVA_RATE = 19;
const fmt = n => Math.round(Number(n) || 0).toLocaleString('es-CL');

const UNITS = ['unidad', 'servicio', 'viaje', 'hora', 'día', 'persona', 'm³', 'km', 'caja', 'piso'];

const QUICK_ITEMS = [
  { icon: '🚐', label: 'Furgón',           description: 'Traslado en furgón',            unit: 'viaje',    unitPrice: 35000 },
  { icon: '🚚', label: 'Camión 3/4',       description: 'Traslado en camión 3/4',         unit: 'viaje',    unitPrice: 80000 },
  { icon: '🚛', label: 'Camión grande',    description: 'Traslado en camión largo',        unit: 'viaje',    unitPrice: 150000 },
  { icon: '📦', label: 'Embalaje',         description: 'Embalaje profesional de artículos', unit: 'servicio', unitPrice: 45000 },
  { icon: '👷', label: 'Ayudante',         description: 'Ayudante de carga/descarga',      unit: 'persona',  unitPrice: 25000 },
  { icon: '🔧', label: 'Armado/Desarmado', description: 'Armado y desarmado de muebles',   unit: 'servicio', unitPrice: 30000 },
  { icon: '🏗️', label: 'Piso sin ascensor', description: 'Cargo por piso sin ascensor',   unit: 'piso',     unitPrice: 6000  },
  { icon: '🚨', label: 'Servicio urgente', description: 'Cargo adicional por urgencia',    unit: 'servicio', unitPrice: 20000 },
];

function getNextNumber() {
  const year = new Date().getFullYear();
  // Número aleatorio entre 1000-9999 para no revelar secuencia
  const rand = Math.floor(Math.random() * 8000) + 1000;
  return `P-${year}-${rand}`;
}

function buildPDFHtml({ number, date, validDays, clientName, clientPhone, clientEmail, items, subtotal, discountAmount, ivaAmount, total, includeIVA, notes }) {
  const dateStr = new Date(date + 'T12:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  const validDate = new Date(date + 'T12:00');
  validDate.setDate(validDate.getDate() + validDays);
  const validStr = validDate.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

  const rowsHtml = items.filter(i => i.description || i.unitPrice > 0).map(item => {
    const rowTotal = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
    return `
      <tr>
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
<title>Presupuesto ${number} · MUVE</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;background:#fff;padding:40px;font-size:13.5px;line-height:1.5}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:22px;border-bottom:3px solid #0052FF;margin-bottom:28px}
.logo{font-size:32px;font-weight:900;color:#0052FF;letter-spacing:-1.5px}.logo span{color:#00DAFF}
.logo-sub{font-size:11px;color:#64748b;margin-top:2px;font-weight:500}
.doc-info{text-align:right}
.doc-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.8px}
.doc-number{font-size:26px;font-weight:900;color:#0052FF;margin:2px 0}
.doc-date{font-size:12px;color:#64748b}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px}
.card-label{font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
.card-name{font-size:15px;font-weight:800;color:#1e293b;margin-bottom:4px}
.card-detail{font-size:12px;color:#64748b;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
thead tr{background:#0052FF}
thead th{padding:10px 14px;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:left}
.center{text-align:center!important}.right{text-align:right!important}.bold{font-weight:700}
tbody tr:nth-child(even){background:#f8fafc}
tbody td{padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px}
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:24px}
.totals{width:280px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
.totals-row{display:flex;justify-content:space-between;padding:9px 16px;border-bottom:1px solid #e2e8f0;font-size:13px}
.totals-row:last-child{border-bottom:none;background:#0052FF;color:#fff;font-size:16px;font-weight:900;border-radius:0 0 9px 9px;padding:12px 16px}
.totals-row.discount{color:#059669}
.notes-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;margin-bottom:28px}
.notes-label{font-size:10px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
.notes-text{font-size:12.5px;color:#1e293b;line-height:1.65;white-space:pre-wrap}
.footer{display:flex;justify-content:space-between;align-items:flex-end;padding-top:20px;border-top:1px solid #e2e8f0}
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
    <div class="doc-number">${number}</div>
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
    <div>Este presupuesto es válido hasta el</div>
    <div><strong>${validStr}</strong></div>
    <div class="badge">⏳ Válido por ${validDays} días</div>
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

  const [number,      setNumber]      = useState(() => getNextNumber());
  const [date,        setDate]        = useState(today);
  const [validDays,   setValidDays]   = useState(7);
  const [clientName,  setClientName]  = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [includeIVA,  setIncludeIVA]  = useState(false);
  const [discount,    setDiscount]    = useState('');
  const [notes,       setNotes]       = useState('Precios informados en pesos chilenos (CLP).\nCualquier servicio adicional no incluido será cotizado por separado.');
  const [items,       setItems]       = useState([
    { id: 1, description: '', qty: 1, unit: 'unidad', unitPrice: '' },
  ]);
  const [nextId, setNextId] = useState(2);

  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  const discountAmount = Math.min(Number(discount) || 0, subtotal);
  const taxable    = subtotal - discountAmount;
  const ivaAmount  = includeIVA ? Math.round(taxable * IVA_RATE / 100) : 0;
  const total      = taxable + ivaAmount;

  const addItem = () => {
    setItems(p => [...p, { id: nextId, description: '', qty: 1, unit: 'unidad', unitPrice: '' }]);
    setNextId(n => n + 1);
  };
  const removeItem = id => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id, field, value) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

  const addQuickItem = (preset) => {
    setItems(p => [...p, { id: nextId, ...preset, qty: 1 }]);
    setNextId(n => n + 1);
  };

  const handleGenerate = () => {
    const html = buildPDFHtml({
      number, date, validDays: Number(validDays) || 7,
      clientName, clientPhone, clientEmail,
      items, subtotal, discountAmount, ivaAmount, total, includeIVA, notes,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) {
      // Fallback si bloqueó popup: descargar como HTML
      const a = document.createElement('a');
      a.href = url; a.download = `presupuesto-${number}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleReset = () => {
    if (!confirm('¿Crear nuevo presupuesto? Se perderán los datos actuales.')) return;
    setNumber(getNextNumber());
    setDate(today);
    setClientName(''); setClientPhone(''); setClientEmail('');
    setIncludeIVA(false); setDiscount('');
    setItems([{ id: 1, description: '', qty: 1, unit: 'unidad', unitPrice: '' }]);
    setNextId(2);
  };

  const inp = {
    border: '1px solid var(--border)', borderRadius: 8,
    padding: '8px 10px', fontSize: 13, background: '#fff',
    color: 'var(--text)', width: '100%',
  };
  const label = { fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' };
  const section = { background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'max(12px,env(safe-area-inset-top)) 16px 12px', borderBottom: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
        <button onClick={onBack} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '2px 6px' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>📄 Generar Presupuesto</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{number}</div>
        </div>
        <button onClick={handleReset} style={{ border: '1px solid var(--border)', background: 'var(--card2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--muted)' }}>
          + Nuevo
        </button>
        <button onClick={handleGenerate} style={{ border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 900, cursor: 'pointer', background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 14px #0052ff30' }}>
          📥 PDF
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Datos del presupuesto */}
        <div style={section}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>Datos del presupuesto</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={label}>Número</label>
              <input style={inp} value={number} onChange={e => setNumber(e.target.value)} />
            </div>
            <div>
              <label style={label}>Fecha</label>
              <input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={label}>Válido por (días)</label>
            <input style={{ ...inp, width: 120 }} type="number" min="1" max="90" value={validDays} onChange={e => setValidDays(e.target.value)} />
          </div>
        </div>

        {/* Cliente */}
        <div style={section}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>Cliente</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={label}>Nombre / Empresa</label>
              <input style={inp} placeholder="Nombre del cliente" value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={label}>Teléfono</label>
                <input style={inp} placeholder="+56 9..." value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
              </div>
              <div>
                <label style={label}>Email</label>
                <input style={inp} placeholder="correo@..." value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Ítems rápidos */}
        <div style={section}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Agregar ítem rápido</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {QUICK_ITEMS.map(q => (
              <button key={q.label} onClick={() => addQuickItem(q)} style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', background: 'var(--card2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text)' }}>
                {q.icon} {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div style={section}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>Ítems del presupuesto</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, idx) => (
              <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: '#fafbfc', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Ítem {idx + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#ef4444', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
                  )}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={label}>Descripción</label>
                  <input style={inp} placeholder="Ej: Camión 3/4 — traslado completo" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={label}>Cant.</label>
                    <input style={inp} type="number" min="0.5" step="0.5" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} />
                  </div>
                  <div>
                    <label style={label}>Unidad</label>
                    <select style={inp} value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Precio unit. ($)</label>
                    <input style={inp} type="number" min="0" step="1000" placeholder="0" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', e.target.value)} />
                  </div>
                </div>
                {/* Row total preview */}
                {(Number(item.qty) > 0 && Number(item.unitPrice) > 0) && (
                  <div style={{ marginTop: 8, textAlign: 'right', fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>
                    Subtotal ítem: ${fmt((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button onClick={addItem} style={{ marginTop: 10, width: '100%', border: '1.5px dashed var(--border)', background: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}>
            + Agregar ítem
          </button>
        </div>

        {/* Totales y opciones */}
        <div style={section}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>Totales</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={label}>Descuento ($)</label>
              <input style={{ ...inp, width: 180 }} type="number" min="0" step="1000" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={includeIVA} onChange={e => setIncludeIVA(e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Agregar IVA (19%)</span>
            </label>
          </div>

          {/* Resumen */}
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Subtotal',             value: `$${fmt(subtotal)}`,       show: true },
              { label: 'Descuento',            value: `−$${fmt(discountAmount)}`, show: discountAmount > 0, color: '#059669' },
              { label: `IVA (${IVA_RATE}%)`,  value: `$${fmt(ivaAmount)}`,       show: includeIVA },
            ].filter(r => r.show).map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: r.color || 'var(--text)' }}>
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontWeight: 800 }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 900, color: 'var(--accent)', marginTop: 6, paddingTop: 10, borderTop: '2px solid var(--accent)' }}>
              <span>TOTAL</span>
              <span>${fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div style={section}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Notas y condiciones</div>
          <textarea
            style={{ ...inp, height: 90, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            placeholder="Condiciones del servicio, incluye/excluye, términos de pago..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Generar PDF */}
        <button onClick={handleGenerate} style={{ border: 'none', borderRadius: 14, padding: '16px', fontSize: 15, fontWeight: 900, cursor: 'pointer', background: 'linear-gradient(135deg,#0052FF,#00DAFF)', color: '#fff', boxShadow: '0 8px 24px #0052ff30', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          📥 Generar y descargar PDF
        </button>

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
