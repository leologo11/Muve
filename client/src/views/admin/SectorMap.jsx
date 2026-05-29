import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMaps, geoJsonToLatLngs, polygonToGeoJson, polygonBounds } from '../../utils/googleMaps.js';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';
import ImportPricesModal from './ImportPricesModal.jsx';

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

export default function SectorMap() {
  const mapRef      = useRef(null);
  const tooltipRef  = useRef(null);
  const gmRef       = useRef(null);
  const mapInst     = useRef(null);
  const polyLayersRef    = useRef([]);  // { poly: gm.Polygon, zoneId }[]
  const drawVerticesRef  = useRef([]);  // gm.Marker[] for draw mode vertices
  const drawPolylineRef  = useRef(null);
  const drawPointsRef    = useRef([]);  // [{lat,lng}]
  const reshapePolyRef   = useRef(null);
  const dmRef       = useRef(false);
  const rmRef       = useRef(false);
  const didAutoSeed = useRef(false);
  const finalizeRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
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
  const [editTiers, setEditTiers]   = useState([
    { minQty: 1, price: '' }, { minQty: 4, price: '' }, { minQty: 8, price: '' },
  ]);
  const [savingZone, setSavingZone] = useState(false);

  const [tierInputMode, setTierInputMode] = useState('auto');
  const [autoDiscMode, setAutoDiscMode]   = useState('flat');
  const [autoD2, setAutoD2]               = useState('');
  const [autoD3, setAutoD3]               = useState('');
  const [panelTemplates, setPanelTemplates] = useState([]);

  const [newModal, setNewModal]   = useState(null);
  const [newName, setNewName]     = useState('');
  const [newPrice, setNewPrice]   = useState('');
  const [newColor, setNewColor]   = useState(CUSTOM_COLORS[0]);
  const [savingNew, setSavingNew] = useState(false);

  const [showSidebar, setShowSidebar]     = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarEdits, setSidebarEdits]   = useState({});
  const [savingIds, setSavingIds]         = useState({});

  const [showSaveConfig, setShowSaveConfig] = useState(false);
  const [configName, setConfigName]         = useState('');
  const [savingConfig, setSavingConfig]     = useState(false);

  const [showTariffPanel, setShowTariffPanel]   = useState(false);
  const [tariffConfigs, setTariffConfigs]       = useState([]);
  const [loadingTariffs, setLoadingTariffs]     = useState(false);
  const [editingTariff, setEditingTariff]       = useState(null);
  const [editTariffName, setEditTariffName]     = useState('');

  const [showImport, setShowImport] = useState(false);

  useEffect(() => { dmRef.current = drawMode; }, [drawMode]);
  useEffect(() => { rmRef.current = reshapeMode; }, [reshapeMode]);

  useEffect(() => {
    if (!panel || panelTemplates.length > 0) return;
    api.getTierTemplates().then(setPanelTemplates).catch(() => {});
  }, [panel]);

  const communeCount = zones.filter(z => z.source === 'commune').length;
  const customCount  = zones.filter(z => z.source === 'custom').length;

  // Seed communes
  const runSeed = useCallback(async (showToast = true) => {
    setSeeding(true);
    try {
      setSeedStep('Cargando comunas del RM…');
      let features = null;
      try { const r = await fetch(LOCAL_GEO); if (r.ok) { const d = await r.json(); features = d.features; } } catch {}
      setSeedStep('Guardando en base de datos…');
      const result = await api.seedCommunes(features);
      if (showToast) toast(`✅ ${result.created} comunas cargadas`);
      return true;
    } catch (err) { toast('❌ ' + err.message); return false; }
    finally { setSeeding(false); setSeedStep(''); }
  }, []);

  const loadZones = useCallback(async (autoSeed = false) => {
    setLoading(true);
    try {
      const data = await api.getZones();
      setZones(data);
      if (autoSeed && !didAutoSeed.current && data.filter(z => z.source === 'commune').length === 0) {
        didAutoSeed.current = true;
        setLoading(false);
        const ok = await runSeed(false);
        if (ok) { const data2 = await api.getZones(); setZones(data2); toast(`✅ ${data2.filter(z => z.source === 'commune').length} comunas del RM cargadas`); }
        return;
      }
    } catch (err) { toast('❌ ' + err.message); }
    finally { setLoading(false); }
  }, [runSeed]);

  useEffect(() => { loadZones(true); }, [loadZones]);

  // Init Google Maps
  useEffect(() => {
    loadGoogleMaps().then(gm => {
      if (!mapRef.current || mapInst.current) return;
      gmRef.current = gm;
      const map = new gm.Map(mapRef.current, {
        center: { lat: -33.45, lng: -70.65 },
        zoom: 11,
        gestureHandling: 'cooperative',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapInst.current = map;
      setMapReady(true);
      setTimeout(() => gm.event.trigger(map, 'resize'), 120);
    });
  }, []);

  useEffect(() => {
    if (mapReady && gmRef.current && mapInst.current) {
      setTimeout(() => gmRef.current.event.trigger(mapInst.current, 'resize'), 150);
    }
  }, [showSidebar, mapReady]);

  // Render zone polygons
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInst.current;
    const gm  = gmRef.current;
    if (!map || !gm) return;

    // Clear existing polygons
    polyLayersRef.current.forEach(({ poly }) => poly.setMap(null));
    polyLayersRef.current = [];
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';

    if (!zones.length) return;

    const ordered = [
      ...zones.filter(z => z.source === 'commune'),
      ...zones.filter(z => z.source === 'custom'),
    ];

    ordered.forEach(z => {
      const coords    = z.polygon?.coordinates?.[0];
      if (!coords) return;
      const path      = coords.map(([lng, lat]) => ({ lat, lng }));
      const isCommune = z.source === 'commune';
      const fillColor = isCommune ? tierColor(z.price) : (z.color || '#5c35cc');

      const poly = new gm.Polygon({
        paths: path,
        strokeColor:   isCommune ? '#ffffff' : (z.color || '#5c35cc'),
        fillColor,
        fillOpacity:   isCommune ? 0.50 : 0.28,
        strokeWeight:  isCommune ? 1.5 : 2.5,
        strokeOpacity: isCommune ? 0.85 : 1,
        strokeDasharray: isCommune ? null : '9,6',
        map,
      });

      // Tooltip content
      const hasTiers = z.tiers?.length === 3;
      const tooltipContent = `<div style="font-family:'Inter',sans-serif;font-size:13px;line-height:1.6;padding:4px 2px">
        ${isCommune ? '' : '<div style="font-size:10px;color:#5c35cc;font-weight:700">ZONA CUSTOM</div>'}
        <b>${z.name}</b><br>
        ${hasTiers
          ? z.tiers.map((t, i) => `<span style="font-size:11px;display:block">${i === 0 ? '1 pkg' : `≥${t.minQty} pkgs`}: <b style="color:${isCommune ? tierColor(t.price) : (z.color || '#5c35cc')}">$${Number(t.price).toLocaleString('es-CL')}</b></span>`).join('')
          : `<span style="font-weight:800;color:${isCommune ? tierColor(z.price) : (z.color || '#5c35cc')}">$${Number(z.price).toLocaleString('es-CL')}</span>`
        }
      </div>`;

      // Hover: show tooltip, highlight
      poly.addListener('mouseover', () => {
        if (!dmRef.current && !rmRef.current) poly.setOptions({ fillOpacity: isCommune ? 0.78 : 0.50 });
      });
      poly.addListener('mousemove', e => {
        if (!tooltipRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        tooltipRef.current.style.display = 'block';
        tooltipRef.current.style.left = (e.domEvent.clientX - rect.left + 14) + 'px';
        tooltipRef.current.style.top  = (e.domEvent.clientY - rect.top  - 10) + 'px';
        tooltipRef.current.innerHTML   = tooltipContent;
      });
      poly.addListener('mouseout', () => {
        if (!dmRef.current && !rmRef.current) poly.setOptions({ fillOpacity: isCommune ? 0.50 : 0.28 });
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
      });

      poly.addListener('click', e => {
        if (dmRef.current) { addPt(e.latLng); return; }
        if (rmRef.current) return;
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        setPanel({ zone: z });
        setEditName(z.name);
        setEditPrice(String(z.price));
        initEditTiers(z);
      });
      poly.addListener('dblclick', e => {
        if (dmRef.current) { gm.event.trigger(map, 'click', e); finalizeRef.current?.(); }
      });

      polyLayersRef.current.push({ poly, zoneId: z._id });
    });
  }, [mapReady, zones]);

  // Draw mode: click-by-click vertex addition
  const addPt = useCallback((latLng) => {
    const map = mapInst.current;
    const gm  = gmRef.current;
    if (!map || !gm) return;

    const pt = { lat: latLng.lat(), lng: latLng.lng() };
    drawPointsRef.current.push(pt);

    const mk = new gm.Marker({
      position: pt,
      icon: {
        path: gm.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: '#fff',
        fillOpacity: 1,
        strokeColor: '#5c35cc',
        strokeWeight: 2.5,
      },
      map,
      zIndex: 20,
    });
    drawVerticesRef.current.push(mk);

    // Update preview polyline
    if (drawPolylineRef.current) drawPolylineRef.current.setMap(null);
    const pts = drawPointsRef.current;
    if (pts.length > 1) {
      drawPolylineRef.current = new gm.Polyline({
        path: [...pts, pts[0]],
        strokeColor: '#5c35cc', strokeWeight: 2.5, strokeOpacity: 0.85,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3, strokeColor: '#5c35cc' }, offset: '0', repeat: '14px' }],
        map,
      });
    }
    setDrawCount(pts.length);
  }, []);

  const clearDraw = useCallback(() => {
    const map = mapInst.current;
    drawVerticesRef.current.forEach(m => m.setMap(null));
    drawVerticesRef.current = [];
    if (drawPolylineRef.current) { drawPolylineRef.current.setMap(null); drawPolylineRef.current = null; }
    drawPointsRef.current = [];
    setDrawCount(0);
  }, []);

  const finalize = useCallback(() => {
    const pts = [...drawPointsRef.current];
    clearDraw();
    if (pts.length < 3) { toast('⚠ Necesitas al menos 3 puntos'); return; }
    setNewModal({ latlngs: pts.map(p => [p.lat, p.lng]) });
    setNewName(''); setNewPrice(''); setNewColor(CUSTOM_COLORS[0]);
    setDrawMode(false);
  }, [clearDraw]);

  useEffect(() => { finalizeRef.current = finalize; }, [finalize]);

  // Attach/detach draw click handler
  useEffect(() => {
    const map = mapInst.current;
    const gm  = gmRef.current;
    if (!map || !gm || !mapReady) return;
    if (!drawMode) return;

    map.setOptions({ draggableCursor: 'crosshair', disableDoubleClickZoom: true });
    const onClickListener   = map.addListener('click',    e => { e.stop?.(); addPt(e.latLng); });
    const onDblClickListener = map.addListener('dblclick', e => { e.stop?.(); finalize(); });
    return () => {
      gm.event.removeListener(onClickListener);
      gm.event.removeListener(onDblClickListener);
      map.setOptions({ draggableCursor: null, disableDoubleClickZoom: false });
    };
  }, [drawMode, mapReady, addPt, finalize]);

  // Reshape: use Google Maps editable polygon
  const enterReshape = useCallback((zone) => {
    const map = mapInst.current;
    const gm  = gmRef.current;
    if (!map || !gm) return;
    clearDraw(); setDrawMode(false); setPanel(null);

    if (reshapePolyRef.current) { reshapePolyRef.current.setMap(null); reshapePolyRef.current = null; }

    const path = zone.polygon.coordinates[0].slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
    reshapePolyRef.current = new gm.Polygon({
      paths: path,
      editable: true,
      strokeColor: '#5c35cc', fillColor: '#5c35cc', fillOpacity: 0.18, strokeWeight: 3,
      map,
    });

    setReshapeZone(zone);
    setReshapeMode(true);
    const bounds = new gm.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    map.fitBounds(bounds, 50);
  }, [clearDraw]);

  const cancelReshape = useCallback(() => {
    if (reshapePolyRef.current) { reshapePolyRef.current.setMap(null); reshapePolyRef.current = null; }
    setReshapeMode(false); setReshapeZone(null);
  }, []);

  const saveReshape = async () => {
    if (!reshapeZone || !reshapePolyRef.current) return;
    setSavingShape(true);
    try {
      const arr    = reshapePolyRef.current.getPath().getArray();
      const coords = arr.map(ll => [ll.lng(), ll.lat()]);
      coords.push(coords[0]);
      const updated = await api.updateZone(reshapeZone._id, { polygon: { type: 'Polygon', coordinates: [coords] } });
      setZones(prev => prev.map(z => z._id === updated._id ? { ...z, ...updated } : z));
      if (reshapePolyRef.current) { reshapePolyRef.current.setMap(null); reshapePolyRef.current = null; }
      setReshapeMode(false); setReshapeZone(null);
      toast(`✅ Forma de "${updated.name}" guardada`);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSavingShape(false); }
  };

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

  const initEditTiers = (z) => {
    const base = z.price || 0;
    const defaults = [{ minQty: 1, price: base }, { minQty: 4, price: base }, { minQty: 8, price: base }];
    const tiers = z.tiers?.length === 3 ? z.tiers.map(t => ({ minQty: t.minQty, price: t.price })) : defaults;
    setEditTiers(tiers);
    const hasDistinct = z.tiers?.length === 3 && (z.tiers[1].price !== z.tiers[0].price || z.tiers[2].price !== z.tiers[0].price);
    setTierInputMode(hasDistinct ? 'manual' : 'auto');
    setAutoD2(''); setAutoD3('');
  };

  const calcAuto = (base, d, mode) =>
    Math.max(0, mode === 'flat' ? base - d : Math.round(base * (1 - d / 100)));

  const saveZonePrice = async () => {
    if (!panel) return;
    let tiers;
    if (tierInputMode === 'auto') {
      const base = Number(editTiers[0]?.price) || 0;
      const d2   = Number(autoD2) || 0;
      const d3   = Number(autoD3) || 0;
      if (!base) return toast('⚠ El precio base es obligatorio');
      tiers = [
        { minQty: 1,                            price: base },
        { minQty: Number(editTiers[1]?.minQty), price: calcAuto(base, d2, autoDiscMode) },
        { minQty: Number(editTiers[2]?.minQty), price: calcAuto(base, d3, autoDiscMode) },
      ];
    } else {
      tiers = editTiers.map(t => ({ minQty: Number(t.minQty), price: Number(t.price) }));
    }
    if (tiers.some(t => !t.price || isNaN(t.price) || t.price <= 0)) return toast('⚠ Todos los precios deben ser válidos');
    if (tiers[1].minQty <= 1 || tiers[2].minQty <= tiers[1].minQty) return toast('⚠ Los tramos deben tener cantidades crecientes');
    const price = tiers[0].price;
    setSavingZone(true);
    try {
      const updated = await api.updateZone(panel.zone._id, { name: editName, price, tiers });
      setZones(prev => prev.map(z => z._id === updated._id ? { ...z, ...updated } : z));
      if (panel.zone.source === 'commune') await api.upsertPrice({ commune: editName, price }).catch(() => {});
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

  const saveSidebarPrice = async (zone) => {
    const price = Number(sidebarEdits[zone._id]);
    if (!price || isNaN(price)) return;
    setSavingIds(s => ({ ...s, [zone._id]: true }));
    try {
      const updated = await api.updateZone(zone._id, { price });
      setZones(prev => prev.map(z => z._id === updated._id ? { ...z, price: updated.price } : z));
      setSidebarEdits(s => { const n = { ...s }; delete n[zone._id]; return n; });
      if (zone.source === 'commune') await api.upsertPrice({ commune: zone.name, price }).catch(() => {});
      toast(`✅ ${zone.name}: $${price.toLocaleString('es-CL')}`);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSavingIds(s => { const n = { ...s }; delete n[zone._id]; return n; }); }
  };

  const openTariffPanel = async () => {
    setShowTariffPanel(true); setLoadingTariffs(true);
    try { setTariffConfigs(await api.getTariffs()); }
    catch (err) { toast('❌ ' + err.message); }
    finally { setLoadingTariffs(false); }
  };

  const deleteTariffConfig = async (id) => {
    if (!confirm('¿Eliminar esta configuración de precios?')) return;
    try { await api.deleteTariff(id); setTariffConfigs(prev => prev.filter(t => t._id !== id)); toast('🗑️ Eliminada'); }
    catch (err) { toast('❌ ' + err.message); }
  };

  const saveTariffName = async (id) => {
    if (!editTariffName.trim()) return;
    try {
      const updated = await api.updateTariff(id, { name: editTariffName.trim() });
      setTariffConfigs(prev => prev.map(t => t._id === id ? { ...t, name: updated.name } : t));
      setEditingTariff(null);
      toast('✅ Nombre actualizado');
    } catch (err) { toast('❌ ' + err.message); }
  };

  const saveConfig = async () => {
    if (!configName.trim()) return toast('⚠ Escribe el nombre');
    setSavingConfig(true);
    try {
      const items = zones.map(z => ({ commune: z.name, price: z.price || 0 }));
      const prices = items.map(i => i.price).filter(Boolean);
      const defaultPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 3500;
      await api.createTariff({ name: configName.trim(), defaultPrice, items });
      setConfigName(''); setShowSaveConfig(false);
      toast(`✅ Configuración "${configName.trim()}" guardada`);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSavingConfig(false); }
  };

  const saveNewZone = async () => {
    if (!newModal) return;
    if (!newName.trim()) return toast('⚠ Escribe el nombre');
    const price = Number(newPrice);
    if (!price || isNaN(price)) return toast('⚠ Precio inválido');
    setSavingNew(true);
    try {
      const coords = newModal.latlngs.map(([lat, lng]) => [lng, lat]);
      coords.push(coords[0]);
      const zone = await api.createZone({ name: newName.trim(), price, color: newColor, source: 'custom', polygon: { type: 'Polygon', coordinates: [coords] } });
      setZones(prev => [...prev, zone]);
      setNewModal(null);
      toast(`✅ Zona "${zone.name}" creada`);
    } catch (err) { toast('❌ ' + err.message); }
    finally { setSavingNew(false); }
  };

  const isBusy = loading || seeding;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', minHeight: 44 }}>
        {isBusy ? (
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>⏳ {seedStep || 'Cargando…'}</span>
        ) : reshapeMode ? (
          <>
            <button onClick={cancelReshape} style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid #cc224430', background: '#cc224408', color: '#cc2244', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕ Cancelar</button>
            <button onClick={saveReshape} disabled={savingShape} style={{ padding: '7px 13px', borderRadius: 20, border: 'none', background: savingShape ? 'var(--border)' : '#5c35cc', color: '#fff', fontSize: 12, fontWeight: 700, cursor: savingShape ? 'not-allowed' : 'pointer' }}>
              {savingShape ? '⏳…' : '✅ Guardar forma'}
            </button>
            <span style={{ fontSize: 11, color: '#5c35cc', fontWeight: 600 }}>
              Arrastra los vértices para ajustar{reshapeZone && <> — <b>{reshapeZone.name}</b></>}
            </span>
          </>
        ) : drawMode ? (
          <>
            <button onClick={() => { clearDraw(); setDrawMode(false); }} style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid #cc224430', background: '#cc224408', color: '#cc2244', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕ Cancelar</button>
            <button onClick={finalize} disabled={drawCount < 3} style={{ padding: '7px 13px', borderRadius: 20, border: 'none', background: drawCount >= 3 ? '#5c35cc' : 'var(--card2)', color: drawCount >= 3 ? '#fff' : 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: drawCount >= 3 ? 'pointer' : 'not-allowed' }}>
              ✓ Cerrar zona {drawCount > 0 ? `(${drawCount} puntos)` : ''}
            </button>
            <span style={{ fontSize: 11, color: '#5c35cc', fontWeight: 600 }}>Toca el mapa para agregar vértices · doble-toque para cerrar</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{communeCount} comunas · {customCount} sub-zona{customCount !== 1 ? 's' : ''}</span>
            <button onClick={() => { setPanel(null); setDrawMode(true); }} style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid #5c35cc30', background: '#5c35cc12', color: '#5c35cc', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✏️ Dibujar sub-zona</button>
            <button onClick={handleReseed} disabled={seeding} style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🔄 Recargar</button>
            <button onClick={() => setShowImport(true)} style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid #22863a40', background: '#22863a10', color: '#22863a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📥 Importar precios</button>
            <button onClick={openTariffPanel} style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid #5c35cc30', background: '#5c35cc0c', color: '#5c35cc', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📋 Configs</button>
            {!showSaveConfig ? (
              <button onClick={() => setShowSaveConfig(true)} style={{ padding: '7px 13px', borderRadius: 20, border: '1px solid #0052FF30', background: '#0052FF10', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>💾 Guardar config</button>
            ) : (
              <>
                <input value={configName} onChange={e => setConfigName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveConfig(); if (e.key === 'Escape') { setShowSaveConfig(false); setConfigName(''); } }}
                  placeholder="Nombre de la configuración…" autoFocus
                  style={{ padding: '6px 10px', borderRadius: 20, border: '1px solid var(--accent)', fontSize: 12, outline: 'none', width: 190, background: '#fff' }}
                />
                <button onClick={saveConfig} disabled={savingConfig || !configName.trim()} style={{ padding: '7px 12px', borderRadius: 20, border: 'none', background: savingConfig ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: savingConfig ? 'not-allowed' : 'pointer' }}>{savingConfig ? '⏳' : '✓ Guardar'}</button>
                <button onClick={() => { setShowSaveConfig(false); setConfigName(''); }} style={{ padding: '7px 11px', borderRadius: 20, border: '1px solid #cc224430', background: 'none', color: '#cc2244', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕</button>
              </>
            )}
          </>
        )}

        {/* Legend + sidebar toggle */}
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
          <button onClick={() => setShowSidebar(s => !s)} style={{ padding: '4px 10px', borderRadius: 14, border: '1px solid var(--border)', background: showSidebar ? 'var(--accent)' : 'var(--card2)', color: showSidebar ? '#fff' : 'var(--muted)', fontSize: 10, fontWeight: 700, cursor: 'pointer', marginLeft: 4 }}>
            {showSidebar ? '◀ Lista' : '▶ Lista'}
          </button>
        </div>
      </div>

      {/* Map + Sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          {/* Floating tooltip */}
          <div
            ref={tooltipRef}
            style={{
              display: 'none', position: 'absolute', zIndex: 999,
              background: 'white', border: '1px solid #e2e8f0', borderRadius: 10,
              padding: '6px 10px', boxShadow: '0 4px 16px rgba(0,0,0,.15)',
              pointerEvents: 'none', maxWidth: 220, fontSize: 13,
            }}
          />
        </div>

        {showSidebar && (
          <div style={{ width: 240, flexShrink: 0, background: '#fff', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <input value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)} placeholder="🔍 Buscar comuna…"
                style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 9px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {zones
                .filter(z => !sidebarSearch || z.name.toLowerCase().includes(sidebarSearch.toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                .map(z => {
                  const edited   = sidebarEdits[z._id] != null;
                  const curPrice = edited ? sidebarEdits[z._id] : String(z.price ?? '');
                  const color    = z.source === 'commune' ? tierColor(z.price) : (z.color || '#5c35cc');
                  const saving   = savingIds[z._id];
                  return (
                    <div key={z._id} style={{ padding: '5px 10px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={z.name}
                        onClick={() => { setPanel({ zone: z }); setEditName(z.name); setEditPrice(String(z.price)); initEditTiers(z); }}>
                        {z.name}
                      </span>
                      <input type="number" value={curPrice}
                        onChange={e => setSidebarEdits(s => ({ ...s, [z._id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && saveSidebarPrice(z)}
                        style={{ width: 68, background: edited ? '#fff8f0' : 'var(--card2)', border: `1px solid ${edited ? '#d4650a50' : 'var(--border)'}`, borderRadius: 7, padding: '4px 6px', fontSize: 11, fontWeight: edited ? 700 : 400, outline: 'none', color: 'var(--text)', textAlign: 'right' }}
                      />
                      {edited && (
                        <button onClick={() => saveSidebarPrice(z)} disabled={saving}
                          style={{ padding: '3px 7px', borderRadius: 7, border: 'none', background: saving ? 'var(--border)' : '#0052FF', color: '#fff', fontSize: 10, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                          {saving ? '…' : '✓'}
                        </button>
                      )}
                    </div>
                  );
                })
              }
              {zones.filter(z => !sidebarSearch || z.name.toLowerCase().includes(sidebarSearch.toLowerCase())).length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>Sin resultados</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Zone panel */}
      {panel && !drawMode && !reshapeMode && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 900, background: '#fff', borderRadius: '18px 18px 0 0', borderTop: '1px solid var(--border)', padding: '16px 16px calc(18px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 28px #00000018' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {panel.zone.source === 'custom' && <span style={{ width: 13, height: 13, borderRadius: 3, background: panel.zone.color, display: 'inline-block', marginRight: 7, verticalAlign: 'middle' }} />}
                {panel.zone.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {panel.zone.source === 'commune' ? '🗺 Comuna del RM' : '✏️ Sub-zona personalizada'}
                {' · '}<b style={{ color: panel.zone.source === 'commune' ? tierColor(panel.zone.price) : panel.zone.color }}>${Number(panel.zone.price).toLocaleString('es-CL')}</b>
              </div>
            </div>
            <button onClick={() => setPanel(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => enterReshape(panel.zone)} style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid #5c35cc30', background: '#5c35cc0c', color: '#5c35cc', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✏️ Editar forma</button>
            <button onClick={() => { setPanel(null); setDrawMode(true); }} style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid #f57c0030', background: '#f57c000c', color: '#f57c00', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✂️ Sub-dividir</button>
          </div>

          {panel.zone.source === 'custom' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, letterSpacing: 1 }}>NOMBRE</div>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={INP} />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1 }}>TRAMOS POR VOLUMEN</span>
              <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {[['auto', '% Auto'], ['manual', 'Manual']].map(([m, label]) => (
                  <button key={m} onClick={() => setTierInputMode(m)} style={{ padding: '4px 11px', border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: tierInputMode === m ? 'var(--accent)' : '#fff', color: tierInputMode === m ? '#fff' : 'var(--muted)' }}>{label}</button>
                ))}
              </div>
            </div>

            {tierInputMode === 'auto' ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, marginBottom: 4 }}>PRECIO BASE · T1 (1 pkg)</div>
                  <input type="number" value={editTiers[0]?.price} placeholder="0"
                    onChange={e => { setEditPrice(e.target.value); setEditTiers(prev => prev.map((t,i) => i===0 ? {...t, price: e.target.value} : t)); }}
                    style={{ ...INP, borderColor: 'var(--accent)', fontWeight: 700 }} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                    {[['flat','$ CLP'],['pct','%']].map(([m, label]) => (
                      <button key={m} onClick={() => setAutoDiscMode(m)} style={{ padding: '4px 9px', border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: autoDiscMode === m ? '#5c35cc' : '#fff', color: autoDiscMode === m ? '#fff' : 'var(--muted)' }}>{label}</button>
                    ))}
                  </div>
                  {panelTemplates.length > 0 && (
                    <select defaultValue="" onChange={e => {
                      const t = panelTemplates.find(x => x._id === e.target.value);
                      if (!t) return;
                      setAutoDiscMode(t.mode); setAutoD2(String(t.discount2)); setAutoD3(String(t.discount3));
                      setEditTiers(prev => prev.map((x,i) => i===1 ? {...x, minQty: t.qty2} : i===2 ? {...x, minQty: t.qty3} : x));
                      e.target.value = '';
                    }} style={{ flex: 1, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, outline: 'none', background: '#f4f7ff', color: 'var(--accent)', cursor: 'pointer' }}>
                      <option value="" disabled>📂 Cargar preset…</option>
                      {panelTemplates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  )}
                </div>
                {[1, 2].map(idx => {
                  const isT2  = idx === 1;
                  const d     = isT2 ? autoD2 : autoD3;
                  const setD  = isT2 ? setAutoD2 : setAutoD3;
                  const base  = Number(editTiers[0]?.price) || 0;
                  const calc  = d ? calcAuto(base, Number(d), autoDiscMode) : null;
                  const color  = isT2 ? 'var(--accent)' : '#7b1fa2';
                  const bg     = isT2 ? '#f4f7ff' : '#fdf4ff';
                  const border = isT2 ? '#0052FF30' : '#7b1fa230';
                  return (
                    <div key={idx} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '28px 60px 1fr', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color }}>T{idx+1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>≥</span>
                          <input type="number" value={editTiers[idx]?.minQty} min={2}
                            onChange={e => setEditTiers(prev => prev.map((t,i) => i===idx ? {...t, minQty: e.target.value} : t))}
                            style={{ width: '100%', padding: '5px 4px', borderRadius: 6, border: `1px solid ${border}`, fontSize: 11, outline: 'none', textAlign: 'center', background: bg }} />
                        </div>
                        <input type="number" value={d} onChange={e => setD(e.target.value)}
                          placeholder={autoDiscMode === 'flat' ? 'descuento $' : 'descuento %'}
                          style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${border}`, fontSize: 12, outline: 'none', background: bg, textAlign: 'right', width: '100%', boxSizing: 'border-box' }} />
                      </div>
                      {calc !== null && <div style={{ fontSize: 10, color, fontWeight: 700, textAlign: 'right', marginTop: 2 }}>= ${calc.toLocaleString('es-CL')} por pkg</div>}
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '4px 8px', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5 }}>CANTIDAD</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5 }}>PRECIO PKG (CLP)</span>
                </div>
                {editTiers.map((tier, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '4px 8px', alignItems: 'center', marginBottom: 8 }}>
                    {i === 0 ? (
                      <div style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, background: 'var(--card2)', color: 'var(--muted)', fontWeight: 600 }}>1 pkg</div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>≥</span>
                        <input type="number" value={tier.minQty} min={2}
                          onChange={e => setEditTiers(prev => prev.map((t, idx) => idx === i ? { ...t, minQty: e.target.value } : t))}
                          style={{ ...INP, paddingRight: 4 }} />
                      </div>
                    )}
                    <input type="number" value={tier.price} placeholder="0"
                      onChange={e => { const val = e.target.value; setEditTiers(prev => prev.map((t, idx) => idx === i ? { ...t, price: val } : t)); if (i === 0) setEditPrice(val); }}
                      style={{ ...INP, background: i===0 ? '#fff' : '#f8f9ff', borderColor: i===0 ? 'var(--accent)' : 'var(--border)', fontWeight: i===0 ? 700 : 400 }} />
                  </div>
                ))}
              </>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: panel.zone.source === 'custom' ? '1fr 1fr' : '1fr', gap: 10 }}>
            <button onClick={saveZonePrice} disabled={savingZone} style={{ padding: 13, borderRadius: 12, border: 'none', background: savingZone ? 'var(--border)' : 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: savingZone ? 'not-allowed' : 'pointer' }}>
              {savingZone ? '⏳…' : `✅ Guardar $${Number(editTiers[0]?.price || 0).toLocaleString('es-CL')}${tierInputMode === 'auto' ? ' · auto' : ''}`}
            </button>
            {panel.zone.source === 'custom' && (
              <button onClick={() => deleteZone(panel.zone)} style={{ padding: 13, borderRadius: 12, border: '1px solid #cc224430', background: 'none', color: '#cc2244', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🗑️ Eliminar</button>
            )}
          </div>
        </div>
      )}

      {/* Tariff configs panel */}
      {showTariffPanel && (
        <div style={{ position: 'absolute', inset: 0, background: '#0004', zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowTariffPanel(false); setEditingTariff(null); } }}>
          <div style={{ background: '#fff', borderRadius: '18px 18px 0 0', padding: '18px 16px calc(20px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 28px #00000020', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>📋 Configuraciones de precios</div>
              <button onClick={() => { setShowTariffPanel(false); setEditingTariff(null); }} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingTariffs ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>Cargando…</div>
              ) : tariffConfigs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
                  <p style={{ fontSize: 13 }}>No hay configuraciones guardadas.<br />Usa "💾 Guardar config" para crear una.</p>
                </div>
              ) : tariffConfigs.map(t => (
                <div key={t._id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', marginBottom: 8 }}>
                  {editingTariff === t._id ? (
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                      <input value={editTariffName} onChange={e => setEditTariffName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveTariffName(t._id); if (e.key === 'Escape') setEditingTariff(null); }}
                        autoFocus style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--accent)', fontSize: 13, outline: 'none' }} />
                      <button onClick={() => saveTariffName(t._id)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                      <button onClick={() => setEditingTariff(null)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.items?.length || 0} comunas · Precio base: ${(t.defaultPrice || 0).toLocaleString('es-CL')}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => { setEditingTariff(t._id); setEditTariffName(t.name); }} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #0077aa30', background: '#0077aa0c', color: '#0077aa', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => deleteTariffConfig(t._id)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #cc224430', background: '#cc224408', color: '#cc2244', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🗑️</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New zone modal */}
      {newModal && (
        <div style={{ position: 'absolute', inset: 0, background: '#0007', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '18px 18px 0 0', padding: '20px 16px calc(22px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 28px #00000025' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>✏️ Nueva sub-zona</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>{newModal.latlngs.length} vértices · Precio tiene prioridad sobre la comuna</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, letterSpacing: 1 }}>NOMBRE</div>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Maipú Norte…" style={{ ...INP, marginBottom: 12 }} autoFocus />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, letterSpacing: 1 }}>PRECIO CLP</div>
                <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={INP} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, letterSpacing: 1 }}>COLOR</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {CUSTOM_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)} style={{ width: 26, height: 26, borderRadius: '50%', border: newColor === c ? '3px solid #111' : '2px solid transparent', background: c, cursor: 'pointer', padding: 0 }} />
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

      {showImport && (
        <ImportPricesModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); loadZones(); }} />
      )}
    </div>
  );
}
