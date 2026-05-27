import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Ray-casting point-in-polygon
function pointInPolygon(point, polygon) {
  const { lat: px, lng: py } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { lat: xi, lng: yi } = polygon[i];
    const { lat: xj, lng: yj } = polygon[j];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
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
      ${pkg.companyName ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px">🏢 ${pkg.companyName}</div>` : ''}
      ${pkg.driverName  ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px">🚚 ${pkg.driverName}</div>` : ''}
      <div style="font-size:11px;color:#475569;margin-bottom:3px"><b>Empresa:</b> ${escapeHtml(pkg.companyName || 'Sin empresa')}</div>
      <div style="font-size:11px;color:#475569;margin-bottom:3px"><b>Ruta:</b> ${escapeHtml(routeInfo)}</div>
      <div style="font-size:11px;color:#475569;margin-bottom:3px"><b>Driver:</b> ${escapeHtml(pkg.driverName || 'Sin driver asignado')}</div>
      ${pkg.createdAt ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px"><b>Ingreso:</b> ${escapeHtml(fmtDate(pkg.createdAt))}</div>` : ''}
      <div style="margin-top:6px;font-size:12px;font-weight:700;color:#0f172a">${escapeHtml(sl)}</div>
      ${pkg.failReason  ? `<div style="font-size:11px;color:#ef4444;margin-top:2px">${pkg.failReason}</div>` : ''}
    </div>
  `;
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  // ── Refs ──────────────────────────────────────────────────────────────────
  const mapRef         = useRef(null);
  const mapInst        = useRef(null);
  const markersRef     = useRef([]);       // L.circleMarker list
  const lassoLayerRef  = useRef(null);     // L.polygon while drawing
  const lassoModeRef   = useRef(false);    // live lasso state for map handlers
  const drawingRef     = useRef(false);    // currently dragging lasso
  const lassoPointsRef = useRef([]);       // points accumulated during draw
  const filteredRef    = useRef([]);       // live filtered list for lasso handler
  const spaceHeldRef   = useRef(false);    // Space held → temp pan mode

  // ── State ─────────────────────────────────────────────────────────────────
  const [packages,       setPackages]       = useState([]);
  const [routes,         setRoutes]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('todos');
  const [companyFilter,  setCompanyFilter]  = useState('');
  const [driverFilter,   setDriverFilter]   = useState('');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [lassoMode,      setLassoMode]      = useState(false);
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [showAssignPanel,setShowAssignPanel]= useState(false);
  const [targetRouteId,  setTargetRouteId]  = useState('');
  const [assigning,      setAssigning]      = useState(false);
  const [drivers,        setDrivers]        = useState([]);
  const [showNoGeoPanel, setShowNoGeoPanel] = useState(false);

  // Create route inline form
  const [showCreateForm,    setShowCreateForm]    = useState(false);
  const [newRouteName,      setNewRouteName]      = useState('');
  const [newRouteDate,      setNewRouteDate]      = useState(new Date().toISOString().slice(0, 10));
  const [newRouteDriverId,  setNewRouteDriverId]  = useState('');
  const [newRouteStatus,    setNewRouteStatus]    = useState('active');
  const [creating,          setCreating]          = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
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

  // ── Derived lists for filter dropdowns ────────────────────────────────────
  const companies = useMemo(() => {
    const s = new Set(packages.map(p => p.companyName).filter(Boolean));
    return [...s].sort();
  }, [packages]);

  const driverNames = useMemo(() => {
    const s = new Set(packages.map(p => p.driverName).filter(Boolean));
    return [...s].sort();
  }, [packages]);

  // ── Filtered packages ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return packages.filter(p => {
      const isActive = p.routeStatus === 'active' && p.status === 'pendiente';

      const passStatus =
        statusFilter === 'todos'       ? true
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

  // Keep ref in sync so lasso handlers can read current filtered list
  filteredRef.current = filtered;

  // ── Stats ─────────────────────────────────────────────────────────────────
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

  // ── Init map + lasso events ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;

    const map = L.map(mapRef.current, { center: [-33.455, -70.648], zoom: 11 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Lasso: mousedown → start drawing (skip if Space held for panning)
    map.on('mousedown', e => {
      if (!lassoModeRef.current || spaceHeldRef.current) return;
      drawingRef.current = true;
      lassoPointsRef.current = [e.latlng];
      if (lassoLayerRef.current) { map.removeLayer(lassoLayerRef.current); lassoLayerRef.current = null; }
      lassoLayerRef.current = L.polygon([[e.latlng.lat, e.latlng.lng]], {
        color: '#0052FF', weight: 2.5, fillColor: '#0052FF', fillOpacity: 0.08, dashArray: '6 4',
      }).addTo(map);
      map.dragging.disable();
    });

    // Lasso: mousemove → extend polygon
    map.on('mousemove', e => {
      if (!drawingRef.current) return;
      lassoPointsRef.current.push(e.latlng);
      if (lassoLayerRef.current) lassoLayerRef.current.setLatLngs([lassoPointsRef.current]);
    });

    // Lasso: mouseup → detect packages inside, show assign panel
    map.on('mouseup', () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      map.dragging.enable();
      const pts = lassoPointsRef.current;
      if (pts.length < 3) return;
      const inside = filteredRef.current.filter(pkg =>
        pkg.lat && pkg.lng && pointInPolygon({ lat: pkg.lat, lng: pkg.lng }, pts)
      );
      if (inside.length === 0) {
        toast('Sin paquetes en el área seleccionada');
        if (lassoLayerRef.current) { map.removeLayer(lassoLayerRef.current); lassoLayerRef.current = null; }
        return;
      }
      setSelectedIds(new Set(inside.map(pkgId)));
      setShowAssignPanel(true);
    });

    mapInst.current = map;
    return () => { map.remove(); mapInst.current = null; };
  }, []);

  // ── Space = pan while in lasso mode ──────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space' || !lassoModeRef.current || spaceHeldRef.current) return;
      e.preventDefault();
      spaceHeldRef.current = true;

      // Cancel any in-progress draw
      if (drawingRef.current) {
        drawingRef.current = false;
        lassoPointsRef.current = [];
        const map = mapInst.current;
        if (map && lassoLayerRef.current) { map.removeLayer(lassoLayerRef.current); lassoLayerRef.current = null; }
      }

      const map = mapInst.current;
      if (map) map.dragging.enable();
      if (mapRef.current) mapRef.current.style.cursor = 'grab';
    };

    const onKeyUp = (e) => {
      if (e.code !== 'Space' || !lassoModeRef.current) return;
      e.preventDefault();
      spaceHeldRef.current = false;
      if (mapRef.current) mapRef.current.style.cursor = 'crosshair';
      // dragging stays enabled until the next lasso mousedown
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup',   onKeyUp);
    };
  }, []);

  // ── Toggle lasso mode ─────────────────────────────────────────────────────
  useEffect(() => {
    lassoModeRef.current = lassoMode;
    if (!mapRef.current) return;
    mapRef.current.style.cursor = lassoMode ? 'crosshair' : '';
    if (!lassoMode) {
      drawingRef.current = false;
      const map = mapInst.current;
      if (map) {
        map.dragging.enable();
        if (lassoLayerRef.current) { map.removeLayer(lassoLayerRef.current); lassoLayerRef.current = null; }
      }
    }
  }, [lassoMode]);

  // ── Redraw markers ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    const visiblePackages = hasActiveFilters ? filtered : packages;
    const hasSelection = selectedIds.size > 0;

    visiblePackages.forEach(pkg => {
      if (!pkg.lat || !pkg.lng) return;

      const id         = pkgId(pkg);
      const isSelected = selectedIds.has(id);

      // Dimmed when: lasso active → not selected  /  filter active → doesn't match
      const dimmed = hasSelection ? !isSelected : false;
      const color  = isSelected ? '#0052FF' : (dimmed ? '#94a3b8' : pinColor(pkg));

      const marker = L.circleMarker([pkg.lat, pkg.lng], {
        radius:      isSelected ? 9 : 7,
        fillColor:   color,
        color:       dimmed ? '#64748b' : '#fff',
        weight:      isSelected ? 3 : (dimmed ? 1 : 2),
        opacity:     1,
        fillOpacity: dimmed ? 0.45 : 0.92,
      });

      marker.bindPopup(popupHtml(pkg), { maxWidth: 260 });

      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [packages, filtered, selectedIds, lassoMode, hasActiveFilters]);

  // ── Clear lasso selection ─────────────────────────────────────────────────
  const clearSelection = () => {
    setSelectedIds(new Set());
    setShowAssignPanel(false);
    setTargetRouteId('');
    setShowCreateForm(false);
    setNewRouteName('');
    setNewRouteDriverId('');
    setNewRouteStatus('active');
    setNewRouteDate(new Date().toISOString().slice(0, 10));
    setLassoMode(false);
    const map = mapInst.current;
    if (map && lassoLayerRef.current) { map.removeLayer(lassoLayerRef.current); lassoLayerRef.current = null; }
  };

  const selectFilteredPackages = () => {
    const ids = filtered.map(pkgId).filter(Boolean);
    if (ids.length === 0) {
      toast('No hay paquetes con esos filtros');
      return;
    }
    setSelectedIds(new Set(ids));
    setShowAssignPanel(true);
    setLassoMode(true);
  };

  // ── Selection breakdown (computed fresh every render) ────────────────────
  const selBreakdown = useMemo(() => {
    const sel      = packages.filter(p => selectedIds.has(pkgId(p)));
    const free     = sel.filter(p => !hasAssignedRoute(p));
    const assigned = sel.filter(p => hasAssignedRoute(p));
    const inActive = assigned.filter(p => p.routeStatus === 'active');
    const routes   = [...new Set(assigned.map(p => p.routeCode).filter(Boolean))];
    return { total: sel.length, free, assigned, inActive, routes };
  }, [packages, selectedIds]);

  // ── Assign selected packages to an existing route (all selected) ──────────
  const handleAssign = async () => {
    if (!targetRouteId || selectedIds.size === 0) return;
    if (selBreakdown.inActive.length > 0) {
      const ok = window.confirm(
        `⚠️ ${selBreakdown.inActive.length} paquete${selBreakdown.inActive.length !== 1 ? 's están' : ' está'} en una ruta activa (driver en camino).\n\nReasignarlos los sacará de esa ruta inmediatamente.\n\n¿Confirmas?`
      );
      if (!ok) return;
    }
    setAssigning(true);
    try {
      await Promise.all([...selectedIds].map(id => api.updatePackage(id, { routeId: targetRouteId })));
      toast(`✅ ${selectedIds.size} paquete${selectedIds.size !== 1 ? 's' : ''} asignado${selectedIds.size !== 1 ? 's' : ''}`);
      const fresh = await api.getMapPackages();
      setPackages(fresh);
      clearSelection();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setAssigning(false);
    }
  };

  // ── Create new route — only assigns FREE packages (no route yet) ──────────
  const handleCreateAndAssign = async () => {
    const selectedPackageIds = [...selectedIds];
    if (selectedPackageIds.length === 0) {
      toast('⚠️ Todos los paquetes seleccionados ya tienen ruta. Solo los sin ruta se pueden agregar a una nueva.');
      return;
    }
    if (selBreakdown.inActive.length > 0) {
      const ok = window.confirm(
        `Hay ${selBreakdown.inActive.length} paquete${selBreakdown.inActive.length !== 1 ? 's' : ''} en una ruta activa.\n\nCrear una nueva ruta los movera a la ruta nueva y saldran de la ruta anterior inmediatamente.\n\nConfirmas?`
      );
      if (!ok) return;
    }
    setCreating(true);
    try {
      const route = await api.createRoute({
        name:     newRouteName.trim() || undefined,
        date:     newRouteDate,
        status:   newRouteStatus,
        driverId: newRouteDriverId || undefined,
      });
      await Promise.all(selectedPackageIds.map(id => api.updatePackage(id, { routeId: route._id || route.id })));
      toast(`✅ Ruta ${route.routeCode} creada con ${selectedPackageIds.length} paquete${selectedPackageIds.length !== 1 ? 's' : ''}`);
      const [fresh, freshRoutes] = await Promise.all([api.getMapPackages(), api.getRoutes()]);
      setPackages(fresh);
      setRoutes(freshRoutes);
      clearSelection();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>

        {/* Search row */}
        <div style={{ padding: '8px 12px 0' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', pointerEvents: 'none' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, dirección o ID de paquete…"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px',
                borderRadius: 10, border: '1px solid var(--border)', fontSize: 12,
                outline: 'none', background: 'var(--card2)', color: '#0f172a',
              }}
            />
          </div>
        </div>

        {/* Filter pills + dropdowns row */}
        <div style={{ padding: '6px 12px 8px', display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {STATUS_FILTERS.map(({ val, label, color }) => {
            const active = statusFilter === val;
            return (
              <button key={val} onClick={() => setStatusFilter(val)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: active ? `2px solid ${color}` : '1px solid var(--border)',
                background: active ? `${color}18` : '#fff',
                color: active ? color : 'var(--muted)',
                transition: 'all .1s',
              }}>
                {label}
              </button>
            );
          })}

          <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

          {ROUTE_FILTERS.map(({ val, label, color }) => {
            const active = statusFilter === val;
            return (
              <button key={val} onClick={() => setStatusFilter(val)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: active ? `2px solid ${color}` : '1px solid var(--border)',
                background: active ? `${color}18` : '#fff',
                color: active ? color : 'var(--muted)',
                transition: 'all .1s',
              }}>
                {label}
              </button>
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

          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            title="Fecha de ingreso desde"
            style={{ ...selStyle(!!dateFrom), width: 126 }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            title="Fecha de ingreso hasta"
            style={{ ...selStyle(!!dateTo), width: 126 }}
          />

          <button
            onClick={selectFilteredPackages}
            disabled={filtered.length === 0}
            title="Seleccionar todos los paquetes que cumplen los filtros actuales"
            style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
              border: '1px solid #0052FF55',
              background: filtered.length ? '#0052FF10' : '#f1f5f9',
              color: filtered.length ? '#0052FF' : '#94a3b8',
              cursor: filtered.length ? 'pointer' : 'not-allowed',
            }}
          >
            Seleccionar filtrados ({filtered.length})
          </button>

          {hasActiveFilters && (
            <button onClick={() => { setStatusFilter('todos'); setCompanyFilter(''); setDriverFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); }} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer',
            }}>
              ✕ Limpiar
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {loading ? 'Cargando…' : `${filtered.length} paquetes`}
          </span>
        </div>
      </div>

      {/* ── Map area ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Cargando paquetes…</div>
          </div>
        )}

        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Lasso button — top-left overlay */}
        <button
          onClick={() => { if (lassoMode) { clearSelection(); } else { setLassoMode(true); setSelectedIds(new Set()); } }}
          title={lassoMode ? 'Cancelar selección' : 'Activar lazo — dibuja en el mapa para seleccionar paquetes'}
          style={{
            position: 'absolute', top: 10, left: 10, zIndex: 999,
            padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            border: lassoMode ? '2px solid #0052FF' : '1.5px solid #0052FF40',
            background: lassoMode ? '#0052FF' : '#ffffffee',
            color: lassoMode ? '#fff' : '#0052FF',
            boxShadow: '0 2px 12px #0003',
            transition: 'all .15s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {lassoMode ? '✕ Cancelar' : '⬡ Lazo'}
        </button>

        {/* Lasso hint */}
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

        {/* Legend — bottom right */}
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

        {/* No-geo panel — slides up from bottom of map */}
        {showNoGeoPanel && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1001,
            background: '#fff', borderTop: '2px solid #ef4444',
            boxShadow: '0 -6px 24px #ef444420',
            display: 'flex', flexDirection: 'column', maxHeight: '55%',
          }}>
            <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>⛔</span>
              <span style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                {noGeoPackages.length} paquete{noGeoPackages.length !== 1 ? 's' : ''} sin geolocalizar
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>
                — no aparecen en el mapa
              </span>
              <button onClick={() => setShowNoGeoPanel(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {noGeoPackages.length === 0
                ? <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--muted)', fontSize: 13 }}>✅ Todos los paquetes están geolocalizados</div>
                : noGeoPackages.map((pkg, i) => {
                    const noCommune  = !pkg.commune;
                    const noAddrNum  = pkg.address && !/\d/.test(pkg.address.trim());
                    const noAddress  = !pkg.address;
                    const noPhone    = !pkg.customerPhone;
                    return (
                      <div key={pkgId(pkg)} style={{
                        padding: '9px 16px', borderBottom: '1px solid var(--border)',
                        background: i % 2 === 0 ? '#fff' : '#fafafa',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                              {pkg.customerName}{pkg.customerLastName ? ` ${pkg.customerLastName}` : ''}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>{pkg.trackingId}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                            {noAddress
                              ? <span style={{ color: '#b91c1c', fontWeight: 600 }}>⛔ Sin dirección</span>
                              : <span style={{ color: noAddrNum ? '#b91c1c' : 'inherit', fontWeight: noAddrNum ? 600 : 'normal' }}>{pkg.address}</span>
                            }
                            {pkg.commune
                              ? <span style={{ color: 'var(--muted)' }}>, {pkg.commune}</span>
                              : <span style={{ color: '#b91c1c', fontWeight: 600 }}> ⛔ sin comuna</span>
                            }
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                            {noAddress  && <GeoErrBadge>⛔ Sin dirección</GeoErrBadge>}
                            {noAddrNum  && <GeoErrBadge>⛔ Sin número en dirección</GeoErrBadge>}
                            {noCommune  && <GeoErrBadge>⛔ Sin comuna</GeoErrBadge>}
                            {noPhone    && <WarnBadge>📞 Sin teléfono</WarnBadge>}
                            {pkg.aiFlags?.length > 0 && <WarnBadge>⚠ IA: {pkg.aiFlags.join(', ')}</WarnBadge>}
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0, textAlign: 'right' }}>
                          {pkg.companyName && <div style={{ color: '#7c3aed', fontWeight: 600 }}>{pkg.companyName}</div>}
                          {pkg.routeCode   && <div>{pkg.routeCode}</div>}
                          <div style={{ marginTop: 2, fontWeight: 600, color: pkg.status === 'pendiente' ? '#94a3b8' : '#0052FF' }}>
                            {pkg.status}
                          </div>
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          </div>
        )}

        {/* Assign panel — slides up from bottom of map */}
        {showAssignPanel && selectedIds.size > 0 && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
            background: '#fff', borderTop: '2px solid #0052FF',
            boxShadow: '0 -6px 24px #0052ff18',
          }}>
            {/* Warning banner — packages already in a route */}
            {selBreakdown.assigned.length > 0 && (
              <div style={{
                padding: '8px 16px', display: 'flex', alignItems: 'flex-start', gap: 8,
                background: selBreakdown.inActive.length ? '#fff1f2' : '#fffbeb',
                borderBottom: `1px solid ${selBreakdown.inActive.length ? '#fecdd3' : '#fde68a'}`,
              }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{selBreakdown.inActive.length ? '🚨' : '⚠️'}</span>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: selBreakdown.inActive.length ? '#9f1239' : '#92400e' }}>
                  {selBreakdown.inActive.length > 0 && (
                    <span style={{ fontWeight: 800 }}>
                      {selBreakdown.inActive.length} paquete{selBreakdown.inActive.length !== 1 ? 's están' : ' está'} en una ruta <u>activa</u> (driver en camino).{' '}
                    </span>
                  )}
                  <span style={{ fontWeight: 700 }}>
                    {selBreakdown.assigned.length} ya {selBreakdown.assigned.length !== 1 ? 'tienen' : 'tiene'} ruta
                    {selBreakdown.routes.length > 0 ? ` (${selBreakdown.routes.join(', ')})` : ''}.
                  </span>
                  {' '}Al crear una nueva ruta, los seleccionados se moveran a esa ruta sin duplicarse.
                </div>
              </div>
            )}

            {/* Row 1 — selector + actions */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                <span style={{ fontWeight: 800 }}>📦 {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
                {selBreakdown.assigned.length > 0 && (
                  <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                    {' '}· {selBreakdown.free.length} libre{selBreakdown.free.length !== 1 ? 's' : ''} · {selBreakdown.assigned.length} con ruta
                  </span>
                )}
              </div>

              <select
                value={targetRouteId}
                onChange={e => { setTargetRouteId(e.target.value); setShowCreateForm(false); }}
                style={{
                  flex: 1, minWidth: 180, padding: '8px 10px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                  border: '1.5px solid var(--border)', background: '#fff', color: '#0f172a',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">— Ruta existente —</option>
                {routes
                  .filter(r => ['draft', 'active'].includes(r.status))
                  .map(r => (
                    <option key={r._id || r.id} value={r._id || r.id}>
                      {r.routeCode}{r.name ? ` · ${r.name}` : ''}{r.clientCompany?.name ? ` (${r.clientCompany.name})` : ''}
                      {r.status === 'active' ? ' ●' : ' ○'}
                    </option>
                  ))}
              </select>

              <button
                onClick={handleAssign}
                disabled={!targetRouteId || assigning || showCreateForm}
                style={{
                  padding: '9px 16px', borderRadius: 9, fontSize: 12, fontWeight: 800,
                  border: 'none', whiteSpace: 'nowrap', transition: 'all .15s',
                  background: targetRouteId && !assigning && !showCreateForm ? '#0052FF' : '#e2e8f0',
                  color:      targetRouteId && !assigning && !showCreateForm ? '#fff' : '#94a3b8',
                  cursor:     targetRouteId && !assigning && !showCreateForm ? 'pointer' : 'not-allowed',
                }}
              >
                {assigning ? 'Asignando…' : '✓ Asignar'}
              </button>

              <button
                onClick={() => { setShowCreateForm(v => !v); setTargetRouteId(''); }}
                style={{
                  padding: '9px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: showCreateForm ? '2px solid #16a34a' : '1.5px solid #16a34a',
                  background: showCreateForm ? '#dcfce7' : '#f0fdf4',
                  color: '#16a34a', whiteSpace: 'nowrap',
                }}
              >
                {showCreateForm ? '▲ Cancelar' : '➕ Nueva ruta'}
              </button>

              <button
                onClick={clearSelection}
                style={{
                  padding: '9px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'none', color: 'var(--muted)',
                }}
              >
                ✕
              </button>
            </div>

            {/* Row 2 — inline create route form */}
            {showCreateForm && (
              <div style={{
                borderTop: '1px solid #dcfce7', background: '#f0fdf4',
                padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
              }}>
                <div style={{ flex: 2, minWidth: 160 }}>
                  <div style={labelStyle}>Nombre de la ruta</div>
                  <input
                    value={newRouteName}
                    onChange={e => setNewRouteName(e.target.value)}
                    placeholder="Ej: Zona Norte — Lunes"
                    style={miniInp}
                  />
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
                <button
                  onClick={handleCreateAndAssign}
                  disabled={creating}
                  style={{
                    padding: '9px 18px', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: creating ? 'not-allowed' : 'pointer',
                    border: 'none', background: creating ? '#e2e8f0' : '#16a34a',
                    color: creating ? '#94a3b8' : '#fff', whiteSpace: 'nowrap', alignSelf: 'flex-end',
                  }}
                >
                  {creating ? 'Creando...' : `Crear y mover (${selectedIds.size})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 16px', background: '#fff', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
      }}>
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
            <StatPill
              label="Sin ubicar"
              count={noGeoPackages.length}
              color="#ef4444"
              onClick={() => setShowNoGeoPanel(v => !v)}
              active={showNoGeoPanel}
            />
          </>
        )}
        {filtered.length !== packages.length && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
            Mostrando {filtered.length}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, count, color, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: active ? `${color}15` : 'none',
      border: active ? `1.5px solid ${color}` : '1.5px solid transparent',
      borderRadius: 20, padding: active ? '3px 8px' : '3px 0',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all .15s',
    }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{count}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
    </button>
  );
}

function GeoErrBadge({ children }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: '#ef444415', color: '#b91c1c', border: '1px solid #ef444430' }}>
      {children}
    </span>
  );
}

function WarnBadge({ children }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: '#f59e0b10', color: '#92400e', border: '1px solid #f59e0b30' }}>
      {children}
    </span>
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

const labelStyle = {
  fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#16a34a',
  textTransform: 'uppercase', marginBottom: 4,
};

const miniInp = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #bbf7d0', background: '#fff', fontSize: 12,
  color: '#0f172a', outline: 'none', display: 'block',
};
