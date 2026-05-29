import React, { useEffect, useRef, useState, useMemo } from 'react';
import { loadGoogleMaps } from '../../utils/googleMaps.js';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';

const SECTOR_TO_COMMUNE = {
  'chicureo': 'Colina', 'hacienda chicureo': 'Colina', 'piedra roja': 'Colina',
  'los trapenses': 'Colina', 'batuco': 'Lampa', 'valle grande': 'Lampa',
  'la dehesa': 'Lo Barnechea', 'el arrayán': 'Lo Barnechea', 'el arrayn': 'Lo Barnechea',
  'san carlos de apoquindo': 'Lo Barnechea', 'los domínicos': 'Las Condes',
  'los dominicos': 'Las Condes', 'el principal': 'Pirque',
};

const COMMUNES = [
  'Alhué','Buin','Calera de Tango','Cerrillos','Cerro Navia','Colina','Conchalí','Curacaví',
  'El Bosque','El Monte','Estación Central','Huechuraba','Independencia','Isla de Maipo',
  'La Cisterna','La Florida','La Granja','La Pintana','La Reina','Lampa','Las Condes',
  'Lo Barnechea','Lo Espejo','Lo Prado','Macul','Maipú','María Pinto','Melipilla','Ñuñoa',
  'Padre Hurtado','Paine','Peñaflor','Peñalolén','Pirque','Providencia','Pudahuel',
  'Puente Alto','Quilicura','Quinta Normal','Recoleta','Renca','San Bernardo','San Joaquín',
  'San José de Maipo','San Miguel','San Pedro','San Ramón','Santiago','Talagante','Tiltil',
  'Vitacura',
];

function pinColor(pkg) {
  if (pkg.routeStatus === 'active' && pkg.status === 'pendiente') return '#f59e0b';
  if (pkg.status === 'entregado')    return '#22c55e';
  if (pkg.status === 'no-entregado') return '#ef4444';
  return '#94a3b8';
}

function statusLabel(pkg) {
  if (pkg.routeStatus === 'active' && pkg.status === 'pendiente') return '🟡 En ruta ahora';
  if (pkg.status === 'entregado')    return '🟢 Entregado';
  if (pkg.status === 'no-entregado') return '🔴 Incidencia';
  return '⚪ Pendiente';
}

function pkgId(p) { return String(p._id || p.id || ''); }
function hasAssignedRoute(pkg) { return Boolean(pkg.routeId || pkg.routeCode || pkg.routeStatus); }
function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CL');
}
function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function pointInPolygon(point, polygon) {
  const { lat: px, lng: py } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { lat: xi, lng: yi } = polygon[i];
    const { lat: xj, lng: yj } = polygon[j];
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function popupHtml(pkg) {
  const sl = statusLabel(pkg);
  const routeInfo = pkg.routeCode
    ? `${pkg.routeCode}${pkg.routeStatus ? ` · ${pkg.routeStatus}` : ''}`
    : 'Sin ruta asignada';
  return `
    <div style="font-family:system-ui,sans-serif;min-width:190px;line-height:1.5">
      <div style="font-weight:800;font-size:13px;margin-bottom:5px;color:#0f172a">${pkg.trackingId || '—'}</div>
      ${pkg.customerName ? `<div style="font-size:12px;color:#334155;margin-bottom:3px">👤 ${pkg.customerName}</div>` : ''}
      <div style="font-size:11px;color:#64748b;margin-bottom:3px">📍 ${pkg.address || ''}${pkg.commune ? ', ' + pkg.commune : ''}</div>
      <div style="font-size:11px;color:#475569;margin-bottom:3px"><b>Empresa:</b> ${escapeHtml(pkg.companyName || 'Sin empresa')}</div>
      <div style="font-size:11px;color:#475569;margin-bottom:3px"><b>Ruta:</b> ${escapeHtml(routeInfo)}</div>
      <div style="font-size:11px;color:#475569;margin-bottom:3px"><b>Driver:</b> ${escapeHtml(pkg.driverName || 'Sin driver asignado')}</div>
      ${pkg.createdAt ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px"><b>Ingreso:</b> ${escapeHtml(fmtDate(pkg.createdAt))}</div>` : ''}
      <div style="margin-top:6px;font-size:12px;font-weight:700;color:#0f172a">${escapeHtml(sl)}</div>
      ${pkg.failReason ? `<div style="font-size:11px;color:#ef4444;margin-top:2px">${pkg.failReason}</div>` : ''}
    </div>
  `;
}

function makeCircleIcon(gm, color, selected, dimmed) {
  const size    = selected ? 18 : 14;
  const stroke  = selected ? 3 : (dimmed ? 1 : 2);
  const opacity = dimmed ? 0.45 : 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2-1}" fill="${color}" stroke="white" stroke-width="${stroke}" opacity="${opacity}"/>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new gm.Size(size, size),
    anchor: new gm.Point(size / 2, size / 2),
  };
}

const STATUS_FILTERS = [
  { val: 'todos',        label: 'Todos',        color: '#64748b' },
  { val: 'activo',       label: '🟡 Activos',    color: '#f59e0b' },
  { val: 'entregado',    label: '🟢 Entregados', color: '#22c55e' },
  { val: 'pendiente',    label: '⚪ Pendientes', color: '#94a3b8' },
  { val: 'no-entregado', label: '🔴 Incidencias',color: '#ef4444' },
];
const ROUTE_FILTERS = [
  { val: 'sin-ruta', label: '📭 Sin asignar', color: '#6366f1' },
  { val: 'con-ruta', label: '📬 Asignados',   color: '#0891b2' },
];

export default function GeneralMapView() {
  const mapRef          = useRef(null);
  const gmRef           = useRef(null);
  const mapInst         = useRef(null);
  const markersRef      = useRef([]);
  const lassoPolyRef    = useRef(null);
  const lassoModeRef    = useRef(false);
  const drawingRef      = useRef(false);
  const lassoPointsRef  = useRef([]);
  const filteredRef     = useRef([]);
  const spaceHeldRef    = useRef(false);
  const infoWindowRef   = useRef(null);

  const [mapReady,         setMapReady]         = useState(false);
  const [packages,         setPackages]         = useState([]);
  const [routes,           setRoutes]           = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [search,           setSearch]           = useState('');
  const [statusFilter,     setStatusFilter]     = useState('todos');
  const [companyFilter,    setCompanyFilter]    = useState('');
  const [driverFilter,     setDriverFilter]     = useState('');
  const [dateFrom,         setDateFrom]         = useState('');
  const [dateTo,           setDateTo]           = useState('');
  const [lassoMode,        setLassoMode]        = useState(false);
  const [selectedIds,      setSelectedIds]      = useState(new Set());
  const [showAssignPanel,  setShowAssignPanel]  = useState(false);
  const [targetRouteId,    setTargetRouteId]    = useState('');
  const [assigning,        setAssigning]        = useState(false);
  const [drivers,          setDrivers]          = useState([]);
  const [showNoGeoPanel,   setShowNoGeoPanel]   = useState(false);
  const [editingNoGeo,     setEditingNoGeo]     = useState(null);
  const [savingNoGeo,      setSavingNoGeo]      = useState(false);

  const [showCreateForm,   setShowCreateForm]   = useState(false);
  const [newRouteName,     setNewRouteName]     = useState('');
  const [newRouteDate,     setNewRouteDate]     = useState(new Date().toISOString().slice(0, 10));
  const [newRouteDriverId, setNewRouteDriverId] = useState('');
  const [newRouteStatus,   setNewRouteStatus]   = useState('active');
  const [newRouteStart,    setNewRouteStart]    = useState({ address: '', lat: null, lng: null });
  const [creating,         setCreating]         = useState(false);

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([api.getMapPackages({ from: dateFrom, to: dateTo }), api.getRoutes(), api.getUsers()])
      .then(([pkgs, rts, users]) => {
        setPackages(pkgs);
        setRoutes(rts);
        setDrivers(users.filter(u => u.role === 'driver' && u.active !== false));
      })
      .catch(err => toast('❌ ' + err.message))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  const companies = useMemo(() => {
    const s = new Set(packages.map(p => p.companyName).filter(Boolean));
    return [...s].sort();
  }, [packages]);

  const driverNames = useMemo(() => {
    const s = new Set(packages.map(p => p.driverName).filter(Boolean));
    return [...s].sort();
  }, [packages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return packages.filter(p => {
      const isActive = p.routeStatus === 'active' && p.status === 'pendiente';
      const passStatus =
        statusFilter === 'todos'        ? true
        : statusFilter === 'activo'    ? isActive
        : statusFilter === 'pendiente' ? (p.status === 'pendiente' && !isActive)
        : statusFilter === 'sin-ruta'  ? !hasAssignedRoute(p)
        : statusFilter === 'con-ruta'  ? hasAssignedRoute(p)
        : p.status === statusFilter;
      const passCompany = !companyFilter || p.companyName === companyFilter;
      const passDriver  = !driverFilter  || p.driverName  === driverFilter;
      const passSearch  = !q || [p.trackingId, p.customerName, p.address, p.commune, p.companyName, p.driverName, p.routeCode]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
      return passStatus && passCompany && passDriver && passSearch;
    });
  }, [packages, search, statusFilter, companyFilter, driverFilter]);

  filteredRef.current = filtered;

  const stats = useMemo(() => ({
    active:     packages.filter(p => p.routeStatus === 'active' && p.status === 'pendiente').length,
    delivered:  packages.filter(p => p.status === 'entregado').length,
    pending:    packages.filter(p => p.status === 'pendiente' && p.routeStatus !== 'active').length,
    incident:   packages.filter(p => p.status === 'no-entregado').length,
    unassigned: packages.filter(p => !hasAssignedRoute(p)).length,
    assigned:   packages.filter(p => hasAssignedRoute(p)).length,
  }), [packages]);

  const noGeoPackages = useMemo(() =>
    packages.filter(p => (!p.lat || !p.lng) && p.status !== 'eliminado'),
  [packages]);

  const hasActiveFilters = statusFilter !== 'todos' || companyFilter || driverFilter || dateFrom || dateTo || search;

  // Init Google Maps
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    loadGoogleMaps().then(gm => {
      if (!mapRef.current || mapInst.current) return;
      gmRef.current = gm;
      const map = new gm.Map(mapRef.current, {
        center: { lat: -33.455, lng: -70.648 },
        zoom: 11,
        gestureHandling: 'cooperative',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      infoWindowRef.current = new gm.InfoWindow();

      // Lasso: mousedown → start drawing
      map.addListener('mousedown', e => {
        if (!lassoModeRef.current || spaceHeldRef.current) return;
        drawingRef.current = true;
        map.setOptions({ draggable: false });
        lassoPointsRef.current = [{ lat: e.latLng.lat(), lng: e.latLng.lng() }];
        if (lassoPolyRef.current) { lassoPolyRef.current.setMap(null); lassoPolyRef.current = null; }
        lassoPolyRef.current = new gm.Polygon({
          paths: lassoPointsRef.current,
          strokeColor: '#0052FF', strokeOpacity: 1, strokeWeight: 2.5,
          fillColor: '#0052FF', fillOpacity: 0.08,
          map,
        });
      });

      // Lasso: mousemove → extend polygon
      map.addListener('mousemove', e => {
        if (!drawingRef.current) return;
        lassoPointsRef.current.push({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        lassoPolyRef.current?.setPath(lassoPointsRef.current);
      });

      mapInst.current = map;
      setMapReady(true);
    });
    return () => { mapInst.current = null; };
  }, []);

  // Document mouseup: finish lasso
  useEffect(() => {
    const onMouseUp = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const map = mapInst.current;
      if (map) map.setOptions({ draggable: true });
      const pts = lassoPointsRef.current;
      if (pts.length < 3) return;
      const inside = filteredRef.current.filter(pkg =>
        pkg.lat && pkg.lng && pointInPolygon({ lat: pkg.lat, lng: pkg.lng }, pts)
      );
      if (lassoPolyRef.current) { lassoPolyRef.current.setMap(null); lassoPolyRef.current = null; }
      if (inside.length === 0) {
        toast('Sin paquetes en el área seleccionada');
        return;
      }
      setSelectedIds(new Set(inside.map(pkgId)));
      setShowAssignPanel(true);
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  // Space = pan while in lasso mode
  useEffect(() => {
    const onKeyDown = e => {
      if (e.code !== 'Space' || !lassoModeRef.current || spaceHeldRef.current) return;
      e.preventDefault();
      spaceHeldRef.current = true;
      if (drawingRef.current) {
        drawingRef.current = false;
        lassoPointsRef.current = [];
        if (lassoPolyRef.current) { lassoPolyRef.current.setMap(null); lassoPolyRef.current = null; }
      }
      mapInst.current?.setOptions({ draggable: true });
      if (mapRef.current) mapRef.current.style.cursor = 'grab';
    };
    const onKeyUp = e => {
      if (e.code !== 'Space' || !lassoModeRef.current) return;
      e.preventDefault();
      spaceHeldRef.current = false;
      if (mapRef.current) mapRef.current.style.cursor = 'crosshair';
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup',   onKeyUp);
    };
  }, []);

  // Toggle lasso mode
  useEffect(() => {
    lassoModeRef.current = lassoMode;
    if (!mapRef.current) return;
    mapRef.current.style.cursor = lassoMode ? 'crosshair' : '';
    if (!lassoMode) {
      drawingRef.current = false;
      mapInst.current?.setOptions({ draggable: true });
      if (lassoPolyRef.current) { lassoPolyRef.current.setMap(null); lassoPolyRef.current = null; }
    }
  }, [lassoMode]);

  // Redraw markers
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInst.current;
    const gm  = gmRef.current;
    if (!map || !gm) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const visiblePackages = hasActiveFilters ? filtered : packages;
    const hasSelection = selectedIds.size > 0;

    visiblePackages.forEach(pkg => {
      if (!pkg.lat || !pkg.lng) return;
      const id         = pkgId(pkg);
      const isSelected = selectedIds.has(id);
      const dimmed     = hasSelection ? !isSelected : false;
      const color      = isSelected ? '#0052FF' : (dimmed ? '#94a3b8' : pinColor(pkg));
      const icon       = makeCircleIcon(gm, color, isSelected, dimmed);
      const marker     = new gm.Marker({ position: { lat: pkg.lat, lng: pkg.lng }, icon, map });
      marker.addListener('click', () => {
        infoWindowRef.current.setContent(popupHtml(pkg));
        infoWindowRef.current.open(map, marker);
      });
      markersRef.current.push(marker);
    });
  }, [mapReady, packages, filtered, selectedIds, lassoMode, hasActiveFilters]);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setShowAssignPanel(false);
    setTargetRouteId('');
    setShowCreateForm(false);
    setNewRouteName('');
    setNewRouteDriverId('');
    setNewRouteStatus('active');
    setNewRouteDate(new Date().toISOString().slice(0, 10));
    setNewRouteStart({ address: '', lat: null, lng: null });
    setLassoMode(false);
    if (lassoPolyRef.current) { lassoPolyRef.current.setMap(null); lassoPolyRef.current = null; }
  };

  const selectFilteredPackages = () => {
    const ids = filtered.map(pkgId).filter(Boolean);
    if (ids.length === 0) { toast('No hay paquetes con esos filtros'); return; }
    setSelectedIds(new Set(ids));
    setShowAssignPanel(true);
    setLassoMode(true);
  };

  const selBreakdown = useMemo(() => {
    const sel      = packages.filter(p => selectedIds.has(pkgId(p)));
    const free     = sel.filter(p => !hasAssignedRoute(p));
    const assigned = sel.filter(p => hasAssignedRoute(p));
    const inActive = assigned.filter(p => p.routeStatus === 'active');
    const rts      = [...new Set(assigned.map(p => p.routeCode).filter(Boolean))];
    return { total: sel.length, free, assigned, inActive, routes: rts };
  }, [packages, selectedIds]);

  const handleAssign = async () => {
    if (!targetRouteId || selectedIds.size === 0) return;
    if (selBreakdown.inActive.length > 0) {
      const ok = window.confirm(`⚠️ ${selBreakdown.inActive.length} paquete${selBreakdown.inActive.length !== 1 ? 's están' : ' está'} en una ruta activa.\n\n¿Confirmas?`);
      if (!ok) return;
    }
    setAssigning(true);
    try {
      await Promise.all([...selectedIds].map(id => api.updatePackage(id, { routeId: targetRouteId })));
      toast(`✅ ${selectedIds.size} paquete${selectedIds.size !== 1 ? 's' : ''} asignado${selectedIds.size !== 1 ? 's' : ''}`);
      const fresh = await api.getMapPackages();
      setPackages(fresh);
      clearSelection();
    } catch (err) { toast('❌ ' + err.message); }
    finally { setAssigning(false); }
  };

  const handleCreateAndAssign = async () => {
    const selectedPackageIds = [...selectedIds];
    if (selectedPackageIds.length === 0) { toast('⚠️ Todos los paquetes ya tienen ruta.'); return; }
    if (selBreakdown.inActive.length > 0) {
      const ok = window.confirm(`Hay ${selBreakdown.inActive.length} paquete${selBreakdown.inActive.length !== 1 ? 's' : ''} en una ruta activa. ¿Confirmas?`);
      if (!ok) return;
    }
    setCreating(true);
    try {
      const route = await api.createRoute({
        name: newRouteName.trim() || undefined, date: newRouteDate, status: newRouteStatus,
        driverId: newRouteDriverId || undefined,
        startPoint: newRouteStart.lat ? newRouteStart : undefined,
      });
      await Promise.all(selectedPackageIds.map(id => api.updatePackage(id, { routeId: route._id || route.id })));
      toast(`✅ Ruta ${route.routeCode} creada con ${selectedPackageIds.length} paquete${selectedPackageIds.length !== 1 ? 's' : ''}`);
      const [fresh, freshRoutes] = await Promise.all([api.getMapPackages(), api.getRoutes()]);
      setPackages(fresh);
      setRoutes(freshRoutes);
      clearSelection();
    } catch (err) { toast('❌ ' + err.message); }
    finally { setCreating(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ padding: '8px 12px 0' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', pointerEvents: 'none' }}>🔍</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, dirección o ID de paquete…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12, outline: 'none', background: 'var(--card2)', color: '#0f172a' }}
            />
          </div>
        </div>
        <div style={{ padding: '6px 12px 8px', display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {STATUS_FILTERS.map(({ val, label, color }) => {
            const active = statusFilter === val;
            return (
              <button key={val} onClick={() => setStatusFilter(val)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: active ? `2px solid ${color}` : '1px solid var(--border)',
                background: active ? `${color}18` : '#fff', color: active ? color : 'var(--muted)',
              }}>{label}</button>
            );
          })}
          <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
          {ROUTE_FILTERS.map(({ val, label, color }) => {
            const active = statusFilter === val;
            return (
              <button key={val} onClick={() => setStatusFilter(val)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: active ? `2px solid ${color}` : '1px solid var(--border)',
                background: active ? `${color}18` : '#fff', color: active ? color : 'var(--muted)',
              }}>{label}</button>
            );
          })}
          {companies.length > 0 && (
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={selStyle(!!companyFilter)}>
              <option value="">🏢 Empresa</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {driverNames.length > 0 && (
            <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)} style={selStyle(!!driverFilter)}>
              <option value="">🚚 Driver</option>
              {driverNames.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Desde" style={{ ...selStyle(!!dateFrom), width: 126 }} />
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   title="Hasta" style={{ ...selStyle(!!dateTo), width: 126 }} />
          <button onClick={selectFilteredPackages} disabled={filtered.length === 0} style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
            border: '1px solid #0052FF55', background: filtered.length ? '#0052FF10' : '#f1f5f9',
            color: filtered.length ? '#0052FF' : '#94a3b8', cursor: filtered.length ? 'pointer' : 'not-allowed',
          }}>Seleccionar filtrados ({filtered.length})</button>
          {hasActiveFilters && (
            <button onClick={() => { setStatusFilter('todos'); setCompanyFilter(''); setDriverFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); }} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer',
            }}>✕ Limpiar</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {loading ? 'Cargando…' : `${filtered.length} paquetes`}
          </span>
        </div>
      </div>

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Cargando paquetes…</div>
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Lasso button */}
        <button
          onClick={() => { if (lassoMode) { clearSelection(); } else { setLassoMode(true); setSelectedIds(new Set()); } }}
          style={{
            position: 'absolute', top: 10, left: 10, zIndex: 999,
            padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            border: lassoMode ? '2px solid #0052FF' : '1.5px solid #0052FF40',
            background: lassoMode ? '#0052FF' : '#ffffffee', color: lassoMode ? '#fff' : '#0052FF',
            boxShadow: '0 2px 12px #0003', transition: 'all .15s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >{lassoMode ? '✕ Cancelar' : '⬡ Lazo'}</button>

        {lassoMode && !showAssignPanel && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 999,
            background: '#0052FFee', color: '#fff', borderRadius: 20, padding: '6px 16px',
            fontSize: 12, fontWeight: 700, pointerEvents: 'none', whiteSpace: 'nowrap',
            boxShadow: '0 2px 12px #0052ff40',
          }}>
            Dibuja un área · Mantén <kbd style={{ background:'#ffffff30', borderRadius:4, padding:'1px 5px', fontFamily:'monospace' }}>Space</kbd> para mover el mapa
          </div>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: showAssignPanel ? 90 : 16, right: 10, zIndex: 999,
          background: 'rgba(255,255,255,.95)', borderRadius: 12, padding: '10px 14px',
          boxShadow: '0 4px 20px #0002', fontSize: 11,
          display: 'flex', flexDirection: 'column', gap: 5, transition: 'bottom .2s',
        }}>
          {[
            { color: '#0052FF', label: 'Seleccionado' },
            { color: '#f59e0b', label: 'En ruta ahora' },
            { color: '#22c55e', label: 'Entregado' },
            { color: '#94a3b8', label: 'Pendiente' },
            { color: '#ef4444', label: 'Incidencia' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '2px solid #fff', boxShadow: '0 0 0 1px #0001', flexShrink: 0 }} />
              <span style={{ color: '#475569', fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* No-geo panel */}
        {showNoGeoPanel && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1001,
            background: '#fff', borderTop: '2px solid #ef4444',
            boxShadow: '0 -6px 24px #ef444420',
            display: 'flex', flexDirection: 'column', maxHeight: '60%',
          }}>
            <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>⛔</span>
              <span style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{noGeoPackages.length} paquete{noGeoPackages.length !== 1 ? 's' : ''} sin geolocalizar</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>— no aparecen en el mapa</span>
              <button onClick={() => { setShowNoGeoPanel(false); setEditingNoGeo(null); }} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {noGeoPackages.map((pkg, i) => {
                const id        = pkgId(pkg);
                const isEditing = editingNoGeo?.id === id;
                return (
                  <div key={id} style={{ borderBottom: '1px solid var(--border)', background: isEditing ? '#f0f7ff' : i % 2 === 0 ? '#fff' : '#fafafa', borderLeft: isEditing ? '3px solid #0052FF' : '3px solid transparent' }}>
                    <div style={{ padding: '9px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                          {pkg.customerName}{pkg.customerLastName ? ` ${pkg.customerLastName}` : ''}
                          <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6, fontFamily: 'monospace' }}>{pkg.trackingId}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                          {pkg.address || <span style={{ color: '#b91c1c', fontWeight: 600 }}>⛔ Sin dirección</span>}
                          {pkg.commune ? <span style={{ color: 'var(--muted)' }}>, {pkg.commune}</span> : <span style={{ color: '#b91c1c', fontWeight: 600 }}> ⛔ sin comuna</span>}
                        </div>
                      </div>
                      <button onClick={() => setEditingNoGeo(isEditing ? null : { id, address: pkg.address || '', commune: pkg.commune || '' })} style={{
                        padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: isEditing ? '1.5px solid #0052FF' : '1px solid var(--border)',
                        background: isEditing ? '#0052FF' : '#fff', color: isEditing ? '#fff' : '#0052FF',
                      }}>{isEditing ? '▲ Cerrar' : '✏️ Editar'}</button>
                    </div>
                    {isEditing && (
                      <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 }}>DIRECCIÓN</div>
                          <AddressAutocomplete compact value={editingNoGeo.address} placeholder="Ej: Av. Principal 123"
                            onChange={v => setEditingNoGeo(e => ({ ...e, address: v }))}
                            onSelect={({ address, commune }) => {
                              const normalized = SECTOR_TO_COMMUNE[(commune || '').toLowerCase().trim()] || commune;
                              setEditingNoGeo(e => ({ ...e, address, ...(normalized ? { commune: normalized } : {}) }));
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 }}>COMUNA</div>
                            <select value={editingNoGeo.commune} onChange={e => setEditingNoGeo(ed => ({ ...ed, commune: e.target.value }))}
                              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 8px', fontSize: 12, outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
                              <option value="">— Sin comuna —</option>
                              {COMMUNES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <button disabled={savingNoGeo || (!editingNoGeo.address && !editingNoGeo.commune)}
                            onClick={async () => {
                              setSavingNoGeo(true);
                              try {
                                await api.updatePackage(id, { address: editingNoGeo.address || undefined, commune: editingNoGeo.commune || undefined });
                                toast('✅ Guardado');
                                const fresh = await api.getMapPackages({ from: dateFrom, to: dateTo });
                                setPackages(fresh);
                                setEditingNoGeo(null);
                              } catch (err) { toast('❌ ' + err.message); }
                              finally { setSavingNoGeo(false); }
                            }}
                            style={{ padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 800, border: 'none', cursor: savingNoGeo ? 'not-allowed' : 'pointer', background: savingNoGeo ? '#e2e8f0' : '#0052FF', color: savingNoGeo ? '#94a3b8' : '#fff', whiteSpace: 'nowrap' }}>
                            {savingNoGeo ? 'Guardando…' : '💾 Guardar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Assign panel */}
        {showAssignPanel && selectedIds.size > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000, background: '#fff', borderTop: '2px solid #0052FF', boxShadow: '0 -6px 24px #0052ff18' }}>
            {selBreakdown.assigned.length > 0 && (
              <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'flex-start', gap: 8, background: selBreakdown.inActive.length ? '#fff1f2' : '#fffbeb', borderBottom: `1px solid ${selBreakdown.inActive.length ? '#fecdd3' : '#fde68a'}` }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{selBreakdown.inActive.length ? '🚨' : '⚠️'}</span>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: selBreakdown.inActive.length ? '#9f1239' : '#92400e' }}>
                  {selBreakdown.inActive.length > 0 && <span style={{ fontWeight: 800 }}>{selBreakdown.inActive.length} paquete{selBreakdown.inActive.length !== 1 ? 's están' : ' está'} en una ruta <u>activa</u>. </span>}
                  <span style={{ fontWeight: 700 }}>{selBreakdown.assigned.length} ya {selBreakdown.assigned.length !== 1 ? 'tienen' : 'tiene'} ruta{selBreakdown.routes.length > 0 ? ` (${selBreakdown.routes.join(', ')})` : ''}.</span>
                </div>
              </div>
            )}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 800 }}>📦 {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
              </div>
              <select value={targetRouteId} onChange={e => { setTargetRouteId(e.target.value); setShowCreateForm(false); }}
                style={{ flex: 1, minWidth: 180, padding: '8px 10px', borderRadius: 9, fontSize: 12, fontWeight: 600, border: '1.5px solid var(--border)', background: '#fff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Ruta existente —</option>
                {routes.filter(r => ['draft', 'active'].includes(r.status)).map(r => (
                  <option key={r._id || r.id} value={r._id || r.id}>
                    {r.routeCode}{r.name ? ` · ${r.name}` : ''}{r.clientCompany?.name ? ` (${r.clientCompany.name})` : ''}{r.status === 'active' ? ' ●' : ' ○'}
                  </option>
                ))}
              </select>
              <button onClick={handleAssign} disabled={!targetRouteId || assigning || showCreateForm} style={{
                padding: '9px 16px', borderRadius: 9, fontSize: 12, fontWeight: 800, border: 'none', whiteSpace: 'nowrap',
                background: targetRouteId && !assigning && !showCreateForm ? '#0052FF' : '#e2e8f0',
                color: targetRouteId && !assigning && !showCreateForm ? '#fff' : '#94a3b8',
                cursor: targetRouteId && !assigning && !showCreateForm ? 'pointer' : 'not-allowed',
              }}>{assigning ? 'Asignando…' : '✓ Asignar'}</button>
              <button onClick={() => { setShowCreateForm(v => !v); setTargetRouteId(''); }} style={{
                padding: '9px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: showCreateForm ? '2px solid #16a34a' : '1.5px solid #16a34a',
                background: showCreateForm ? '#dcfce7' : '#f0fdf4', color: '#16a34a', whiteSpace: 'nowrap',
              }}>{showCreateForm ? '▲ Cancelar' : '➕ Nueva ruta'}</button>
              <button onClick={clearSelection} style={{ padding: '9px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--muted)' }}>✕</button>
            </div>
            {showCreateForm && (
              <div style={{ borderTop: '1px solid #dcfce7', background: '#f0fdf4', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 2, minWidth: 160 }}>
                    <div style={labelStyle}>Nombre de la ruta</div>
                    <input value={newRouteName} onChange={e => setNewRouteName(e.target.value)} placeholder="Ej: Zona Norte" style={miniInp} />
                  </div>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={labelStyle}>Fecha</div>
                    <input type="date" value={newRouteDate} onChange={e => setNewRouteDate(e.target.value)} style={miniInp} />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={labelStyle}>Driver</div>
                    <select value={newRouteDriverId} onChange={e => setNewRouteDriverId(e.target.value)} style={miniInp}>
                      <option value="">Sin asignar</option>
                      {drivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={labelStyle}>Estado</div>
                    <select value={newRouteStatus} onChange={e => setNewRouteStatus(e.target.value)} style={miniInp}>
                      <option value="active">Activa</option>
                      <option value="draft">Borrador</option>
                    </select>
                  </div>
                </div>
                <div>
                  <div style={{ ...labelStyle, color: '#15803d' }}>📍 DIRECCIÓN DE RETIRO</div>
                  <AddressAutocomplete compact value={newRouteStart.address} placeholder="Bodega o dirección de recogida…"
                    onChange={v => setNewRouteStart(s => ({ ...s, address: v, lat: null, lng: null }))}
                    onSelect={({ address, lat, lng }) => setNewRouteStart({ address, lat, lng })}
                  />
                </div>
                <button onClick={handleCreateAndAssign} disabled={creating} style={{
                  alignSelf: 'flex-end', padding: '9px 18px', borderRadius: 9, fontSize: 12, fontWeight: 800,
                  border: 'none', background: creating ? '#e2e8f0' : '#16a34a',
                  color: creating ? '#94a3b8' : '#fff', cursor: creating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                }}>{creating ? 'Creando...' : `Crear y mover (${selectedIds.size})`}</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ padding: '8px 16px', background: '#fff', borderTop: '1px solid var(--border)', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <StatPill label="Total"       count={packages.length}   color="#64748b" />
        <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
        <StatPill label="Activos"     count={stats.active}      color="#f59e0b" onClick={() => setStatusFilter('activo')} />
        <StatPill label="Entregados"  count={stats.delivered}   color="#22c55e" onClick={() => setStatusFilter('entregado')} />
        <StatPill label="Pendientes"  count={stats.pending}     color="#94a3b8" onClick={() => setStatusFilter('pendiente')} />
        <StatPill label="Incidencias" count={stats.incident}    color="#ef4444" onClick={() => setStatusFilter('no-entregado')} />
        <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
        <StatPill label="Sin asignar" count={stats.unassigned}  color="#6366f1" onClick={() => setStatusFilter('sin-ruta')} />
        <StatPill label="Asignados"   count={stats.assigned}    color="#0891b2" onClick={() => setStatusFilter('con-ruta')} />
        {noGeoPackages.length > 0 && (
          <>
            <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
            <StatPill label="Sin ubicar" count={noGeoPackages.length} color="#ef4444" onClick={() => setShowNoGeoPanel(v => !v)} active={showNoGeoPanel} />
          </>
        )}
        {filtered.length !== packages.length && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>Mostrando {filtered.length}</span>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, count, color, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: active ? `${color}15` : 'none', border: active ? `1.5px solid ${color}` : '1.5px solid transparent',
      borderRadius: 20, padding: active ? '3px 8px' : '3px 0', cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{count}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
    </button>
  );
}

function selStyle(active) {
  return {
    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
    background: '#fff', color: active ? 'var(--accent)' : '#0f172a',
    cursor: 'pointer', outline: 'none',
  };
}

const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#16a34a', textTransform: 'uppercase', marginBottom: 4 };
const miniInp = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #bbf7d0', background: '#fff', fontSize: 12, color: '#0f172a', outline: 'none', display: 'block' };
