import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';
import InventoryPicker, { totalVol, recommendVehicleType, serializeInventory, parseInventoryStr } from '../../components/InventoryPicker.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  draft:     { label: 'Borrador',    color: '#888',    bg: '#88888812' },
  sent:      { label: 'Enviada',     color: '#f57c00', bg: '#f57c0012' },
  submitted: { label: '● Recibida', color: '#0077aa', bg: '#0077aa12' },
  approved:  { label: '✓ Aprobada', color: '#0052FF', bg: '#0052FF12' },
  rejected:  { label: '✗ Rechazada',color: '#cc2244', bg: '#cc224412' },
};

const VEHICLE_NAMES = { furgon: 'Furgon', camion34: 'Camion 3/4', camionLargo: 'Camion Largo' };
const VEHICLE_ICONS = { furgon: '🚐', camion34: '🚚', camionLargo: '🚛' };
const SERVICE_LABELS = { flete: 'Flete', mudanza: 'Mudanza', paqueteria: 'Paqueteria' };

// ── Price helpers (mirrors server logic) ──────────────────────────────────────

function calcExactPrice(cfg, distKm, driverHelps, helpers, floors, packing) {
  if (!cfg || !distKm) return 0;
  const tiers = (cfg.kmTiers || []).slice().sort((a, b) => a.max_km - b.max_km);
  const tier  = tiers.find(t => distKm <= t.max_km) || tiers[tiers.length - 1];
  const ppk   = tier ? Number(tier.price_per_km || 0) : 0;
  const ex    = cfg.extras || {};
  return Math.round((
    Number(cfg.basePrice || 0)
    + distKm * ppk
    + 0
    + helpers * Number(ex.helper || 0)
    + floors  * Number(ex.floor  || 0)
    + (packing ? Number(ex.packing || 0) : 0)
  ) / 1000) * 1000;
}

function calcRange(exact) {
  const low  = Math.round(exact * 0.88 / 5000) * 5000;
  const high = Math.round(exact * 1.18 / 5000) * 5000;
  return { min: Math.max(low, 5000), max: Math.max(high, low + 20000) };
}

function calcBreakdown(cfg, distKm, driverHelps, helpers, floors, packing) {
  if (!cfg || !distKm) return null;
  const tiers  = (cfg.kmTiers || []).slice().sort((a, b) => a.max_km - b.max_km);
  const tier   = tiers.find(t => distKm <= t.max_km) || tiers[tiers.length - 1];
  const ppk    = tier ? Number(tier.price_per_km || 0) : 0;
  const ex     = cfg.extras || {};
  const base   = Number(cfg.basePrice || 0);
  const kmCost = Math.round(distKm * ppk);
  const dvCost = 0;
  const hlCost = helpers * Number(ex.helper || 0);
  const flCost = floors  * Number(ex.floor  || 0);
  const pkCost = packing ? Number(ex.packing || 0) : 0;
  return { base, kmCost, ppk, dvCost, hlCost, flCost, pkCost, total: base + kmCost + dvCost + hlCost + flCost + pkCost };
}

const fmt = n => Number(n || 0).toLocaleString('es-CL');

// ── PDF generator ─────────────────────────────────────────────────────────────

function printQuotePDF(q, priceMin, priceMax, cfg) {
  const isFlete = q.serviceType !== 'paqueteria';
  const km = Number(q.distanceKm) || 0;
  const dh = q.driverHelps || false;
  const nh = q.numHelpers || 0;
  const storedOriginFloors = Number(q.originFloors || 0);
  const storedDestinationFloors = Number(q.destinationFloors || 0);
  const originFloors = storedOriginFloors || storedDestinationFloors ? storedOriginFloors : Number(q.numFloors || 0);
  const destinationFloors = storedOriginFloors || storedDestinationFloors ? storedDestinationFloors : 0;
  const totalFloors = Number(q.numFloors ?? (originFloors + destinationFloors)) || 0;
  const bd = cfg && km > 0 ? calcBreakdown(cfg, km, dh, nh, totalFloors, q.needsPacking || false) : null;
  const exactTotal = bd?.total || (Number(priceMin) === Number(priceMax) ? Number(priceMin) : 0);
  const priceText = exactTotal > 0
    ? `$${fmt(exactTotal)}`
    : `$${fmt(priceMin)} - $${fmt(priceMax)}`;
  const priceNote = exactTotal > 0
    ? 'Precio calculado con la configuracion vigente.'
    : 'Precio sujeto a evaluacion por direcciones o detalles pendientes.';

  const helpLabel = dh
    ? (nh > 0 ? `Traslado + chofer + ${nh} ayudante${nh !== 1 ? 's' : ''}` : 'Traslado + ayuda del chofer incluida')
    : 'Solo traslado';

  const breakdownHtml = bd ? `
<h2>Detalle del precio</h2>
<div class="row"><span class="lbl">Precio base (${VEHICLE_NAMES[q.vehicleType] || q.vehicleType})</span><span class="val">$${fmt(bd.base)}</span></div>
<div class="row"><span class="lbl">Distancia: ${km} km × $${fmt(bd.ppk)}/km</span><span class="val">$${fmt(bd.kmCost)}</span></div>
${dh ? `<div class="row"><span class="lbl">Ayuda del chofer incluida</span><span class="val">$0</span></div>` : ''}
${bd.hlCost > 0 ? `<div class="row"><span class="lbl">Ayudantes adicionales (${nh} × $${fmt(cfg?.extras?.helper)})</span><span class="val">$${fmt(bd.hlCost)}</span></div>` : ''}
${bd.flCost > 0 ? `<div class="row"><span class="lbl">Pisos sin ascensor (${originFloors} retiro + ${destinationFloors} entrega)</span><span class="val">$${fmt(bd.flCost)}</span></div>` : ''}
${bd.pkCost > 0 ? `<div class="row"><span class="lbl">Embalaje profesional</span><span class="val">$${fmt(bd.pkCost)}</span></div>` : ''}
<div class="row" style="margin-top:4px;border-top:2px solid #0052FF20"><span class="lbl" style="font-weight:700;color:#0f172a">Total de referencia</span><span class="val" style="color:#0052FF">$${fmt(bd.total)}</span></div>
` : '';

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cotizacion MUVE ${q.quoteCode}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#1e293b;padding:32px;max-width:720px;margin:auto}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:3px solid #0052FF}
.brand{font-size:30px;font-weight:900;color:#0052FF;letter-spacing:-1px}
.sub{font-size:11px;color:#64748b;margin-top:2px}
h2{font-size:10px;font-weight:700;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin:22px 0 8px;padding-bottom:4px;border-bottom:1px solid #f1f5f9}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f8fafc;font-size:13px}
.lbl{color:#64748b}.val{font-weight:600;text-align:right;max-width:65%}
.price-box{background:#f4f7ff;border:2px solid #0052FF;border-radius:12px;padding:20px;margin:24px 0;text-align:center}
.price-lbl{font-size:11px;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
.price-num{font-size:30px;font-weight:900;color:#0052FF}
.price-note{font-size:11px;color:#94a3b8;margin-top:6px}
.badge{background:#0052FF14;color:#0052FF;border:1px solid #0052FF30;border-radius:20px;padding:2px 9px;font-size:11px;font-weight:700}
.footer{margin-top:36px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6}
.tag{display:inline-block;background:#f1f5f9;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600;margin-right:4px;margin-bottom:4px}
@media print{body{padding:16px}.no-print{display:none}}
</style></head><body>
<div class="hdr">
  <div><div class="brand">MUVE</div><div class="sub">Transporte y logistica en Chile</div></div>
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:700;color:#0f172a">${q.serviceType === 'mudanza' ? 'Cotizacion de Mudanza' : q.serviceType === 'flete' ? 'Cotizacion de Flete' : 'Cotizacion Paqueteria'}</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px">${q.quoteCode} &nbsp;·&nbsp; ${new Date().toLocaleDateString('es-CL')}</div>
    ${q.deliveryDate ? `<div style="font-size:12px;color:#64748b">Fecha estimada: ${new Date(q.deliveryDate).toLocaleDateString('es-CL')}</div>` : ''}
  </div>
</div>

<h2>Datos del cliente</h2>
<div class="row"><span class="lbl">Nombre</span><span class="val">${q.contactPerson || '—'}</span></div>
<div class="row"><span class="lbl">Telefono</span><span class="val">${q.contactPhone || '—'}</span></div>
${q.clientCompany ? `<div class="row"><span class="lbl">Empresa</span><span class="val">${q.clientCompany}</span></div>` : ''}

${isFlete ? `
<h2>Detalle del servicio</h2>
<div class="row"><span class="lbl">Direccion de retiro</span><span class="val">${q.originAddress || q.origin || '—'}</span></div>
<div class="row"><span class="lbl">Direccion de entrega</span><span class="val">${q.destinationAddress || q.destination || '—'}</span></div>
${q.distanceKm ? `<div class="row"><span class="lbl">Distancia estimada</span><span class="val">${q.distanceKm} km</span></div>` : ''}
${q.vehicleType ? `<div class="row"><span class="lbl">Vehiculo</span><span class="val">${VEHICLE_ICONS[q.vehicleType] || ''} ${VEHICLE_NAMES[q.vehicleType] || q.vehicleType}</span></div>` : ''}
<div class="row"><span class="lbl">Servicio de carga</span><span class="val">${helpLabel}</span></div>
${totalFloors > 0 ? `<div class="row"><span class="lbl">Pisos sin ascensor</span><span class="val">${totalFloors} piso(s): ${originFloors} retiro + ${destinationFloors} entrega</span></div>` : ''}
${q.needsPacking ? `<div class="row"><span class="lbl">Embalaje profesional</span><span class="val"><span class="badge">Incluido</span></span></div>` : ''}
${q.isConserjeria ? `<div class="row"><span class="lbl">Coordinacion conserjeria</span><span class="val">Si</span></div>` : ''}
${(() => {
    try {
      const p = JSON.parse(q.itemsDescription || '');
      if (p?.inventory?.length) {
        const rows = p.inventory.map(i => `<div class="row"><span class="lbl">${i.name}</span><span class="val">${i.qty} unidad(es)</span></div>`).join('');
        const extRow = p.extras ? `<div class="row"><span class="lbl">Otros</span><span class="val">${p.extras}</span></div>` : '';
        return rows + extRow;
      }
    } catch {}
    return q.itemsDescription ? `<div class="row"><span class="lbl">Items</span><span class="val">${q.itemsDescription}</span></div>` : '';
  })()}
${breakdownHtml}
` : ''}

<div class="price-box">
  <div class="price-lbl">Precio estimado para el cliente</div>
  <div class="price-num">${priceText}</div>
  <div class="price-note">${priceNote}</div>
</div>

${q.clientNotes ? `<h2>Notas del cliente</h2><div style="font-size:13px;color:#475569;padding:10px 0;line-height:1.6">${q.clientNotes}</div>` : ''}

<div class="footer">
  <p><strong>MUVE</strong> · Transporte y logistica en Chile</p>
  <p>Para confirmar o modificar este servicio, contactenos directamente.</p>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=760,height=960');
  if (!w) { toast('Permite popups para generar el PDF'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function QuotesView() {
  const [quotes, setQuotes]           = useState([]);
  const [drivers, setDrivers]         = useState([]);
  const [vehicleConfigs, setVehicleConfigs] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [creating, setCreating]       = useState(false);
  const [detailQuote, setDetailQuote] = useState(null);
  const [serviceFilter, setServiceFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      api.getQuotes(),
      api.getUsers(),
      api.getVehicleConfigs().catch(() => []), // silencioso si tabla no existe aún
    ])
      .then(([qs, us, vcs]) => {
        setQuotes(qs);
        setDrivers(us.filter(u => u.role === 'driver' && u.active));
        setVehicleConfigs(vcs);
      })
      .catch(err => toast('❌ ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const reload = useCallback(() => {
    api.getQuotes().then(qs => {
      setQuotes(qs);
      setDetailQuote(prev => {
        if (!prev) return null;
        return qs.find(q => q._id === prev._id) || prev;
      });
    }).catch(() => {});
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta cotizacion?')) return;
    try {
      await api.deleteQuote(id);
      setQuotes(prev => prev.filter(q => q._id !== id));
      toast('🗑️ Eliminada');
    } catch (err) { toast('❌ ' + err.message); }
  };

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>;

  const visible = serviceFilter === 'all' ? quotes : quotes.filter(q => (q.serviceType || 'flete') === serviceFilter);

  return (
    <>
      {/* ── Full-screen detail panel ───────────────────────────────────── */}
      {detailQuote && (() => {
        const isFl = detailQuote.serviceType === 'flete' || detailQuote.serviceType === 'mudanza';
        const meta = STATUS_META[detailQuote.status] || STATUS_META.draft;
        return (
          <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, boxShadow: '0 1px 8px #0000000d' }}>
              <button
                onClick={() => setDetailQuote(null)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                ← Cotizaciones
              </button>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detailQuote.quoteCode}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{SERVICE_LABELS[detailQuote.serviceType] || 'Flete'} · {detailQuote.contactPerson || detailQuote.clientCompany || '—'}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}28`, flexShrink: 0 }}>
                {meta.label}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {isFl
                ? <FleteDetailPanel quote={detailQuote} drivers={drivers} vehicleConfigs={vehicleConfigs} onReload={reload} onDelete={() => { handleDelete(detailQuote._id); setDetailQuote(null); }} />
                : <PaqueteriaDetailPanel quote={detailQuote} drivers={drivers} onReload={reload} onDelete={() => { handleDelete(detailQuote._id); setDetailQuote(null); }} />
              }
            </div>
          </div>
        );
      })()}

      {/* ── Quotes list ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px calc(90px + env(safe-area-inset-bottom))' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 0 10px', scrollbarWidth: 'none' }}>
          {[['all','Todas'],['flete','Fletes'],['mudanza','Mudanzas'],['paqueteria','Paqueteria']].map(([v, l]) => (
            <button key={v} onClick={() => setServiceFilter(v)} style={{
              flexShrink: 0, borderRadius: 20, border: '1px solid var(--border)', padding: '6px 13px',
              background: serviceFilter === v ? 'var(--accent)' : '#fff',
              color: serviceFilter === v ? '#fff' : 'var(--muted)',
              fontSize: 12, fontWeight: 800, cursor: 'pointer'
            }}>{l}</button>
          ))}
        </div>

        {/* Migration reminder */}
        {vehicleConfigs.length === 0 && (
          <div style={{ background: '#fff7ed', border: '1px solid #f97316', borderRadius: 12, padding: '12px 14px', marginBottom: 10, fontSize: 12 }}>
            <div style={{ fontWeight: 800, color: '#c2410c', marginBottom: 4 }}>⚠️ Migración SQL pendiente</div>
            <div style={{ color: '#92400e', lineHeight: 1.5 }}>
              Los campos de vehículo, distancia, ayudantes y artículos no se guardarán hasta que ejecutes la migración.<br />
              <strong>SQL Editor → <code>supabase/vehicle_pricing.sql</code></strong>
            </div>
          </div>
        )}

        {visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
            <p style={{ fontSize: 14 }}>No hay cotizaciones.</p>
          </div>
        )}

        {visible.map(q => (
          <QuoteCard key={q._id} quote={q} onOpen={setDetailQuote} />
        ))}

        <button
          onClick={() => setCreating(true)}
          style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom))', right: 16, width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px #0052FF40', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >＋</button>

        {creating && (
          <CreateQuoteModal
            onClose={() => setCreating(false)}
            onCreated={(q) => { setQuotes(prev => [q, ...prev]); setCreating(false); setDetailQuote(q); }}
          />
        )}
      </div>
    </>
  );
}

// ── Quote card ────────────────────────────────────────────────────────────────

function QuoteCard({ quote: q, onOpen }) {
  const meta   = STATUS_META[q.status] || STATUS_META.draft;
  const isFlete = q.serviceType === 'flete' || q.serviceType === 'mudanza';

  return (
    <div onClick={() => onOpen(q)} style={{ background: 'var(--card)', border: `1px solid ${q.status === 'submitted' ? '#0077aa40' : 'var(--border)'}`, borderRadius: 14, marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px #0000000a', cursor: 'pointer' }}>
      <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{q.quoteCode}</span>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: '#0052FF12', color: 'var(--accent)', border: '1px solid #0052FF28' }}>
              {SERVICE_LABELS[q.serviceType] || 'Flete'}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}28` }}>
              {meta.label}
            </span>
            {q.status === 'submitted' && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: '#0077aa', color: '#fff', animation: 'pulse 1.4s ease infinite' }}>NUEVA</span>
            )}
          </div>

          <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 3, fontWeight: 600 }}>
            {q.contactPerson || q.clientCompany || '—'}
            {q.contactPhone && <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>{q.contactPhone}</span>}
          </div>

          {isFlete && (q.originAddress || q.origin) && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>
              📍 {q.originAddress || q.origin}
              {(q.destinationAddress || q.destination) && <span> → {q.destinationAddress || q.destination}</span>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            {q.distanceKm && <Chip color="var(--accent)">{q.distanceKm} km</Chip>}
            {q.vehicleType && <Chip>{VEHICLE_ICONS[q.vehicleType]} {VEHICLE_NAMES[q.vehicleType] || q.vehicleType}</Chip>}
            {q.priceMin && q.priceMax && <Chip color="var(--accent)" bold>${fmt(q.priceMin)} – ${fmt(q.priceMax)}</Chip>}
            {isFlete && q.driverHelps && !q.numHelpers && <Chip>👷 Ayuda chofer</Chip>}
            {isFlete && q.driverHelps && q.numHelpers > 0 && <Chip>👷 Chofer +{q.numHelpers} ayud.</Chip>}
            {isFlete && !q.driverHelps && q.vehicleType && <Chip>🚗 Solo traslado</Chip>}
            {q.numFloors > 0 && <Chip>🏢 {q.numFloors} piso(s)</Chip>}
            {q.needsPacking && <Chip>📦 Embalaje</Chip>}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 300, lineHeight: 1 }}>›</span>
          {q.deliveryDate && (
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
              {new Date(q.deliveryDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Fallback configs when vehicle_configs table not yet migrated
const FALLBACK_CONFIGS = [
  { id: 'furgon',      vehicleType: 'furgon',      name: 'Furgón',      basePrice: 20000, kmTiers: [{max_km:50,price_per_km:1000},{max_km:150,price_per_km:800},{max_km:9999,price_per_km:600}], extras:{driver_help:20000,helper:15000,floor:5000,packing:15000} },
  { id: 'camion34',    vehicleType: 'camion34',    name: 'Camión 3/4',  basePrice: 35000, kmTiers: [{max_km:50,price_per_km:1000},{max_km:150,price_per_km:800},{max_km:9999,price_per_km:600}], extras:{driver_help:20000,helper:15000,floor:5000,packing:15000} },
  { id: 'camionLargo', vehicleType: 'camionLargo', name: 'Camión Largo',basePrice: 80000, kmTiers: [{max_km:200,price_per_km:700},{max_km:500,price_per_km:550},{max_km:9999,price_per_km:400}], extras:{driver_help:20000,helper:15000,floor:6000,packing:20000} },
];

// ── Flete / Mudanza detail panel ──────────────────────────────────────────────

// Parse __flete__ JSON saved in client_notes when migration columns don't exist yet
function recoverFleteFromNotes(notes) {
  if (!notes) return null;
  const match = notes.match(/__flete__:(\{.+?\})\s*$/s);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}
function stripFleteTag(notes) {
  return (notes || '').replace(/\n?__flete__:\{[\s\S]+?\}\s*$/, '').trim();
}

function FleteDetailPanel({ quote: q, drivers, vehicleConfigs, onReload, onDelete }) {
  const quoteServiceType = q.serviceType === 'mudanza' ? 'mudanza' : 'flete';
  const serviceConfigs = vehicleConfigs.filter(c => (c.serviceType || 'flete') === quoteServiceType);
  const legacyConfigs = vehicleConfigs.filter(c => !c.serviceType || c.serviceType === 'flete');
  const allConfigs = serviceConfigs.length > 0
    ? serviceConfigs
    : (legacyConfigs.length > 0 ? legacyConfigs : FALLBACK_CONFIGS);

  // If migration not yet run, dedicated columns will be all-zero — recover from client_notes backup
  const recovered = (!q.numHelpers && !q.numFloors && !q.needsPacking && !q.vehicleType && !q.distanceKm)
    ? recoverFleteFromNotes(q.clientNotes)
    : null;

  // Editable fields — prefer dedicated columns, fall back to recovered data
  const [name,        setName]        = useState(q.contactPerson || '');
  const [phone,       setPhone]       = useState(q.contactPhone || '');
  const [originAddr,  setOriginAddr]  = useState(q.originAddress || q.origin || recovered?.origin || '');
  const [destAddr,    setDestAddr]    = useState(q.destinationAddress || q.destination || recovered?.dest || '');
  const [distKm,      setDistKm]      = useState(q.distanceKm || recovered?.km || '');
  const [vehicleType, setVehicleType] = useState(q.vehicleType || recovered?.vh || allConfigs[0].vehicleType);
  // Help mode: 'none' | 'driver' | 'helpers'
  const initHelpMode = q.driverHelps
    ? (q.numHelpers > 0 ? 'helpers' : 'driver')
    : 'none';
  const [helpMode,         setHelpMode]        = useState(initHelpMode);
  const [helpers,          setHelpers]         = useState(q.numHelpers || recovered?.hl || 1);
  const storedOriginFloors = Number(q.originFloors || 0);
  const storedDestinationFloors = Number(q.destinationFloors || 0);
  const initialOriginFloors = storedOriginFloors || storedDestinationFloors ? storedOriginFloors : (q.numFloors || recovered?.fl || 0);
  const initialDestinationFloors = storedOriginFloors || storedDestinationFloors ? storedDestinationFloors : 0;
  const [originFloors,      setOriginFloors]   = useState(initialOriginFloors);
  const [destinationFloors, setDestinationFloors] = useState(initialDestinationFloors);
  const floors = Number(originFloors || 0) + Number(destinationFloors || 0);
  const [packing,          setPacking]         = useState(q.needsPacking || recovered?.pk || false);
  const [conserjeria,      setConserjeria]     = useState(q.isConserjeria || recovered?.cs || false);
  const { inventory: parsedInv, extras: parsedExtras } = parseInventoryStr(q.itemsDescription || recovered?.items || '');
  const [inventory,        setInventory]       = useState(parsedInv);
  const [inventoryExtras,  setInventoryExtras] = useState(parsedExtras);
  const [clientNotes, setClientNotes] = useState(stripFleteTag(q.clientNotes) || '');
  const [adminNotes,  setAdminNotes]  = useState(q.adminNotes || '');
  const [deliveryDate,setDeliveryDate]= useState(q.deliveryDate ? new Date(q.deliveryDate).toISOString().slice(0,10) : '');
  const [priceMin,    setPriceMin]    = useState(q.priceMin   || 0);
  const [priceMax,    setPriceMax]    = useState(q.priceMax   || 0);
  const [driverId,    setDriverId]    = useState('');
  const [saving,      setSaving]      = useState(false);
  const [approving,   setApproving]   = useState(false);
  const [priceEdited, setPriceEdited] = useState(false);

  const cfg = allConfigs.find(c => c.vehicleType === vehicleType) || allConfigs[0];
  const km  = Number(distKm) || 0;
  const driverHelps = helpMode !== 'none';
  const actualHelpers = helpMode === 'helpers' ? helpers : 0;
  const bd  = calcBreakdown(cfg, km, driverHelps, actualHelpers, floors, packing);

  // Auto-recalculate price when vehicle/distance/extras change (unless manually overridden)
  useEffect(() => {
    if (!km || priceEdited) return;
    const exact = calcExactPrice(cfg, km, driverHelps, actualHelpers, floors, packing);
    const r = calcRange(exact);
    setPriceMin(r.min);
    setPriceMax(r.max);
  }, [vehicleType, km, helpMode, helpers, floors, packing, priceEdited]);

  // Auto-recommend vehicle from inventory (if price not manually edited)
  useEffect(() => {
    const vol = totalVol(inventory);
    if (vol === 0) return;
    const rec = recommendVehicleType(vol, inventory);
    if (rec !== vehicleType) {
      setVehicleType(rec);
      setPriceEdited(false);
    }
  }, [inventory]);

  const isDone = ['approved', 'rejected'].includes(q.status);

  const waMessage = () => {
    const vName = VEHICLE_NAMES[vehicleType] || vehicleType;
    const parts = [
      `Hola ${name || 'cliente'} 👋, te contacto de *MUVE Transportes*.\n`,
      `Recibimos tu cotización *${q.quoteCode}* para ${q.serviceType === 'mudanza' ? 'una mudanza' : 'un flete'}.`,
      `\n📍 *Recorrido:*`,
      `• Retiro: ${originAddr || '—'}`,
      `• Entrega: ${destAddr || '—'}`,
      km ? `• Distancia: ~${km} km` : '',
      `\n🚚 *Vehículo recomendado:* ${vName}`,
      helpMode === 'none'    ? '🚗 Solo traslado (sin ayuda de carga)' : '',
      helpMode === 'driver'  ? '👷 Con ayuda del chofer incluida' : '',
      helpMode === 'helpers' ? `👷 Chofer + ${helpers} ayudante${helpers !== 1 ? 's' : ''} adicionale${helpers !== 1 ? 's' : ''}` : '',
      floors  > 0 ? `🏢 Pisos: ${floors} (retiro ${originFloors}, entrega ${destinationFloors})` : '',
      packing ? '📦 Embalaje profesional' : '',
      conserjeria ? '🔑 Coordinación conserjería' : '',
      inventory.length > 0 ? `\n📋 *Artículos confirmados:*\n${inventory.map(i => `• ${i.name}: ${i.qty}`).join('\n')}` : '',
      inventoryExtras ? `• Otros: ${inventoryExtras}` : '',
      priceMin && priceMax ? `\n💰 *Precio estimado: $${fmt(priceMin)} – $${fmt(priceMax)} CLP*` : '',
      `\n¿Podrías confirmarme lo siguiente para cerrar la cotización?\n• ¿Hay ascensor en origen y destino?\n• Fecha y hora preferida\n• ¿Algo frágil o de gran tamaño?\n\nQuedamos atentos 🙌 equipo MUVE`,
    ];
    return parts.filter(Boolean).join('\n');
  };

  const openWA = () => {
    const num = phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(waMessage())}`, '_blank');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateQuote(q._id, {
        contactPerson: name, contactPhone: phone,
        originAddress: originAddr, destinationAddress: destAddr,
        distanceKm: km || null, vehicleType,
        driverHelps: helpMode !== 'none',
        numHelpers: helpMode === 'helpers' ? helpers : 0,
        numFloors: floors, originFloors, destinationFloors, needsPacking: packing,
        isConserjeria: conserjeria, itemsDescription: serializeInventory(inventory, inventoryExtras),
        clientNotes, adminNotes,
        deliveryDate: deliveryDate || null,
        priceMin, priceMax,
      });
      toast('✅ Cotizacion guardada');
      onReload();
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const handleApprove = async () => {
    if (!confirm('¿Aprobar y crear la ruta?')) return;
    setApproving(true);
    try {
      const { route } = await api.approveQuote(q._id, { driverId: driverId || undefined });
      toast(`✅ Ruta ${route.routeCode} creada`);
      onReload();
    } catch (err) { toast('❌ ' + err.message); }
    finally { setApproving(false); }
  };

  const handleReject = async () => {
    if (!confirm('¿Rechazar esta cotizacion?')) return;
    try { await api.rejectQuote(q._id); onReload(); toast('✗ Rechazada'); }
    catch (err) { toast('❌ ' + err.message); }
  };

  return (
    <div style={{ padding: '14px 14px' }}>

      {/* ── CLIENTE ── */}
      <Section title="🧑 CLIENTE">
        <EditField label="Nombre" value={name} onChange={setName} disabled={isDone} placeholder="Nombre y apellido" />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <EditField label="Teléfono / WhatsApp" value={phone} onChange={setPhone} disabled={isDone} placeholder="+56 9 xxxx xxxx" type="tel" />
          </div>
          {phone && (
            <button
              onClick={openWA}
              style={{ flexShrink: 0, marginBottom: 1, padding: '9px 14px', borderRadius: 10, border: '1px solid #25d36630', background: '#25d36614', color: '#25d366', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              💬 WhatsApp
            </button>
          )}
        </div>
        {q.clientCompany && <InfoRow label="Empresa" value={q.clientCompany} />}
        <div>
          <DL>Fecha preferida</DL>
          <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} disabled={isDone} style={tinp} />
        </div>
        <div style={{ marginTop: 8 }}>
          <DL>Notas del cliente</DL>
          <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} rows={2} disabled={isDone} placeholder="Lo que el cliente indicó en el formulario…" style={{ ...tinp, resize: 'vertical' }} />
        </div>
      </Section>

      {/* ── RECORRIDO ── */}
      <Section title="📍 RECORRIDO">
        <EditField label="Dirección de retiro (origen)" value={originAddr} onChange={setOriginAddr} disabled={isDone} placeholder="Av. Vitacura 2939, Las Condes…" />
        <EditField label="Dirección de entrega (destino)" value={destAddr} onChange={setDestAddr} disabled={isDone} placeholder="Calle Ahumada 100, Santiago…" />
        <div>
          <DL>Distancia estimada (km)</DL>
          <input
            type="number"
            value={distKm}
            onChange={e => { setDistKm(e.target.value); setPriceEdited(false); }}
            disabled={isDone}
            placeholder="Ej: 12.5"
            style={tinp}
          />
        </div>
      </Section>

      {/* ── VEHÍCULO ── */}
      <Section title="🚚 VEHÍCULO RECOMENDADO">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allConfigs.map(c => {
            const active = vehicleType === c.vehicleType;
            const est = km > 0 ? calcRange(calcExactPrice(c, km, driverHelps, actualHelpers, floors, packing)) : null;
            return (
              <button
                key={c.vehicleType}
                type="button"
                onClick={() => { if (!isDone) { setVehicleType(c.vehicleType); setPriceEdited(false); } }}
                style={{
                  padding: '10px 13px', borderRadius: 11, textAlign: 'left', cursor: isDone ? 'default' : 'pointer',
                  border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? '#0052FF08' : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 13, color: active ? 'var(--accent)' : '#0f172a' }}>
                      {VEHICLE_ICONS[c.vehicleType]} {c.name}
                    </span>
                    {c.description && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{c.description}</div>}
                  </div>
                  {est && (
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: active ? 'var(--accent)' : '#475569' }}>${fmt(est.min)}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>hasta ${fmt(est.max)}</div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── EXTRAS ── */}
      <Section title="⚡ EXTRAS Y SERVICIOS">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* ── Help mode selector ── */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Servicio de carga</div>
            {[
              { v: 'none',    title: 'Solo traslado',         desc: 'El chofer solo conduce el camión', cost: null },
              { v: 'driver',  title: 'Chofer ayuda',          desc: 'Incluido en precio base', cost: null },
              { v: 'helpers', title: 'Chofer + ayudantes',    desc: 'Chofer incluido + ayudantes extra', cost: null },
            ].map(opt => (
              <button key={opt.v} type="button" onClick={() => !isDone && setHelpMode(opt.v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 11px', marginBottom: 7, borderRadius: 9,
                  border: `1.5px solid ${helpMode === opt.v ? 'var(--accent)' : 'var(--border)'}`,
                  background: helpMode === opt.v ? '#0052FF08' : '#fff',
                  cursor: isDone ? 'default' : 'pointer', textAlign: 'left', transition: 'all .15s',
                }}
              >
                <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${helpMode === opt.v ? 'var(--accent)' : '#CBD5E1'}`, background: helpMode === opt.v ? 'var(--accent)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {helpMode === opt.v && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: helpMode === opt.v ? 'var(--accent)' : '#0f172a' }}>{opt.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{opt.desc}</div>
                </div>
                {opt.cost > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: helpMode === opt.v ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }}>+${fmt(opt.cost)}</span>
                )}
              </button>
            ))}
            {/* Count stepper — only shown when mode = 'helpers' */}
            {helpMode === 'helpers' && (
              <div style={{ marginLeft: 8, marginTop: 2 }}>
                <ExtraRow
                  label="Número de ayudantes"
                  sub={`Además del chofer${cfg?.extras?.helper ? ` · +$${fmt(cfg.extras.helper)} c/u` : ''}`}
                  value={helpers}
                  onDec={() => setHelpers(n => Math.max(1, n - 1))}
                  onInc={() => setHelpers(n => n + 1)}
                  disabled={isDone}
                />
              </div>
            )}
          </div>

          <ExtraRow
            label="Pisos en retiro"
            sub={`Escaleras al cargar${cfg?.extras?.floor ? ` · +$${fmt(cfg.extras.floor)} c/piso` : ''}`}
            value={originFloors}
            onDec={() => setOriginFloors(n => Math.max(0, n - 1))}
            onInc={() => setOriginFloors(n => n + 1)}
            disabled={isDone}
          />
          <ExtraRow
            label="Pisos en entrega"
            sub={`Escaleras al descargar${cfg?.extras?.floor ? ` · +$${fmt(cfg.extras.floor)} c/piso` : ''}`}
            value={destinationFloors}
            onDec={() => setDestinationFloors(n => Math.max(0, n - 1))}
            onInc={() => setDestinationFloors(n => n + 1)}
            disabled={isDone}
          />
          <CheckRow
            label="Embalaje profesional"
            sub={cfg?.extras?.packing ? `+$${fmt(cfg.extras.packing)} — empaque de todos los items` : 'Empaque de todos los items'}
            checked={packing}
            onChange={v => { setPacking(v); }}
            disabled={isDone}
          />
          <CheckRow
            label="Coordinacion conserjeria"
            sub="Aviso y tramite en edificio / condominio — sin costo adicional"
            checked={conserjeria}
            onChange={setConserjeria}
            disabled={isDone}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <DL>Artículos a transportar</DL>
          <InventoryPicker
            inventory={inventory}
            onChange={setInventory}
            extras={inventoryExtras}
            onExtrasChange={setInventoryExtras}
            disabled={isDone}
          />
        </div>
      </Section>

      {/* ── PRECIO ── */}
      <Section title="💰 PRECIO ESTIMADO">
        {bd && km > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: 'var(--muted)', marginBottom: 8 }}>DESGLOSE DEL CALCULO</div>
            <BDRow label={`Precio base ${VEHICLE_NAMES[vehicleType] || ''}`} val={bd.base} />
            {bd.kmCost > 0 && <BDRow label={`Distancia (${km} km × $${fmt(bd.ppk)}/km)`} val={bd.kmCost} />}
            {driverHelps && <BDRow label="Ayuda del chofer incluida" val={0} />}
            {bd.hlCost > 0 && <BDRow label={`Ayudantes adicionales (${actualHelpers} × $${fmt(cfg?.extras?.helper)})`} val={bd.hlCost} />}
            {bd.flCost > 0 && <BDRow label={`Pisos (${originFloors} retiro + ${destinationFloors} entrega) × $${fmt(cfg?.extras?.floor)}`} val={bd.flCost} />}
            {bd.pkCost > 0 && <BDRow label="Embalaje" val={bd.pkCost} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px solid var(--border)', fontSize: 13, fontWeight: 800 }}>
              <span>Total exacto</span>
              <span style={{ color: 'var(--accent)' }}>${fmt(bd.total)}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <DL>Precio mínimo ($)</DL>
            <input
              type="number"
              value={priceMin}
              onChange={e => { setPriceMin(Number(e.target.value)); setPriceEdited(true); }}
              disabled={isDone}
              style={tinp}
            />
          </div>
          <div>
            <DL>Precio máximo ($)</DL>
            <input
              type="number"
              value={priceMax}
              onChange={e => { setPriceMax(Number(e.target.value)); setPriceEdited(true); }}
              disabled={isDone}
              style={tinp}
            />
          </div>
        </div>

        {priceEdited && !isDone && (
          <button onClick={() => { setPriceEdited(false); }} style={{ ...ab('var(--accent)'), fontSize: 10, marginTop: 6, padding: '4px 10px' }}>
            ↺ Recalcular automático
          </button>
        )}

        {(priceMin > 0 || priceMax > 0) && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: '#f4f7ff', border: '1px solid #0052FF20', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>PRECIO A ENVIAR AL CLIENTE</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)' }}>
              ${fmt(priceMin)} – ${fmt(priceMax)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
              {VEHICLE_ICONS[vehicleType]} {VEHICLE_NAMES[vehicleType]}{km > 0 ? ` · ${km} km` : ''}
              {helpMode === 'driver' && ' · Ayuda del chofer'}
              {helpMode === 'helpers' && ` · Chofer + ${helpers} ayud.`}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {phone && (
            <button
              onClick={openWA}
              style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #25d36630', background: '#25d36614', color: '#25d366', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            >
              💬 Enviar por WhatsApp
            </button>
          )}
          <button
            onClick={() => printQuotePDF({ ...q, contactPerson: name, contactPhone: phone, originAddress: originAddr, destinationAddress: destAddr, distanceKm: km, vehicleType, driverHelps: helpMode !== 'none', numHelpers: helpMode === 'helpers' ? helpers : 0, numFloors: floors, originFloors, destinationFloors, needsPacking: packing, isConserjeria: conserjeria, itemsDescription: serializeInventory(inventory, inventoryExtras) }, priceMin, priceMax, cfg)}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #0052FF30', background: '#0052FF10', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            📄 Generar PDF
          </button>
        </div>
      </Section>

      {/* ── NOTAS INTERNAS ── */}
      <Section title="🗒️ NOTAS INTERNAS">
        <textarea
          value={adminNotes}
          onChange={e => setAdminNotes(e.target.value)}
          placeholder="Solo visible para el admin — no lo ve el cliente"
          rows={2}
          disabled={isDone}
          style={{ ...tinp, resize: 'vertical' }}
        />
      </Section>

      {q.convertedRouteId && (
        <div style={{ padding: '9px 12px', borderRadius: 10, background: '#f4f7ff', border: '1px solid #0052FF28', marginBottom: 12, fontSize: 12, color: '#0052FF', fontWeight: 700 }}>
          ✓ Ruta creada: {q.convertedRouteId?.routeCode || q.convertedRouteId}
        </div>
      )}

      {!isDone && (
        <>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', marginBottom: 8 }}
          >
            {saving ? 'Guardando…' : '✓ Guardar cambios'}
          </button>

          {q.status === 'submitted' && (
            <div style={{ padding: '12px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #22c55e30', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>✅ APROBAR Y CREAR RUTA</div>
              <select value={driverId} onChange={e => setDriverId(e.target.value)} style={sinp}>
                <option value="">Sin driver asignado</option>
                {drivers.map(d => <option key={d._id} value={d._id}>{d.name}{d.phone ? ` · ${d.phone}` : ''}</option>)}
              </select>
              <button onClick={handleApprove} disabled={approving} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', marginTop: 8, background: approving ? 'var(--border)' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 800, cursor: approving ? 'not-allowed' : 'pointer' }}>
                {approving ? 'Creando ruta…' : '✅ Aprobar y crear ruta'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 7 }}>
            {q.status !== 'rejected' && <button onClick={handleReject} style={{ ...ab('#cc2244'), flex: 1 }}>✗ Rechazar</button>}
            <button onClick={onDelete} style={{ ...ab('var(--muted)'), flex: 1 }}>🗑️ Eliminar</button>
          </div>
        </>
      )}

      {isDone && (
        <div style={{ display: 'flex', gap: 7, marginTop: 4 }}>
          <button onClick={onDelete} style={{ ...ab('var(--muted)'), flex: 1 }}>🗑️ Eliminar</button>
        </div>
      )}
    </div>
  );
}

// ── EditField helper ──────────────────────────────────────────────────────────

function EditField({ label, value, onChange, disabled, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <DL>{label}</DL>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        style={tinp}
      />
    </div>
  );
}

// ── Paqueteria detail panel ───────────────────────────────────────────────────

function PaqueteriaDetailPanel({ quote: q, drivers, onReload, onDelete }) {
  const [driverId,   setDriverId]   = useState('');
  const [adminNotes, setAdminNotes] = useState(q.adminNotes || '');
  const [saving,     setSaving]     = useState(false);
  const [approving,  setApproving]  = useState(false);
  const [shareUrl,   setShareUrl]   = useState(null);
  const isDone = ['approved','rejected'].includes(q.status);

  const handleSave = async () => {
    setSaving(true);
    try { await api.updateQuote(q._id, { adminNotes }); toast('✅ Guardado'); onReload(); }
    catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const handleApprove = async () => {
    if (!confirm('¿Aprobar y crear ruta?')) return;
    setApproving(true);
    try {
      const { route } = await api.approveQuote(q._id, { driverId: driverId || undefined });
      toast(`✅ Ruta ${route.routeCode} creada`);
      onReload();
    } catch (err) { toast('❌ ' + err.message); }
    finally { setApproving(false); }
  };

  const handleReject = async () => {
    if (!confirm('¿Rechazar?')) return;
    try { await api.rejectQuote(q._id); onReload(); toast('✗ Rechazada'); }
    catch (err) { toast('❌ ' + err.message); }
  };

  const handleSendLink = async () => {
    try {
      const { shareToken } = await api.sendQuote(q._id);
      const url = `${window.location.origin}/quote/${shareToken}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast('📋 Enlace copiado');
      onReload();
    } catch (err) { toast('❌ ' + err.message); }
  };

  return (
    <div style={{ padding: '14px 14px' }}>
      <Section title="🧑 CLIENTE">
        <InfoRow label="Nombre" value={q.contactPerson || '—'} />
        {q.contactPhone && (
          <InfoRow label="Telefono">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{q.contactPhone}</span>
              <a href={`https://wa.me/${q.contactPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola, te contacto de MUVE sobre tu consulta ${q.quoteCode}`)}`} target="_blank" rel="noreferrer"
                style={{ fontSize: 10, fontWeight: 700, background: '#25d36614', color: '#25d366', border: '1px solid #25d36630', borderRadius: 20, padding: '2px 8px', textDecoration: 'none' }}>
                WhatsApp
              </a>
            </div>
          </InfoRow>
        )}
        {q.clientCompany && <InfoRow label="Empresa" value={q.clientCompany} />}
        {q.clientNotes && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: '#e3f2fd', borderRadius: 8, fontSize: 12, color: '#0077aa', lineHeight: 1.4 }}>
            💬 {q.clientNotes}
          </div>
        )}
      </Section>

      {shareUrl && (
        <Section title="🔗 ENLACE">
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 6 }}>{shareUrl}</div>
          <button onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast('📋 Copiado'))} style={{ ...ab('var(--accent)'), width: '100%' }}>📋 Copiar enlace</button>
        </Section>
      )}

      {!shareUrl && !isDone && (
        <button onClick={handleSendLink} style={{ ...ab('var(--accent)'), width: '100%', marginBottom: 10, padding: '9px', fontSize: 12 }}>
          🔗 Generar enlace de cotizacion
        </button>
      )}

      <Section title="🗒️ NOTAS INTERNAS">
        <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} placeholder="Solo visible para el admin" disabled={isDone} style={{ ...tinp, resize: 'vertical' }} />
      </Section>

      {!isDone && (
        <>
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', marginBottom: 8 }}>
            {saving ? 'Guardando…' : '✓ Guardar'}
          </button>
          {q.status === 'submitted' && (
            <div style={{ padding: '10px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #22c55e30', marginBottom: 8 }}>
              <select value={driverId} onChange={e => setDriverId(e.target.value)} style={{ ...sinp, marginBottom: 7 }}>
                <option value="">Sin driver</option>
                {drivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
              <button onClick={handleApprove} disabled={approving} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: approving ? 'var(--border)' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 800, cursor: approving ? 'not-allowed' : 'pointer' }}>
                {approving ? 'Creando…' : '✅ Aprobar y crear ruta'}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 7 }}>
            {q.status !== 'rejected' && <button onClick={handleReject} style={{ ...ab('#cc2244'), flex: 1 }}>✗ Rechazar</button>}
            <button onClick={onDelete} style={{ ...ab('var(--muted)'), flex: 1 }}>🗑️ Eliminar</button>
          </div>
        </>
      )}
      {isDone && <button onClick={onDelete} style={{ ...ab('var(--muted)'), width: '100%' }}>🗑️ Eliminar</button>}
    </div>
  );
}

// ── Create Quote Modal ────────────────────────────────────────────────────────

function CreateQuoteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ clientCompany: '', contactPerson: '', contactEmail: '', contactPhone: '', deliveryDate: '', adminNotes: '', tariffId: '' });
  const [tariffs, setTariffs] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.getTariffs().then(setTariffs).catch(() => {}); }, []);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const q = await api.createQuote({ ...form, tariffId: form.tariffId || undefined, deliveryDate: form.deliveryDate || undefined });
      onCreated(q);
      toast('✅ Cotizacion creada');
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 900, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90dvh', overflowY: 'auto', padding: '18px 16px calc(30px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 30px #00000015' }}>
        <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>💼 Nueva cotizacion</h2>
        <CLabel>Empresa cliente</CLabel>
        <input value={form.clientCompany} onChange={e => set('clientCompany', e.target.value)} placeholder="Importadora ABC" style={cinp} />
        <CLabel>Responsable / Contacto</CLabel>
        <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="Nombre y apellido" style={cinp} />
        <CLabel>Email</CLabel>
        <input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder="correo@empresa.com" style={cinp} />
        <CLabel>Telefono / WhatsApp</CLabel>
        <input value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="+56 9 xxxx xxxx" style={cinp} />
        <CLabel>Fecha de entrega (estimada)</CLabel>
        <input type="date" value={form.deliveryDate} onChange={e => set('deliveryDate', e.target.value)} style={cinp} />
        <CLabel>Config de precios (opcional)</CLabel>
        <select value={form.tariffId} onChange={e => set('tariffId', e.target.value)} style={cinp}>
          <option value="">Sin configuracion de precios</option>
          {tariffs.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
        <CLabel>Notas internas</CLabel>
        <textarea value={form.adminNotes} onChange={e => set('adminNotes', e.target.value)} rows={3} style={{ ...cinp, resize: 'vertical' }} placeholder="Instrucciones o requisitos especiales" />
        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 12, background: saving ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Creando…' : '✓ Crear cotizacion'}
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 7 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'var(--muted)', marginBottom: 8 }}>{title}</div>
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, children, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13, gap: 8 }}>
      <span style={{ color: 'var(--muted)', flexShrink: 0, fontSize: 12 }}>{label}</span>
      {children || <span style={{ fontWeight: 600, color: accent ? 'var(--accent)' : 'var(--text)', textAlign: 'right' }}>{value}</span>}
    </div>
  );
}

function BDRow({ label, val }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>${fmt(val)}</span>
    </div>
  );
}

function Chip({ children, color, bold }) {
  return (
    <span style={{ fontSize: 10, fontWeight: bold ? 800 : 600, padding: '2px 7px', borderRadius: 20, background: color ? `${color}12` : 'var(--card2)', color: color || 'var(--muted)', border: `1px solid ${color ? color + '28' : 'var(--border)'}` }}>
      {children}
    </span>
  );
}

function ExtraRow({ label, sub, value, onDec, onInc, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '8px 10px', background: '#fff', borderRadius: 9, border: '1px solid var(--border)' }}>
      <div style={{ flex: '1 1 150px', minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto', marginLeft: 'auto' }}>
        <button type="button" onClick={onDec} disabled={disabled || value === 0} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: '#fff', fontSize: 16, cursor: (disabled || value === 0) ? 'not-allowed' : 'pointer', color: value === 0 ? '#ccc' : '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        <span style={{ fontSize: 15, fontWeight: 800, minWidth: 18, textAlign: 'center' }}>{value}</span>
        <button type="button" onClick={onInc} disabled={disabled} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: '#fff', fontSize: 16, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>
      </div>
    </div>
  );
}

function CheckRow({ label, sub, checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: checked ? '#0052FF08' : '#fff', borderRadius: 9, border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, cursor: disabled ? 'default' : 'pointer', textAlign: 'left', width: '100%' }}
    >
      <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${checked ? 'var(--accent)' : '#cbd5e1'}`, background: checked ? 'var(--accent)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {checked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: checked ? 'var(--accent)' : '#1e293b' }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
      </div>
    </button>
  );
}

function DL({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: 'var(--muted)', textTransform: 'uppercase', margin: '8px 0 4px' }}>{children}</div>;
}

function CLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: 'var(--muted)', textTransform: 'uppercase', margin: '10px 0 4px' }}>{children}</div>;
}

const tinp = { width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13, padding: '9px 11px', outline: 'none', display: 'block', boxSizing: 'border-box', WebkitAppearance: 'none' };
const cinp = { width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 12px', outline: 'none', display: 'block', boxSizing: 'border-box', WebkitAppearance: 'none' };
const sinp = { width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, padding: '9px 11px', outline: 'none', display: 'block', boxSizing: 'border-box', WebkitAppearance: 'none' };
function ab(color) {
  return { padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${color}30`, background: `${color}12`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 };
}
