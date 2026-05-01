import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../../api/index.js';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';

// ── Price color tiers (same as SectorMap) ────────────────────────────────────
const TIERS = [
  { max: 2000,     color: '#2a9940', label: '≤ $2.000' },
  { max: 3500,     color: '#66bb6a', label: '≤ $3.500' },
  { max: 5000,     color: '#f57c00', label: '≤ $5.000' },
  { max: 7000,     color: '#e53935', label: '≤ $7.000' },
  { max: Infinity, color: '#7b1fa2', label: '> $7.000' },
];
function tierColor(price) {
  return TIERS.find(t => (price ?? 0) <= t.max)?.color ?? '#7b1fa2';
}

function normalize(str) {
  return (str || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function suggestPriceFromZone(zones, commune) {
  if (!zones?.length || !commune) return 0;
  const zone = zones.find(z => normalize(z.name) === normalize(commune));
  return zone?.price || 0;
}

function pinIcon(n) {
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#008855;border:2px solid #fff;box-shadow:0 2px 6px #0005;display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-size:9px;font-weight:800">${n}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26]
  });
}

// ── Zone map component ────────────────────────────────────────────────────────
function QuoteMap({ zones, items, visible }) {
  const mapRef  = useRef(null);
  const mapInst = useRef(null);
  const zonesGrp = useRef(null);
  const pinsGrp  = useRef(null);

  useEffect(() => {
    if (mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([-33.45, -70.65], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(map);
    zonesGrp.current = L.layerGroup().addTo(map);
    pinsGrp.current  = L.layerGroup().addTo(map);
    mapInst.current  = map;
    setTimeout(() => map.invalidateSize(), 120);
  }, []);

  // Invalidate size when tab becomes visible so tiles render correctly
  useEffect(() => {
    if (visible && mapInst.current) {
      setTimeout(() => mapInst.current.invalidateSize(), 50);
    }
  }, [visible]);

  // Draw zone polygons
  useEffect(() => {
    const map = mapInst.current;
    const grp = zonesGrp.current;
    if (!map || !grp) return;
    grp.clearLayers();
    zones.forEach(z => {
      if (!z.polygon?.coordinates?.[0]) return;
      const latlngs = z.polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
      const color = z.color || tierColor(z.price || 0);
      L.polygon(latlngs, {
        color, fillColor: color, fillOpacity: 0.22, weight: 1.5, opacity: 0.6
      })
        .bindTooltip(`${z.name}  $${(z.price || 0).toLocaleString('es-CL')}`, { sticky: true })
        .addTo(grp);
    });
  }, [zones]);

  // Draw package pins
  useEffect(() => {
    const map = mapInst.current;
    const grp = pinsGrp.current;
    if (!map || !grp) return;
    grp.clearLayers();
    const valid = items.filter(i => i.lat && i.lng);
    valid.forEach((item, n) => {
      L.marker([item.lat, item.lng], { icon: pinIcon(n + 1) })
        .bindPopup(`<b>${item.customerName || ''} ${item.customerLastName || ''}</b><br>${item.address}<br>${item.commune || ''}`)
        .addTo(grp);
    });
    if (valid.length) {
      const bounds = L.latLngBounds(valid.map(i => [i.lat, i.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [items]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(/[,;]/).map(h => normalize(h.replace(/"/g, '').trim()));
  const idx = key => {
    const aliases = {
      customerName:     ['nombre', 'name', 'firstname', 'primer nombre'],
      customerLastName: ['apellido', 'lastname', 'surname', 'segundo nombre'],
      address:          ['direccion', 'dirección', 'address', 'calle'],
      commune:          ['comuna', 'commune', 'city', 'ciudad'],
      customerPhone:    ['telefono', 'teléfono', 'phone', 'celular'],
      note:             ['nota', 'note', 'observacion', 'observación', 'comentario'],
      price:            ['precio', 'price', 'costo', 'valor'],
    };
    for (const [field, names] of Object.entries(aliases)) {
      if (names.some(n => key === n || header.indexOf(n) >= 0)) return { field, col: header.findIndex(h => names.includes(h)) };
    }
    return null;
  };
  const fields = ['customerName', 'customerLastName', 'address', 'commune', 'customerPhone', 'note', 'price'];
  const colMap = {};
  fields.forEach(f => {
    const res = idx(f);
    if (res && res.col >= 0) colMap[f] = res.col;
  });
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cells = line.split(/[,;]/).map(c => c.replace(/"/g, '').trim());
    const row = {};
    fields.forEach(f => { if (colMap[f] != null) row[f] = cells[colMap[f]] || ''; });
    return row;
  }).filter(r => r.address);
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_META = {
  draft:     { label: 'Borrador',        color: '#888' },
  sent:      { label: 'Pendiente',       color: '#f57c00' },
  submitted: { label: 'Enviada al admin', color: '#0077aa' },
  approved:  { label: '✓ Aprobada',      color: '#008855' },
  rejected:  { label: '✗ Rechazada',     color: '#cc2244' },
};

// ── Main QuoteView ─────────────────────────────────────────────────────────────
export default function QuoteView() {
  const { shareToken } = useParams();
  const [data, setData]       = useState(null);
  const [items, setItems]     = useState([]);
  const [tab, setTab]         = useState('map');
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);
  const [saving, setSaving]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [clientNotes, setClientNotes] = useState('');
  const [addForm, setAddForm] = useState({ customerName: '', customerLastName: '', customerPhone: '', address: '', commune: '', note: '', price: '', lat: '', lng: '' });

  useEffect(() => {
    api.getPublicQuote(shareToken)
      .then(res => {
        setData(res);
        setItems(res.quote.items || []);
        setSubmitted(['submitted', 'approved', 'rejected'].includes(res.quote.status));
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [shareToken]);

  const isDone = data && ['approved', 'rejected'].includes(data.quote.status);
  const isEditable = !submitted && !isDone;

  const autoPrice = (commune) => suggestPriceFromZone(data?.zones || [], commune);

  const setAdd = (k, v) => setAddForm(f => ({ ...f, [k]: v }));

  const handleCommuneChange = (commune) => {
    const suggested = autoPrice(commune);
    setAddForm(f => ({ ...f, commune, price: suggested > 0 ? suggested : f.price }));
  };

  const addItem = () => {
    if (!addForm.address) return;
    const price = Number(addForm.price) || autoPrice(addForm.commune) || 0;
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

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const handleCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCsv(ev.target.result);
      const withPrices = parsed.map(r => ({ ...r, price: autoPrice(r.commune) }));
      setItems(prev => [...prev, ...withPrices]);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.savePublicQuote(shareToken, { items, clientNotes });
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [shareToken, items, clientNotes]);

  const handleSubmit = async () => {
    if (items.length === 0) return alert('Agrega al menos un paquete antes de enviar.');
    if (!confirm('¿Enviar la cotización al administrador para su revisión?')) return;
    setSaving(true);
    try {
      await api.submitPublicQuote(shareToken, { items, clientNotes });
      setSubmitted(true);
      setData(d => ({ ...d, quote: { ...d.quote, status: 'submitted' } }));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) return <div style={centeredMsg}>Cargando cotización…</div>;
  if (err) return <div style={{ ...centeredMsg, color: '#cc2244' }}>❌ {err}</div>;

  const { quote, zones = [] } = data;
  const status = STATUS_META[quote.status] || STATUS_META.sent;
  const total = items.reduce((s, i) => s + (Number(i.price) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', fontFamily: 'system-ui, sans-serif', background: 'var(--bg, #f5f6f8)' }}>

      {/* ── PRINT TEMPLATE (hidden on screen) ── */}
      <PrintableQuote quote={quote} items={items} zones={zones} total={total} />

      {/* ── HEADER ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: 1.5 }}>COTIZACIÓN</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{quote.quoteCode}</div>
            {quote.clientCompany && <div style={{ fontSize: 13, color: '#555', marginTop: 1 }}>🏢 {quote.clientCompany}{quote.contactPerson ? ` · ${quote.contactPerson}` : ''}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${status.color}18`, color: status.color, border: `1px solid ${status.color}30` }}>
              {status.label}
            </span>
            <button onClick={handlePrint} style={smBtn('#0077aa')} title="Descargar PDF">🖨 PDF</button>
          </div>
        </div>
        {quote.adminNotes && (
          <div style={{ marginTop: 8, padding: '7px 10px', background: '#fff8e1', borderRadius: 8, fontSize: 12, color: '#7a5500', border: '1px solid #f0d080' }}>
            📝 {quote.adminNotes}
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
        {[['map', '🗺 Mapa'], ['pkgs', '📦 Paquetes'], ['summary', '📋 Resumen']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700,
            letterSpacing: 0.5, border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t ? '#008855' : '#888',
            borderBottom: `2px solid ${tab === t ? '#008855' : 'transparent'}`
          }}>{label}</button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* MAP TAB — always mounted so pins appear in real-time */}
        <div style={{ display: tab === 'map' ? 'flex' : 'none', height: '100%', flexDirection: 'column', position: 'absolute', inset: 0 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <QuoteMap zones={zones} items={items} visible={tab === 'map'} />
            {/* Legend overlay */}
            <div style={{ position: 'absolute', bottom: 16, left: 10, zIndex: 900, background: 'rgba(255,255,255,.95)', borderRadius: 10, padding: '10px 12px', boxShadow: '0 2px 12px #0002', maxWidth: 200, maxHeight: '45%', overflowY: 'auto' }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#888', marginBottom: 7 }}>PRECIOS POR ZONA</div>
              {zones.filter(z => z.price > 0).slice(0, 12).map(z => (
                <LegendRow key={z._id} name={z.name} price={z.price} color={z.color} />
              ))}
              {zones.filter(z => z.price > 0).length === 0 && (
                <div style={{ fontSize: 11, color: '#888' }}>Sin zonas configuradas</div>
              )}
            </div>
          </div>
        </div>

        {/* PACKAGES TAB */}
        {tab === 'pkgs' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '10px 10px calc(100px + env(safe-area-inset-bottom))' }}>

            {/* Status message when done */}
            {isDone && (
              <div style={{ padding: '14px 16px', borderRadius: 12, background: quote.status === 'approved' ? '#e8f5e9' : '#fce4ec', border: `1px solid ${quote.status === 'approved' ? '#00885530' : '#cc224430'}`, marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{quote.status === 'approved' ? '✅' : '❌'}</div>
                <div style={{ fontWeight: 700, color: quote.status === 'approved' ? '#008855' : '#cc2244' }}>
                  {quote.status === 'approved' ? 'Cotización aprobada — se está coordinando su entrega.' : 'Cotización rechazada. Contáctanos para más información.'}
                </div>
              </div>
            )}

            {submitted && !isDone && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: '#e3f2fd', border: '1px solid #0077aa30', marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#0077aa' }}>✓ Cotización enviada — el administrador la revisará pronto.</div>
              </div>
            )}

            {/* Package list */}
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: '#aaa' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
                <p style={{ fontSize: 14 }}>Aún no hay paquetes. {isEditable ? 'Agrega uno abajo.' : ''}</p>
              </div>
            ) : items.map((item, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '11px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{i + 1}. {item.customerName || ''} {item.customerLastName || ''}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{item.address}{item.commune ? `, ${item.commune}` : ''}</div>
                  {item.customerPhone && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>📞 {item.customerPhone}</div>}
                  {item.note && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>📝 {item.note}</div>}
                  {item.price > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: '#008855', marginTop: 4 }}>${Number(item.price).toLocaleString('es-CL')}</div>}
                </div>
                {isEditable && (
                  <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#cc2244', cursor: 'pointer', fontSize: 16, padding: '0 0 0 8px', flexShrink: 0 }}>✕</button>
                )}
              </div>
            ))}

            {items.length > 0 && (
              <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{items.length} paquete{items.length !== 1 ? 's' : ''}</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#008855' }}>${total.toLocaleString('es-CL')}</span>
              </div>
            )}

            {/* Add form */}
            {isEditable && (
              <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, padding: '14px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#888', marginBottom: 10 }}>+ AGREGAR PAQUETE</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <QF label="Nombre" value={addForm.customerName} onChange={v => setAdd('customerName', v)} />
                  <QF label="Apellido" value={addForm.customerLastName} onChange={v => setAdd('customerLastName', v)} />
                  <div style={{ gridColumn: '1/-1' }}>
                    <QLabel>Teléfono</QLabel>
                    <input type="tel" value={addForm.customerPhone} onChange={e => setAdd('customerPhone', e.target.value)} placeholder="+56 9 xxxx xxxx" style={qinp} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <QLabel>Dirección *</QLabel>
                    <AddressAutocomplete
                      value={addForm.address}
                      onChange={v => setAdd('address', v)}
                      onSelect={({ address, commune, lat, lng }) => {
                        const suggested = autoPrice(commune || addForm.commune);
                        setAddForm(f => ({
                          ...f, address,
                          commune: commune || f.commune,
                          lat: lat || '', lng: lng || '',
                          price: suggested > 0 ? suggested : f.price
                        }));
                      }}
                      placeholder="Av. Providencia 1100…"
                      dropdownFixed
                    />
                  </div>
                  <div>
                    <QLabel>Comuna</QLabel>
                    <input
                      value={addForm.commune}
                      onChange={e => handleCommuneChange(e.target.value)}
                      placeholder="Providencia"
                      style={qinp}
                    />
                  </div>
                  <div>
                    <QLabel>Precio CLP {addForm.price > 0 ? '(sugerido)' : ''}</QLabel>
                    <input
                      type="number"
                      value={addForm.price}
                      onChange={e => setAdd('price', e.target.value)}
                      placeholder={autoPrice(addForm.commune) > 0 ? autoPrice(addForm.commune).toString() : '0'}
                      style={{ ...qinp, fontWeight: 700, color: addForm.price > 0 ? '#008855' : '#888' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <QF label="Nota (opcional)" value={addForm.note} onChange={v => setAdd('note', v)} placeholder="Depto, piso, instrucciones…" />
                  </div>
                </div>
                <button onClick={addItem} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', marginTop: 12, background: '#008855', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Agregar paquete
                </button>

                {/* CSV import */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px dashed #ccc', cursor: 'pointer', textAlign: 'center', fontSize: 12, color: '#888', background: '#fafafa' }}>
                    📂 Importar CSV / Excel
                    <input type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={handleCsv} />
                  </label>
                </div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 5, textAlign: 'center' }}>
                  Columnas CSV: Nombre, Apellido, Dirección, Comuna, Teléfono, Nota
                </div>
              </div>
            )}

            {/* Client notes */}
            {isEditable && (
              <div style={{ marginBottom: 12 }}>
                <QLabel>Notas o comentarios para el administrador</QLabel>
                <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} placeholder="Observaciones sobre la entrega, fechas preferidas, etc." rows={3}
                  style={{ ...qinp, resize: 'vertical' }} />
              </div>
            )}

            {/* Action buttons */}
            {isEditable && (
              <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                <button onClick={handleSubmit} disabled={saving || items.length === 0} style={{ padding: '13px', borderRadius: 12, border: 'none', background: items.length === 0 ? '#ccc' : '#008855', color: '#fff', fontSize: 14, fontWeight: 800, cursor: items.length === 0 ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Enviando…' : '✅ Enviar cotización'}
                </button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '11px', borderRadius: 12, border: '1px solid #e0e0e0', background: '#fff', color: '#555', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  💾 Guardar borrador
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUMMARY TAB */}
        {tab === 'summary' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '14px 12px calc(80px + env(safe-area-inset-bottom))' }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e0e0e0', padding: 16, marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Resumen de cotización</div>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 2 }}>Código: {quote.quoteCode}</div>
              {quote.clientCompany && <div style={{ fontSize: 13, color: '#555', marginBottom: 2 }}>Empresa: {quote.clientCompany}</div>}
              {quote.contactPerson && <div style={{ fontSize: 13, color: '#555', marginBottom: 2 }}>Contacto: {quote.contactPerson}</div>}
              {quote.deliveryDate && <div style={{ fontSize: 13, color: '#555', marginBottom: 2 }}>Fecha: {new Date(quote.deliveryDate).toLocaleDateString('es-CL')}</div>}
            </div>

            {/* Price legend table */}
            {zones.filter(z => z.price > 0).length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e0e0e0', padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#888', marginBottom: 10 }}>PRECIOS POR ZONA</div>
                {zones.filter(z => z.price > 0).map((z, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: z.color || tierColor(z.price), flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{z.name}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#008855' }}>${(z.price || 0).toLocaleString('es-CL')}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Package summary table */}
            {items.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e0e0e0', padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#888', marginBottom: 10 }}>PAQUETES ({items.length})</div>
                {items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{i + 1}. {item.customerName} {item.customerLastName}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{item.address}{item.commune ? `, ${item.commune}` : ''}</div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#008855', flexShrink: 0, marginLeft: 8 }}>${(Number(item.price) || 0).toLocaleString('es-CL')}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontWeight: 800, fontSize: 15 }}>
                  <span>TOTAL</span>
                  <span style={{ color: '#008855' }}>${total.toLocaleString('es-CL')}</span>
                </div>
              </div>
            )}

            <button onClick={handlePrint} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#0077aa', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              🖨 Descargar PDF
            </button>
          </div>
        )}
      </div>

      {/* Bottom counter bar */}
      {tab !== 'summary' && items.length > 0 && (
        <div style={{ background: '#008855', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{items.length} paquete{items.length !== 1 ? 's' : ''}</span>
          <span style={{ fontWeight: 800, fontSize: 15 }}>${total.toLocaleString('es-CL')}</span>
        </div>
      )}
    </div>
  );
}

// ── Legend row component ───────────────────────────────────────────────────────
function LegendRow({ name, price, color, zones = [] }) {
  const matchZone = zones.find(z => normalize(z.name) === normalize(name));
  const c = color || matchZone?.color || tierColor(price);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
      <div style={{ width: 11, height: 11, borderRadius: 3, background: c, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{name}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#008855', flexShrink: 0 }}>${(price || 0).toLocaleString('es-CL')}</div>
    </div>
  );
}

// ── Printable quote (hidden on screen, visible on print) ──────────────────────
function PrintableQuote({ quote, items, zones, total }) {
  const priceRows = zones.filter(z => z.price > 0).map(z => ({ commune: z.name, price: z.price, color: z.color }));

  return (
    <div className="print-only" style={{ display: 'none' }}>
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-only { display: block !important; padding: 24px; font-family: Arial, sans-serif; color: #111; }
          .print-only * { box-sizing: border-box; }
          @page { margin: 1.5cm; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, borderBottom: '3px solid #008855', paddingBottom: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#008855' }}>🚚 ROUTIFLOW</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Servicio de entregas a domicilio</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>COTIZACIÓN</div>
          <div style={{ fontSize: 14, color: '#666' }}>{quote.quoteCode}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{new Date().toLocaleDateString('es-CL')}</div>
        </div>
      </div>

      {/* Client info */}
      {(quote.clientCompany || quote.contactPerson) && (
        <div style={{ marginBottom: 20, padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: 2, marginBottom: 6 }}>DIRIGIDO A</div>
          {quote.clientCompany && <div style={{ fontWeight: 700, fontSize: 15 }}>{quote.clientCompany}</div>}
          {quote.contactPerson && <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{quote.contactPerson}</div>}
          {quote.contactEmail && <div style={{ fontSize: 12, color: '#555' }}>{quote.contactEmail}</div>}
          {quote.deliveryDate && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Fecha de entrega estimada: {new Date(quote.deliveryDate).toLocaleDateString('es-CL')}</div>}
        </div>
      )}

      {/* Price table */}
      {priceRows.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#888', marginBottom: 8 }}>PRECIOS POR ZONA</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '7px 10px', textAlign: 'left', border: '1px solid #e0e0e0', fontWeight: 700 }}>Comuna / Zona</th>
                <th style={{ padding: '7px 10px', textAlign: 'right', border: '1px solid #e0e0e0', fontWeight: 700 }}>Precio</th>
              </tr>
            </thead>
            <tbody>
              {priceRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 10px', border: '1px solid #e8e8e8' }}>{r.commune || r.name}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e8e8e8', fontWeight: 600, color: '#008855' }}>${(r.price || 0).toLocaleString('es-CL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Packages table */}
      {items.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#888', marginBottom: 8 }}>DETALLE DE PAQUETES ({items.length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '7px 10px', textAlign: 'left', border: '1px solid #e0e0e0' }}>#</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', border: '1px solid #e0e0e0' }}>Nombre</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', border: '1px solid #e0e0e0' }}>Dirección</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', border: '1px solid #e0e0e0' }}>Comuna</th>
                <th style={{ padding: '7px 10px', textAlign: 'left', border: '1px solid #e0e0e0' }}>Teléfono</th>
                <th style={{ padding: '7px 10px', textAlign: 'right', border: '1px solid #e0e0e0' }}>Precio</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '6px 10px', border: '1px solid #e8e8e8', color: '#888' }}>{i + 1}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #e8e8e8', fontWeight: 600 }}>{item.customerName} {item.customerLastName}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #e8e8e8' }}>{item.address}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #e8e8e8' }}>{item.commune}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #e8e8e8' }}>{item.customerPhone}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #e8e8e8', textAlign: 'right', fontWeight: 700, color: '#008855' }}>${(Number(item.price) || 0).toLocaleString('es-CL')}</td>
                </tr>
              ))}
              <tr style={{ background: '#e8f5e9' }}>
                <td colSpan={5} style={{ padding: '8px 10px', border: '1px solid #e0e0e0', fontWeight: 800, textAlign: 'right' }}>TOTAL</td>
                <td style={{ padding: '8px 10px', border: '1px solid #e0e0e0', fontWeight: 800, textAlign: 'right', color: '#008855', fontSize: 14 }}>${total.toLocaleString('es-CL')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e0e0e0', fontSize: 11, color: '#888', textAlign: 'center' }}>
        Routiflow · Sistema de gestión de entregas · {new Date().toLocaleDateString('es-CL')}
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function QLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>{children}</div>;
}

function QF({ label, value, onChange, placeholder }) {
  return (
    <div>
      <QLabel>{label}</QLabel>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} style={qinp} />
    </div>
  );
}

const qinp = {
  width: '100%', background: '#f8f8f8', border: '1px solid #e0e0e0', borderRadius: 10,
  color: '#111', fontSize: 13, padding: '9px 11px', outline: 'none',
  display: 'block', boxSizing: 'border-box'
};

function smBtn(color) {
  return { padding: '5px 11px', borderRadius: 8, border: `1px solid ${color}30`, background: `${color}12`, color, fontSize: 11, fontWeight: 700, cursor: 'pointer' };
}

const centeredMsg = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', fontSize: 14, color: '#888' };
