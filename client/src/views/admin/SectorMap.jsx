import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

// GeoJSON bundled in /public — no external dependency
const LOCAL_GEO = '/comunas_rm.json';

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

const CUSTOM_COLORS = ['#5c35cc', '#d4650a', '#0077aa', '#cc2244', '#00796b', '#5d4037', '#e65100'];

const INP = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--border)', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', background: '#fff', color: '#111'
};

function makeVertexIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="width:14px;height:14px;border-radius:50%;background:#5c35cc;border:3px solid #fff;box-shadow:0 2px 8px #0006;cursor:grab;box-sizing:border-box"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

export default function SectorMap() {
  const mapRef   = useRef(null);
  const mapInst  = useRef(null);
  const layerGrp = useRef(null);
  const dmRef    = useRef(false);
  const rmRef    = useRef(false);
  const ds       = useRef({ pts: [], mks: [], ln: null });
  const finalizeRef = useRef(null);
  const didAutoSeed = useRef(false);

  const reshapeMarkersRef = useRef([]);
  const reshapePolyRef    = useRef(null);
  const reshapePtsRef     = useRef([]);

  const [zones, setZones]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [seeding, setSeeding]     = useState(false);
  const [seedStep, setSeedStep]   = useState('');
  const [drawMode, setDrawMode]   = useState(false);
  const [drawCount, setDrawCount] = useState(0);

  const [reshapeMode, setReshapeMode] = useState(false);
  const [reshapeZone, setReshapeZone] = useState(null);
  const [savingShape, setSavingShape] = useState(false);

  const [panel, setPanel]           = useState(null);
  const [editPrice, setEditPrice]   = useState('');
  const [editName, setEditName]     = useState('');
  const [savingZone, setSavingZone] = useState(false);

  const [newModal, setNewModal]   = useState(null);
  const [newName, setNewName]     = useState('');
  const [newPrice, setNewPrice]   = useState('');
  const [newColor, setNewColor]   = useState(CUSTOM_COLORS[0]);
  const [savingNew, setSavingNew] = useState(false);

  useEffect(() => { dmRef.current = drawMode; }, [drawMode]);
  useEffect(() => { rmRef.current = reshapeMode; }, [reshapeMode]);

  const communeCount = zones.filter(z => z.source === 'commune').length;
  const customCount  = zones.filter(z => z.source === 'custom').length;

  // ── Seed from local file ──────────────────────────────────────────────────────
  const runSeed = useCallback(async (showToast = true) => {
    setSeeding(true);
    try {
      setSeedStep('Cargando comunas del RM…');
      let features = null;
      try {
        const r = await fetch(LOCAL_GEO);
        if (r.ok) { const d = await r.json(); features = d.features; }
      } catch { /* server will try on its own */ }
      setSeedStep('Guardando en base de datos…');
      const result = await api.seedCommunes(features);
      if (showToast) toast(`✅ ${result.created} comunas cargadas`);
      return true;
    } catch (err) {
      toast('❌ ' + err.message);
      return false;
    } finally {
      setSeeding(false);
      setSeedStep('');
    }
  }, []);

  // ── Load zones (auto-seeds if empty) ─────────────────────────────────────────
  const loadZones = useCallback(async (autoSeed = false) => {
    setLoading(true);
    try {
      const data = await api.getZones();
      setZones(data);

      // Auto-seed communes on first open if none exist
      if (autoSeed && !didAutoSeed.current && data.filter(z => z.source === 'commune').length === 0) {
        didAutoSeed.current = true;
        setLoading(false);
        const ok = await runSeed(false);
        if (ok) {
          const data2 = await api.getZones();
          setZones(data2);
          toast(`✅ ${data2.filter(z => z.source === 'commune').length} comunas del RM cargadas`);
        }
        return;
      }
    } catch (err) { toast('❌ ' + err.message); }
    finally { setLoading(false); }
  }, [runSeed]);

  useEffect(() => { loadZones(true); }, [loadZones]);

  // ── Init map ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([-33.45, -70.65], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(map);
    mapInst.current = map;
    setTimeout(() => map.invalidateSize(), 120);
  }, []);

  // ── Render zones ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;
    if (layerGrp.current) { map.removeLayer(layerGrp.current); layerGrp.current = null; }
    if (!zones.length) return;

    layerGrp.current = L.layerGroup();
    const ordered = [
      ...zones.filter(z => z.source === 'commune'),
      ...zones.filter(z => z.source === 'custom')
    ];

    ordered.forEach(z => {
      const latlngs  = z.polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
      const isCommune = z.source === 'commune';

      const poly = L.polygon(latlngs, {
        color:       isCommune ? '#ffffff' : z.color || '#5c35cc',
        fillColor:   isCommune ? tierColor(z.price) : z.color || '#5c35cc',
        fillOpacity: isCommune ? 0.50 : 0.28,
        weight:      isCommune ? 1.5 : 2.5,
        opacity:     isCommune ? 0.85 : 1,
        dashArray:   isCommune ? null : '9,6'
      });

      const priceStr = `$${Number(z.price).toLocaleString('es-CL')}`;
      poly.bindTooltip(
        `<div style="font-family:'Space Grotesk',sans-serif;font-size:13px;line-height:1.5">
          ${isCommune ? '' : '<b style="font-size:10px;color:#5c35cc">ZONA CUSTOM · </b>'}
          <b>${z.name}</b><br>
          <span style="font-weight:800;color:${isCommune ? tierColor(z.price) : z.color || '#5c35cc'}">${priceStr}</span>
        </div>`,
        { sticky: true }
      );

      poly.on('mouseover', () => {
        if (!dmRef.current && !rmRef.current) poly.setStyle({ fillOpacity: isCommune ? 0.78 : 0.50 });
      });
      poly.on('mouseout', () => {
        if (!dmRef.current && !rmRef.current) poly.setStyle({ fillOpacity: isCommune ? 0.50 : 0.28 });
      });
      poly.on('click', e => {
        if (dmRef.current) { addPt(e.latlng); return; }
        if (rmRef.current) return;
        setPanel({ zone: z });
        setEditName(z.name);
        setEditPrice(String(z.price));
      });
      poly.on('dblclick', e => {
        if (dmRef.current) { L.DomEvent.stop(e); finalizeRef.current?.(); }
      });

      poly.addTo(layerGrp.current);
    });

    layerGrp.current.addTo(map);
  }, [zones]);

  // ── Draw ──────────────────────────────────────────────────────────────────────
  const addPt = useCallback((latlng) => {
    const map = mapInst.current;
    if (!map) return;
    ds.current.pts.push([latlng.lat, latlng.lng]);
    const mk = L.circleMarker([latlng.lat, latlng.lng], {
      radius: 6, color: '#5c35cc', fillColor: '#fff', fillOpacity: 1, weight: 2.5
    }).addTo(map);
    ds.current.mks.push(mk);
    if (ds.current.ln) map.removeLayer(ds.current.ln);
    const pts = ds.current.pts;
    if (pts.length > 1)
      ds.current.ln = L.polyline([...pts, pts[0]], {
        color: '#5c35cc', weight: 2.5, dashArray: '7,6', opacity: 0.85
      }).addTo(map);
    setDrawCount(pts.length);
  }, []);

  const clearDraw = useCallback(() => {
    const map = mapInst.current;
    if (map) {
      ds.current.mks.forEach(m => map.removeLayer(m));
      if (ds.current.ln) map.removeLayer(ds.current.ln);
    }
    ds.current = { pts: [], mks: [], ln: null };
    setDrawCount(0);
  }, []);

  const finalize = useCallback(() => {
    const pts = [...ds.current.pts];
    clearDraw();
    if (pts.length < 3) { toast('⚠ Necesitas al menos 3 puntos'); return; }
    setNewModal({ latlngs: pts });
    setNewName(''); setNewPrice(''); setNewColor(CUSTOM_COLORS[0]);
    setDrawMode(false);
  }, [clearDraw]);

  useEffect(() => { finalizeRef.current = finalize; }, [finalize]);

  useEffect(() => {
    const map = mapInst.current;
    if (!map || !drawMode) return;
    map.doubleClickZoom.disable();
    map.getContainer().style.cursor = 'crosshair';
    const onClick    = e => { L.DomEvent.stop(e); addPt(e.latlng); };
    const onDblClick = e => { L.DomEvent.stop(e); finalize(); };
    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    return () => {
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = '';
      map.off('click', onClick);
      map.off('dblclick', onDblClick);
    };
  }, [drawMode, addPt, finalize]);

  // ── Reshape ───────────────────────────────────────────────────────────────────
  const clearReshape = useCallback(() => {
    const map = mapInst.current;
    if (map) {
      reshapeMarkersRef.current.forEach(mk => map.removeLayer(mk));
      if (reshapePolyRef.current) map.removeLayer(reshapePolyRef.current);
    }
    reshapeMarkersRef.current = [];
    reshapePolyRef.current = null;
    reshapePtsRef.current = [];
  }, []);

  const enterReshape = useCallback((zone) => {
    const map = mapInst.current;
    if (!map) return;
    clearReshape(); clearDraw();
    setDrawMode(false); setPanel(null);

    const latlngs = zone.polygon.coordinates[0].slice(0, -1).map(([lng, lat]) => [lat, lng]);
    reshapePtsRef.current = [...latlngs];

    reshapePolyRef.current = L.polygon(latlngs, {
      color: '#5c35cc', fillColor: '#5c35cc', fillOpacity: 0.18, weight: 3, dashArray: '8,5'
    }).addTo(map);

    const icon = makeVertexIcon();
    latlngs.forEach((pt, idx) => {
      const mk = L.marker(pt, { draggable: true, icon, zIndexOffset: 1000 }).addTo(map);
      mk.on('drag', () => {
        const ll = mk.getLatLng();
        reshapePtsRef.current[idx] = [ll.lat, ll.lng];
        reshapePolyRef.current?.setLatLngs([...reshapePtsRef.current]);
      });
      reshapeMarkersRef.current.push(mk);
    });

    setReshapeZone(zone);
    setReshapeMode(true);
    map.fitBounds(reshapePolyRef.current.getBounds(), { padding: [50, 50], maxZoom: 14 });
  }, [clearReshape, clearDraw]);

  const cancelReshape = useCallback(() => {
    clearReshape(); setReshapeMode(false); setReshapeZone(null);
  }, [clearReshape]);

  const saveReshape = async () => {
    if (!reshapeZone) return;
    setSavingShape(true);
    try {
      const coords = reshapePtsRef.current.map(([lat, lng]) => [lng, lat]);
      coords.push(coords[0]);
      const updated = await api.updateZone(reshapeZone._id, {
        polygon: { type: 'Polygon', coordinates: [coords] }
      });
      setZones(prev => prev.map(z => z._id === updated._id ? { ...z, ...updated } : z));
      clearReshape(); setReshapeMode(false); setReshapeZone(null);
      toast(`✅ Forma de "${updated.name}" guardada`);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSavingShape(false); }
  };

  // ── Reseed ────────────────────────────────────────────────────────────────────
  const handleReseed = async () => {
    if (!confirm('¿Eliminar todas las comunas y recargarlas?')) return;
    setSeeding(true);
    try {
      setSeedStep('Eliminando comunas…');
      await api.deleteAllCommunes();
      const ok = await runSeed(false);
      if (ok) { await loadZones(); toast('✅ Comunas recargadas'); }
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSeeding(false); setSeedStep(''); }
  };

  // ── Save zone price ───────────────────────────────────────────────────────────
  const saveZonePrice = async () => {
    if (!panel) return;
    const price = Number(editPrice);
    if (!price || isNaN(price)) return toast('⚠ Precio inválido');
    setSavingZone(true);
    try {
      const updated = await api.updateZone(panel.zone._id, { name: editName, price });
      setZones(prev => prev.map(z => z._id === updated._id ? { ...z, ...updated } : z));
      if (panel.zone.source === 'commune')
        await api.upsertPrice({ commune: editName, price }).catch(() => {});
      setPanel(null);
      toast(`✅ ${editName}: $${price.toLocaleString('es-CL')}`);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSavingZone(false); }
  };

  const deleteZone = async (zone) => {
    if (!confirm(`¿Eliminar "${zone.name}"?`)) return;
    try {
      await api.deleteZone(zone._id);
      setZones(prev => prev.filter(z => z._id !== zone._id));
      setPanel(null);
      toast('🗑️ Eliminada');
    } catch (err) { toast('❌ ' + err.message); }
  };

  // ── Save drawn zone ───────────────────────────────────────────────────────────
  const saveNewZone = async () => {
    if (!newModal) return;
    if (!newName.trim()) return toast('⚠ Escribe el nombre');
    const price = Number(newPrice);
    if (!price || isNaN(price)) return toast('⚠ Precio inválido');
    setSavingNew(true);
    try {
      const coords = newModal.latlngs.map(([lat, lng]) => [lng, lat]);
      coords.push(coords[0]);
      const zone = await api.createZone({
        name: newName.trim(), price, color: newColor, source: 'custom',
        polygon: { type: 'Polygon', coordinates: [coords] }
      });
      setZones(prev => [...prev, zone]);
      setNewModal(null);
      toast(`✅ Zona "${zone.name}" creada`);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSavingNew(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const isBusy = loading || seeding;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', minHeight: 44 }}>

        {isBusy ? (
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
            ⏳ {seedStep || 'Cargando…'}
          </span>

        ) : reshapeMode ? (
          <>
            <button onClick={cancelReshape}
              style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid #cc224430', background: '#cc224408', color: '#cc2244', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✕ Cancelar
            </button>
            <button onClick={saveReshape} disabled={savingShape}
              style={{ padding: '7px 13px', borderRadius: 20, border: 'none', background: savingShape ? 'var(--border)' : '#5c35cc', color: '#fff', fontSize: 12, fontWeight: 700, cursor: savingShape ? 'not-allowed' : 'pointer' }}>
              {savingShape ? '⏳…' : '✅ Guardar forma'}
            </button>
            <span style={{ fontSize: 11, color: '#5c35cc', fontWeight: 600 }}>
              Arrastra los puntos para ajustar · {reshapeMarkersRef.current.length} vértices
              {reshapeZone && <> — <b>{reshapeZone.name}</b></>}
            </span>

          </>
        ) : drawMode ? (
          <>
            <button onClick={() => { clearDraw(); setDrawMode(false); }}
              style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid #cc224430', background: '#cc224408', color: '#cc2244', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✕ Cancelar
            </button>
            <button onClick={finalize} disabled={drawCount < 3}
              style={{ padding: '7px 13px', borderRadius: 20, border: 'none', background: drawCount >= 3 ? '#5c35cc' : 'var(--card2)', color: drawCount >= 3 ? '#fff' : 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: drawCount >= 3 ? 'pointer' : 'not-allowed' }}>
              ✓ Cerrar zona {drawCount > 0 ? `(${drawCount} puntos)` : ''}
            </button>
            <span style={{ fontSize: 11, color: '#5c35cc', fontWeight: 600 }}>
              Toca el mapa para agregar vértices · doble-toque para cerrar
            </span>

          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
              {communeCount} comunas · {customCount} sub-zona{customCount !== 1 ? 's' : ''}
            </span>
            <button onClick={() => { setPanel(null); setDrawMode(true); }}
              style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid #5c35cc30', background: '#5c35cc12', color: '#5c35cc', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✏️ Dibujar sub-zona
            </button>
            <button onClick={handleReseed} disabled={seeding}
              style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              🔄 Recargar
            </button>
          </>
        )}

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {TIERS.map(t => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color }} />
              <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700 }}>{t.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, border: '2px dashed #5c35cc', background: '#5c35cc28' }} />
            <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700 }}>Sub-zona</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ flex: 1, background: '#e8e8e0' }} />

      {/* Zone panel */}
      {panel && !drawMode && !reshapeMode && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 900,
          background: '#fff', borderRadius: '18px 18px 0 0',
          borderTop: '1px solid var(--border)',
          padding: '16px 16px calc(18px + env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 28px #00000018'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {panel.zone.source === 'custom' &&
                  <span style={{ width: 13, height: 13, borderRadius: 3, background: panel.zone.color, display: 'inline-block', marginRight: 7, verticalAlign: 'middle' }} />
                }
                {panel.zone.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {panel.zone.source === 'commune' ? '🗺 Comuna del RM' : '✏️ Sub-zona personalizada'}
                {' · '}<b style={{ color: panel.zone.source === 'commune' ? tierColor(panel.zone.price) : panel.zone.color }}>
                  ${Number(panel.zone.price).toLocaleString('es-CL')}
                </b>
              </div>
            </div>
            <button onClick={() => setPanel(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => enterReshape(panel.zone)}
              style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid #5c35cc30', background: '#5c35cc0c', color: '#5c35cc', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✏️ Editar forma
            </button>
            <button onClick={() => { setPanel(null); setDrawMode(true); }}
              style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid #f57c0030', background: '#f57c000c', color: '#f57c00', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✂️ Sub-dividir
            </button>
          </div>

          {panel.zone.source === 'custom' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, letterSpacing: 1 }}>NOMBRE</div>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={INP} />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, letterSpacing: 1 }}>PRECIO CLP</div>
            <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={INP} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: panel.zone.source === 'custom' ? '1fr 1fr' : '1fr', gap: 10 }}>
            <button onClick={saveZonePrice} disabled={savingZone} style={{
              padding: 13, borderRadius: 12, border: 'none',
              background: savingZone ? 'var(--border)' : 'var(--accent)', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: savingZone ? 'not-allowed' : 'pointer'
            }}>
              {savingZone ? '⏳…' : `✅ Guardar $${Number(editPrice || 0).toLocaleString('es-CL')}`}
            </button>
            {panel.zone.source === 'custom' && (
              <button onClick={() => deleteZone(panel.zone)} style={{
                padding: 13, borderRadius: 12, border: '1px solid #cc224430',
                background: 'none', color: '#cc2244', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}>
                🗑️ Eliminar
              </button>
            )}
          </div>
        </div>
      )}

      {/* New zone modal */}
      {newModal && (
        <div style={{ position: 'absolute', inset: 0, background: '#0007', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '18px 18px 0 0', padding: '20px 16px calc(22px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 28px #00000025' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>✏️ Nueva sub-zona</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              {newModal.latlngs.length} vértices · Precio de esta zona tiene <b>prioridad</b> sobre la comuna
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, letterSpacing: 1 }}>NOMBRE</div>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Ej: Maipú Norte, Las Condes Oriente…"
              style={{ ...INP, marginBottom: 12 }} autoFocus />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, letterSpacing: 1 }}>PRECIO CLP</div>
                <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={INP} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, letterSpacing: 1 }}>COLOR</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {CUSTOM_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)} style={{
                      width: 26, height: 26, borderRadius: '50%',
                      border: newColor === c ? '3px solid #111' : '2px solid transparent',
                      background: c, cursor: 'pointer', padding: 0
                    }} />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setNewModal(null)} style={{ padding: 13, borderRadius: 12, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveNewZone} disabled={savingNew} style={{ padding: 13, borderRadius: 12, border: 'none', background: savingNew ? 'var(--border)' : newColor, color: '#fff', fontSize: 13, fontWeight: 700, cursor: savingNew ? 'not-allowed' : 'pointer' }}>
                {savingNew ? '⏳…' : '✅ Crear zona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
