import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

const STATUS_COLOR = {
  pendiente:      '#888',
  entregado:      '#0052FF',
  'no-entregado': '#cc2244',
  eliminado:      '#c04a1a',
};
const STATUS_LABEL = {
  todos: 'Todos',
  pendiente: '⏳ Pendientes',
  entregado: '✅ Entregados',
  'no-entregado': '❌ No entregados',
  eliminado: '🗑️ Eliminados',
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

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

export default function AllPackagesView() {
  const [packages, setPackages]   = useState([]);
  const [routes, setRoutes]       = useState([]);
  const [users, setUsers]         = useState([]);
  const [companies, setCompanies] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusF, setStatusF]     = useState('todos');
  const [routeF, setRouteF]       = useState('');
  const [driverF, setDriverF]     = useState('');
  const [companyF, setCompanyF]   = useState('');
  const [moveTarget, setMoveTarget] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showSingle, setShowSingle] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  const LIMIT = 50;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await api.getAllPackages({
        search: search || undefined,
        status: statusF !== 'todos' ? statusF : undefined,
        routeId: routeF || undefined,
        driverId: driverF || undefined,
        companyId: companyF || undefined,
        page: p,
        limit: LIMIT,
      });
      setPackages(data.packages);
      setTotal(data.total);
      setPage(p);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusF, routeF, driverF, companyF]);

  useEffect(() => {
    api.getRoutes().then(setRoutes).catch(() => {});
    api.getUsers().then(u => setUsers(u.filter(x => x.role === 'driver'))).catch(() => {});
    api.getCompanies().then(setCompanies).catch(() => {});
  }, []);

  useEffect(() => { load(1); }, [load]);

  const handleMoveConfirm = async () => {
    if (!moveTarget?.pkg || !moveTarget?.targetRouteId) return;
    try {
      await api.updatePackage(moveTarget.pkg._id, { routeId: moveTarget.targetRouteId });
      toast('✅ Paquete movido');
      setMoveTarget(null);
      load(page);
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const handleStatusChange = async (pkg, newStatus) => {
    try {
      await api.updatePackage(pkg._id, { status: newStatus });
      setPackages(prev => prev.map(p => p._id === pkg._id ? { ...p, status: newStatus } : p));
      toast(newStatus === 'entregado' ? '✅ Entregado' : '↩ Actualizado');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const allSelected = packages.length > 0 && packages.every(p => selectedIds.has(p._id));

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.deletePackage(confirmDelete._id);
      setPackages(prev => prev.filter(p => p._id !== confirmDelete._id));
      setTotal(t => t - 1);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(confirmDelete._id); return n; });
      toast('🗑 Paquete eliminado');
      setConfirmDelete(null);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      await api.bulkDeletePackages([...selectedIds]);
      const count = selectedIds.size;
      setPackages(prev => prev.filter(p => !selectedIds.has(p._id)));
      setTotal(t => t - count);
      toast(`🗑 ${count} paquete${count !== 1 ? 's' : ''} eliminado${count !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSave = async (id, updates) => {
    try {
      const updated = await api.updatePackage(id, updates);
      setPackages(prev => prev.map(p => p._id === id ? updated : p));
      toast('✅ Paquete actualizado');
      setEditTarget(null);
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const handleMarkReviewed = async (pkg) => {
    try {
      const updated = await api.updatePackage(pkg._id, { aiFlags: [] });
      setPackages(prev => prev.map(p => p._id === pkg._id ? updated : p));
      toast('✅ Advertencias marcadas como revisadas');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Filters */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '8px 10px 6px', flexShrink: 0 }}>

        {/* Search + buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar nombre, dirección, tracking, teléfono…"
            style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 22, padding: '8px 14px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
          <button onClick={() => setShowSingle(true)} style={actionBtn('#0052FF')} title="Agregar 1 paquete">➕</button>
          <button onClick={() => setShowImport(true)} style={actionBtn('#7c3aed')} title="Importar lote con IA">🤖</button>
          <button onClick={() => load(page)} style={actionBtn('#0284c7')} title="Actualizar lista">🔄</button>
          <button
            onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}
            style={{ ...actionBtn(viewMode === 'table' ? '#0052FF' : '#64748b'), fontSize: 14 }}
            title={viewMode === 'table' ? 'Ver como tarjetas' : 'Ver como tabla'}
          >{viewMode === 'table' ? '🃏' : '📊'}</button>
        </div>

        {/* Status chips */}
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 5 }}>
          {Object.keys(STATUS_LABEL).map(f => (
            <button key={f} onClick={() => setStatusF(f)} style={{
              flexShrink: 0, padding: '4px 11px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: statusF === f ? 'var(--accent)' : 'var(--card2)',
              color: statusF === f ? '#fff' : 'var(--muted)'
            }}>
              {STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Selectors */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {companies.length > 0 && (
            <select value={companyF} onChange={e => setCompanyF(e.target.value)} style={selStyle(!!companyF)}>
              <option value="">🏢 Todas las empresas</option>
              {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          )}
          <select value={routeF} onChange={e => setRouteF(e.target.value)} style={selStyle(!!routeF)}>
            <option value="">Todas las rutas</option>
            {routes.map(r => (
              <option key={r._id} value={r._id}>
                {r.routeCode}{r.name ? ` · ${r.name}` : ''} — {new Date(r.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
              </option>
            ))}
          </select>
          <select value={driverF} onChange={e => setDriverF(e.target.value)} style={selStyle(!!driverF)}>
            <option value="">Todos los drivers</option>
            {users.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>

        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 6, letterSpacing: .5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{loading ? 'Cargando…' : `${total} paquete${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}</span>
          {!loading && packages.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(packages.map(p => p._id)))}
                style={{ width: 13, height: 13, cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <span style={{ color: allSelected ? 'var(--accent)' : 'var(--muted)' }}>Seleccionar todos</span>
            </label>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              style={{ padding: '3px 10px', borderRadius: 20, border: '1px solid #e5534b', background: '#e5534b12', color: '#e5534b', fontSize: 10, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer' }}
            >
              {deleting ? '⏳ Eliminando…' : `🗑 Eliminar ${selectedIds.size} seleccionado${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0 calc(60px + env(safe-area-inset-bottom))' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13 }}>Cargando paquetes…</div>
        ) : packages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            Sin resultados
          </div>
        ) : viewMode === 'table' ? (
          <AllPkgTable
            packages={packages}
            companies={companies}
            routes={routes}
            onMove={pkg => setMoveTarget({ pkg, targetRouteId: '' })}
            onStatusChange={handleStatusChange}
            onDelete={pkg => setConfirmDelete(pkg)}
            onEdit={pkg => setEditTarget(pkg)}
            onMarkReviewed={handleMarkReviewed}
            selected={selectedIds}
            onToggleSelect={toggleSelect}
            allSelected={allSelected}
            onToggleAll={() => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(packages.map(p => p._id)))}
          />
        ) : (
          packages.map(pkg => (
            <PkgRow
              key={pkg._id}
              pkg={pkg}
              routes={routes}
              onMove={() => setMoveTarget({ pkg, targetRouteId: '' })}
              onStatusChange={handleStatusChange}
              onDelete={() => setConfirmDelete(pkg)}
              onEdit={() => setEditTarget(pkg)}
              onMarkReviewed={() => handleMarkReviewed(pkg)}
              selected={selectedIds.has(pkg._id)}
              onToggleSelect={() => toggleSelect(pkg._id)}
            />
          ))
        )}

        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
            <button disabled={page <= 1} onClick={() => load(page - 1)} style={pageBtn(page > 1)}>← Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 8px', fontWeight: 600 }}>{page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => load(page + 1)} style={pageBtn(page < pages)}>Siguiente →</button>
          </div>
        )}
      </div>

      {moveTarget && (
        <MoveModal
          pkg={moveTarget.pkg}
          routes={routes}
          targetRouteId={moveTarget.targetRouteId}
          onSelect={id => setMoveTarget(t => ({ ...t, targetRouteId: id }))}
          onConfirm={handleMoveConfirm}
          onClose={() => setMoveTarget(null)}
        />
      )}

      {showSingle && (
        <SinglePackageModal
          companies={companies}
          onClose={() => setShowSingle(false)}
          onDone={() => { setShowSingle(false); load(1); }}
        />
      )}

      {showImport && (
        <BulkImportModal
          companies={companies}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); load(1); }}
        />
      )}

      {editTarget && (
        <EditPackageModal
          pkg={editTarget}
          companies={companies}
          onClose={() => setEditTarget(null)}
          onSave={handleEditSave}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteSheet
          pkg={confirmDelete}
          loading={deleting}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/* ─── Bulk import modal (AI — handles images, Excel, CSV) ─────────── */
function BulkImportModal({ companies, onClose, onDone }) {
  const [companyId, setCompanyId] = useState('');
  const [stage, setStage]         = useState('upload'); // upload | processing | preview
  const [preview, setPreview]     = useState([]);       // array of packages
  const [saving, setSaving]       = useState(false);
  const fileRef = useRef();

  /* ── AI extraction ── */
  const handleFile = async (file) => {
    if (!file) return;
    if (!companyId) { toast('❌ Selecciona una empresa antes de continuar'); return; }
    setStage('processing');
    try {
      const data = await api.importPoolPreview(file);
      setPreview(data.packages.map((p, i) => ({ ...p, _id: i })));
      setStage('preview');
    } catch (err) {
      toast('❌ ' + err.message);
      setStage('upload');
    }
  };

  /* ── Edit individual field — editing a flagged cell removes its flag ── */
  const setField = (idx, field, val) =>
    setPreview(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      return { ...p, [field]: val, _flags: (p._flags || []).filter(f => f !== field) };
    }));

  /* ── Remove package from preview ── */
  const remove = (idx) => setPreview(prev => prev.filter((_, i) => i !== idx));

  /* ── Save all ── */
  const handleConfirm = async () => {
    if (!preview.length || !companyId) return;
    setSaving(true);
    try {
      const clean = preview.map(({ _id, _suggestedPrice, ...rest }) => rest); // _flags se mantiene → servidor guarda en ai_flags
      const res = await api.importPoolConfirm(clean, companyId);
      toast(`✅ ${res.count} paquete${res.count !== 1 ? 's' : ''} ingresado${res.count !== 1 ? 's' : ''}`);
      onDone();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const flagCount      = preview.filter(p => p._flags?.length > 0).length;
  const geoErrorCount  = preview.filter(p => !p.commune || !p.address || !/\d/.test((p.address || '').trim())).length;
  const phoneWarnCount = preview.filter(p => !p.customerPhone).length;

  if (companies.length === 0) {
    return (
      <BottomSheet title="🤖 Importar paquetes" onClose={onClose}>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No hay empresas registradas</div>
          <div style={{ fontSize: 12 }}>Registra primero una empresa (proveedor) en la sección Empresas.</div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="🤖 Importar paquetes por lote" onClose={onClose} tall>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        {/* Company selector — always visible */}
        <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>
            🏢 Empresa (proveedor) <span style={{ color: '#ef4444' }}>*</span>
          </div>
          <select
            value={companyId}
            onChange={e => setCompanyId(e.target.value)}
            style={{
              width: '100%', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none',
              border: companyId ? '2px solid var(--accent)' : '2px solid #f59e0b',
              background: companyId ? '#0052FF08' : '#fff7ed',
              color: 'var(--text)', WebkitAppearance: 'none', fontWeight: 600, boxSizing: 'border-box',
            }}
          >
            <option value="">— Seleccionar empresa —</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>

        {/* ── STAGE: upload ── */}
        {stage === 'upload' && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7, background: 'var(--card2)', borderRadius: 8, padding: '10px 12px' }}>
              <b style={{ color: 'var(--text)' }}>Formatos aceptados:</b> foto/screenshot de planilla, imagen JPG o PNG, Excel .xlsx, CSV<br />
              Claude extrae: <b>nombre, apellido, dirección, teléfono, comuna, depto/casa</b>
            </div>
            <div
              onClick={() => companyId ? fileRef.current?.click() : toast('❌ Selecciona una empresa primero')}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              style={{
                border: '2px dashed var(--border)', borderRadius: 14, padding: '36px 20px',
                textAlign: 'center', cursor: 'pointer', color: 'var(--muted)', background: 'var(--card2)',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>🤖</div>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, marginBottom: 4 }}>Arrastra el archivo o toca para seleccionar</div>
              <div style={{ fontSize: 11 }}>Foto · Screenshot · Excel · CSV</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.xlsx,.xls,.csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* ── STAGE: processing ── */}
        {stage === 'processing' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
            <div style={{ fontSize: 44 }}>🤖</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Claude está leyendo el documento…</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
              Extrayendo nombres, direcciones, teléfonos y comunas.<br />Esto puede tardar 15-40 segundos.
            </div>
          </div>
        )}

        {/* ── STAGE: preview (editable) ── */}
        {stage === 'preview' && (
          <>
            {/* Summary bar */}
            <div style={{ padding: '8px 16px 6px', flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', flex: 1, minWidth: 80 }}>
                {preview.length} paquete{preview.length !== 1 ? 's' : ''} detectado{preview.length !== 1 ? 's' : ''}
              </div>
              {geoErrorCount > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#ef444412', border: '1px solid #ef444430', borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                  ⛔ {geoErrorCount} sin datos para geocodificar
                </div>
              )}
              {flagCount > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#f59e0b12', border: '1px solid #f59e0b30', borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                  ⚠ {flagCount} con datos dudosos
                </div>
              )}
              {phoneWarnCount > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#f59e0b10', border: '1px solid #f59e0b28', borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                  📞 {phoneWarnCount} sin teléfono
                </div>
              )}
              <button
                onClick={() => { setStage('upload'); setPreview([]); }}
                style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                ← Cambiar archivo
              </button>
            </div>

            {/* Editable table */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
                <thead>
                  <tr style={{ background: 'var(--card2)', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 1px 0 var(--border)' }}>
                    {['#', 'Nombre', 'Apellido', 'Teléfono', 'Dirección', 'Comuna', 'Depto', ''].map(h => (
                      <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: 'var(--muted)', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((pkg, idx) => {
                    const flags        = pkg._flags || [];
                    const hasFlags     = flags.length > 0;
                    const noCommune    = !pkg.commune;
                    const noAddrNum    = !pkg.address || !/\d/.test(pkg.address.trim());
                    const noPhone      = !pkg.customerPhone;
                    const hasGeoError  = noCommune || noAddrNum;
                    const rowBg = hasGeoError ? '#fef2f2' : hasFlags ? '#fffbeb' : idx % 2 === 0 ? '#fff' : 'var(--card2)';
                    const rowBorder = hasGeoError ? '#ef4444' : hasFlags ? '#f59e0b' : 'transparent';
                    return (
                      <tr key={pkg._id} style={{ background: rowBg, borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${rowBorder}` }}>
                        <td style={{ padding: '5px 8px', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', verticalAlign: 'middle', color: hasGeoError ? '#b91c1c' : hasFlags ? '#b45309' : 'var(--muted)' }}>
                          {idx + 1}
                          {hasGeoError && <span title={`Sin datos para geocodificar${noCommune ? ': falta comuna' : ''}${noAddrNum ? ', falta número en dirección' : ''}`} style={{ marginLeft: 2 }}>⛔</span>}
                          {!hasGeoError && hasFlags && <span title={`IA marcó: ${flags.join(', ')}`} style={{ marginLeft: 2 }}>⚠</span>}
                          {noPhone && <span title="Sin teléfono" style={{ marginLeft: 2 }}>📞</span>}
                        </td>
                        <td style={{ padding: '3px 4px', background: flags.includes('customerName') ? '#fef3c7' : 'transparent' }}>
                          <input value={pkg.customerName || ''} onChange={e => setField(idx, 'customerName', e.target.value)} placeholder="Nombre" style={previewInput(flags.includes('customerName'))} />
                        </td>
                        <td style={{ padding: '3px 4px', background: flags.includes('customerLastName') ? '#fef3c7' : 'transparent' }}>
                          <input value={pkg.customerLastName || ''} onChange={e => setField(idx, 'customerLastName', e.target.value)} placeholder="Apellido" style={previewInput(flags.includes('customerLastName'))} />
                        </td>
                        <td style={{ padding: '3px 4px', background: noPhone ? '#fef3c7' : 'transparent' }}>
                          <input value={pkg.customerPhone || ''} onChange={e => setField(idx, 'customerPhone', e.target.value)} placeholder="+56912345678" style={previewInput(noPhone || flags.includes('customerPhone'))} />
                        </td>
                        <td style={{ padding: '3px 4px', background: noAddrNum ? '#fee2e2' : flags.includes('address') ? '#fef3c7' : 'transparent', minWidth: 160 }}>
                          <input value={pkg.address || ''} onChange={e => setField(idx, 'address', e.target.value)} placeholder="Dirección y número" style={previewInput(flags.includes('address'), noAddrNum)} />
                        </td>
                        <td style={{ padding: '3px 4px', background: noCommune ? '#fee2e2' : flags.includes('commune') ? '#fef3c7' : 'transparent', minWidth: 110 }}>
                          <select value={pkg.commune || ''} onChange={e => setField(idx, 'commune', e.target.value)} style={{ ...previewInput(flags.includes('commune'), noCommune), WebkitAppearance: 'none' }}>
                            <option value="">— Sin comuna —</option>
                            {COMMUNES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '3px 4px', background: flags.includes('aptFloor') ? '#fef3c7' : 'transparent' }}>
                          <input value={pkg.aptFloor || ''} onChange={e => setField(idx, 'aptFloor', e.target.value)} placeholder="Dpto" style={previewInput(flags.includes('aptFloor'))} />
                        </td>
                        <td style={{ padding: '3px 8px', verticalAlign: 'middle' }}>
                          <button onClick={() => remove(idx)} style={{ background: 'none', border: 'none', color: '#cc2244', fontSize: 15, cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }} title="Eliminar fila">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Confirm footer */}
            <div style={{ padding: '10px 16px calc(20px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
              <button
                onClick={handleConfirm}
                disabled={saving || preview.length === 0}
                style={{
                  flex: 1, padding: 13, borderRadius: 11, border: 'none', fontSize: 13, fontWeight: 700,
                  cursor: !saving && preview.length > 0 ? 'pointer' : 'not-allowed',
                  background: !saving && preview.length > 0 ? '#7c3aed' : 'var(--card2)',
                  color: !saving && preview.length > 0 ? '#fff' : 'var(--muted)',
                }}
              >
                {saving
                  ? '⏳ Geocodificando y guardando…'
                  : `✅ Confirmar ${preview.length} paquete${preview.length !== 1 ? 's' : ''}`
                }
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

/* ─── Single package modal ───────────────────────────────────────── */
function SinglePackageModal({ companies, onClose, onDone }) {
  const [form, setForm] = useState({
    companyId: '', customerName: '', customerLastName: '', customerPhone: '',
    address: '', commune: '', aptFloor: '', note: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.companyId) return toast('❌ Selecciona una empresa');
    if (!form.customerName || !form.address) return toast('❌ Nombre y dirección requeridos');
    setSaving(true);
    try {
      await api.createPackage({
        companyId: form.companyId,
        customerName: form.customerName,
        customerLastName: form.customerLastName || undefined,
        customerPhone: form.customerPhone || undefined,
        address: form.address,
        commune: form.commune || undefined,
        aptFloor: form.aptFloor || undefined,
        note: form.note || undefined,
        routeId: null,
      });
      toast('✅ Paquete ingresado');
      onDone();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (companies.length === 0) {
    return (
      <BottomSheet title="➕ Agregar paquete" onClose={onClose}>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No hay empresas registradas</div>
          <div style={{ fontSize: 12 }}>Registra primero una empresa en la sección Empresas.</div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="➕ Agregar paquete" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <FormLabel required>🏢 Empresa</FormLabel>
          <select value={form.companyId} onChange={e => set('companyId', e.target.value)} required
            style={{ width: '100%', border: form.companyId ? '2px solid var(--accent)' : '2px solid #f59e0b', borderRadius: 10, padding: '9px 10px', fontSize: 13, outline: 'none', background: form.companyId ? '#0052FF08' : '#fff7ed', WebkitAppearance: 'none', fontWeight: 600, boxSizing: 'border-box' }}>
            <option value="">— Seleccionar empresa —</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FormLabel required>Nombre</FormLabel>
            <FormInput value={form.customerName} onChange={v => set('customerName', v)} placeholder="María" required />
          </div>
          <div style={{ flex: 1 }}>
            <FormLabel>Apellido</FormLabel>
            <FormInput value={form.customerLastName} onChange={v => set('customerLastName', v)} placeholder="González" />
          </div>
        </div>
        <div>
          <FormLabel>Teléfono</FormLabel>
          <FormInput value={form.customerPhone} onChange={v => set('customerPhone', v)} placeholder="+56912345678" type="tel" />
        </div>
        <div>
          <FormLabel required>Dirección</FormLabel>
          <FormInput value={form.address} onChange={v => set('address', v)} placeholder="Av. Providencia 1234" required />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FormLabel>Comuna</FormLabel>
            <select value={form.commune} onChange={e => set('commune', e.target.value)}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 13, outline: 'none', background: 'var(--card2)', WebkitAppearance: 'none', boxSizing: 'border-box' }}>
              <option value="">— Sin comuna —</option>
              {COMMUNES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <FormLabel>Depto / Casa</FormLabel>
            <FormInput value={form.aptFloor} onChange={v => set('aptFloor', v)} placeholder="Dpto 3B" />
          </div>
        </div>
        <div>
          <FormLabel>Nota interna</FormLabel>
          <FormInput value={form.note} onChange={v => set('note', v)} placeholder="Dejar en conserjería…" />
        </div>
        <div style={{ display: 'flex', gap: 8, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <button type="submit" disabled={saving}
            style={{ flex: 1, padding: 13, borderRadius: 11, border: 'none', background: saving ? 'var(--card2)' : 'var(--accent)', color: saving ? 'var(--muted)' : '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando…' : '✅ Crear paquete'}
          </button>
          <button type="button" onClick={onClose}
            style={{ padding: '13px 18px', borderRadius: 11, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

/* ─── Package row ─────────────────────────────────────────────────── */
function PkgRow({ pkg, routes, onMove, onStatusChange, onDelete, onEdit, onMarkReviewed, selected, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false);
  const sc         = STATUS_COLOR[pkg.status] || '#888';
  const route      = pkg.routeId;
  const driver     = route?.driverId;
  const company    = pkg.companyId;
  const noCommune  = !pkg.commune;
  const noAddrNum  = pkg.address && !/\d/.test(pkg.address.trim());
  const noPhone    = !pkg.customerPhone;
  const hasGeoErr  = noCommune || !!noAddrNum;

  return (
    <div style={{ margin: '0 8px 6px', borderRadius: 12, border: `1px solid ${selected ? 'var(--accent)' : hasGeoErr ? '#ef444430' : 'var(--border)'}`, background: selected ? '#0052FF05' : hasGeoErr ? '#fef2f2' : '#fff', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: sc, opacity: 0.8 }} />

      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px 8px 13px', gap: 8 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={e => e.stopPropagation()}
          style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0, accentColor: 'var(--accent)' }}
        />
        <div onClick={() => setExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
              {pkg.customerName} {pkg.customerLastName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pkg.address}{pkg.commune ? `, ${pkg.commune}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${sc}12`, color: sc, border: `1px solid ${sc}28` }}>
                {pkg.status.replace('-', ' ').toUpperCase()}
              </span>
              {company?.name && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#7c3aed12', color: '#7c3aed', border: '1px solid #7c3aed28' }}>
                  🏢 {company.name}
                </span>
              )}
              {route ? (
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', padding: '2px 7px', borderRadius: 20, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                  {route.routeCode}
                </span>
              ) : (
                <span style={{ fontSize: 9, fontWeight: 600, color: '#888', padding: '2px 7px', borderRadius: 20, background: '#f1f5f9', border: '1px solid #cbd5e1' }}>
                  📭 sin ruta
                </span>
              )}
              {driver && (
                <span style={{ fontSize: 9, fontWeight: 600, color: '#0077aa', padding: '2px 7px', borderRadius: 20, background: '#0077aa10', border: '1px solid #0077aa20' }}>
                  🚗 {driver.name}
                </span>
              )}
              {pkg.aiFlags?.length > 0 && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#f59e0b12', color: '#b45309', border: '1px solid #f59e0b40' }}>
                  ⚠ Revisar: {pkg.aiFlags.join(', ')}
                </span>
              )}
              {noCommune && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#ef444412', color: '#b91c1c', border: '1px solid #ef444430' }}>
                  ⛔ Sin comuna
                </span>
              )}
              {noAddrNum && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#ef444412', color: '#b91c1c', border: '1px solid #ef444430' }}>
                  ⛔ Sin número en dirección
                </span>
              )}
              {noPhone && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#f59e0b10', color: '#92400e', border: '1px solid #f59e0b28' }}>
                  📞 Sin teléfono — difícil corregir
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {pkg.createdAt && (
              <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 4, whiteSpace: 'nowrap' }}>
                {fmtDate(pkg.createdAt)}
              </div>
            )}
            <div style={{ fontSize: 16, color: 'var(--muted)', transition: 'transform .15s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</div>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '9px 10px 10px 13px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {hasGeoErr && (
            <div style={{ fontSize: 11, color: '#b91c1c', background: '#fef2f2', border: '1px solid #ef444430', borderRadius: 6, padding: '5px 8px', lineHeight: 1.5 }}>
              <b>⛔ No geocodificable</b> — corrige antes de asignar a ruta:{' '}
              {[noCommune && 'falta comuna', noAddrNum && 'falta número en dirección'].filter(Boolean).join(' · ')}
            </div>
          )}
          {noPhone && (
            <div style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', border: '1px solid #f59e0b30', borderRadius: 6, padding: '4px 8px' }}>
              📞 Sin teléfono — no podrás contactar al cliente para corregir la dirección
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>🔖 {pkg.trackingId}</span>
            {pkg.customerPhone && <a href={`tel:${pkg.customerPhone}`} style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>📞 {pkg.customerPhone}</a>}
            {pkg.aptFloor && <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 600 }}>🏢 {pkg.aptFloor}</span>}
            {pkg.price > 0 && <span style={{ fontSize: 10, color: '#0052FF', fontWeight: 700 }}>${Number(pkg.price).toLocaleString('es-CL')}</span>}
          </div>
          {pkg.aiFlags?.length > 0 && (
            <div style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', border: '1px solid #f59e0b40', borderRadius: 6, padding: '4px 8px' }}>
              ⚠ IA marcó estos campos como dudosos: <strong>{pkg.aiFlags.join(', ')}</strong> — edítalos en la vista de ruta
            </div>
          )}
          {pkg.note && <div style={{ fontSize: 11, color: '#3366cc', background: '#3b82f608', borderRadius: 6, padding: '4px 8px' }}>📝 {pkg.note}</div>}
          {pkg.failReason && <div style={{ fontSize: 11, color: 'var(--danger)' }}>↳ {pkg.failReason}</div>}

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
            {pkg.status !== 'entregado' && <ActionBtn color="#0052FF" onClick={() => onStatusChange(pkg, 'entregado')}>✅ Entregado</ActionBtn>}
            {pkg.status !== 'pendiente' && <ActionBtn color="#888" onClick={() => onStatusChange(pkg, 'pendiente')}>↩ Pendiente</ActionBtn>}
            <ActionBtn color="#0077aa" onClick={onMove}>🔀 Mover de ruta</ActionBtn>
            <ActionBtn color="#7c3aed" onClick={onEdit}>✏️ Editar</ActionBtn>
            <ActionBtn color="#e5534b" onClick={onDelete}>🗑 Eliminar</ActionBtn>
            {pkg.aiFlags?.length > 0 && (
              <ActionBtn color="#16a34a" onClick={onMarkReviewed}>✓ Marcar revisado</ActionBtn>
            )}
          </div>

          {pkg.history?.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: .5, marginBottom: 4, textTransform: 'uppercase' }}>Historial</div>
              {[...pkg.history].reverse().map((h, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--muted)', paddingBottom: 3, marginBottom: 3, borderBottom: i < pkg.history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{h.description || h.event}</span>
                  {h.at && <span style={{ marginLeft: 6 }}>· {fmtDate(h.at)}</span>}
                </div>
              ))}
            </div>
          )}

          {route && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              Ruta {route.routeCode} · {new Date(route.date).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {driver ? ` · 🚗 ${driver.name}` : ''}
            </div>
          )}
          {pkg.deliveredAt && (
            <div style={{ fontSize: 10, color: '#0052FF', fontWeight: 600 }}>✅ Entregado: {fmtDate(pkg.deliveredAt)}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── All packages table (excel-style) ──────────────────────────── */
const STATUS_COLOR_MAP = { pendiente: '#888', entregado: '#0052FF', 'no-entregado': '#cc2244', eliminado: '#c04a1a' };

function AllPkgTable({ packages, companies, routes, onMove, onStatusChange, onDelete, onEdit, onMarkReviewed, selected, onToggleSelect, allSelected, onToggleAll }) {
  const companyMap = Object.fromEntries(companies.map(c => [c._id, c.name]));
  const routeMap   = Object.fromEntries(routes.map(r => [r._id, r.routeCode]));

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 860 }}>
        <thead>
          <tr style={{ background: 'var(--card2)', position: 'sticky', top: 0, zIndex: 2, boxShadow: '0 1px 0 var(--border)' }}>
            <th style={th()}>
              <input type="checkbox" checked={allSelected} onChange={onToggleAll}
                style={{ width: 13, height: 13, cursor: 'pointer', accentColor: 'var(--accent)' }} />
            </th>
            {['#', 'Cliente', 'Dirección / Comuna', 'Teléfono', 'Empresa', 'Ruta', 'Estado', 'Precio', ''].map(h => (
              <th key={h} style={th()}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {packages.map((pkg, i) => {
            const noCommune = !pkg.commune;
            const noAddrNum = pkg.address && !/\d/.test(pkg.address.trim());
            const noPhone   = !pkg.customerPhone;
            const hasGeoErr = noCommune || !!noAddrNum;
            const hasFlags  = pkg.aiFlags?.length > 0;
            const isSel     = selected.has(pkg._id);
            const sc        = STATUS_COLOR_MAP[pkg.status] || '#888';

            const rowBg = isSel ? '#0052FF08' : hasGeoErr ? '#fef2f2' : hasFlags ? '#fffbeb' : i % 2 === 0 ? '#fff' : 'var(--card2)';
            const leftBorder = isSel ? 'var(--accent)' : hasGeoErr ? '#ef4444' : hasFlags ? '#f59e0b' : 'transparent';

            return (
              <tr key={pkg._id} style={{ background: rowBg, borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${leftBorder}` }}>

                {/* checkbox */}
                <td style={td()}>
                  <input type="checkbox" checked={isSel} onChange={() => onToggleSelect(pkg._id)}
                    style={{ width: 13, height: 13, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                </td>

                {/* # */}
                <td style={{ ...td(), color: hasGeoErr ? '#b91c1c' : 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {i + 1}
                  {hasGeoErr && <span style={{ marginLeft: 2 }} title="Sin datos para geocodificar">⛔</span>}
                  {!hasGeoErr && hasFlags && <span style={{ marginLeft: 2 }} title={`IA marcó: ${pkg.aiFlags.join(', ')}`}>⚠</span>}
                </td>

                {/* Cliente */}
                <td style={{ ...td(), minWidth: 110 }}>
                  <div style={{ fontWeight: 600, lineHeight: 1.2 }}>
                    {pkg.customerName}{pkg.customerLastName ? ` ${pkg.customerLastName}` : ''}
                  </div>
                  {hasFlags && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                      {pkg.aiFlags.map(f => (
                        <span key={f} style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 20, background: '#f59e0b12', color: '#b45309', border: '1px solid #f59e0b30' }}>
                          ⚠ {f}
                        </span>
                      ))}
                    </div>
                  )}
                </td>

                {/* Dirección / Comuna */}
                <td style={{ ...td(), minWidth: 150 }}>
                  <div style={{ color: noAddrNum ? '#b91c1c' : 'inherit', fontWeight: noAddrNum ? 600 : 'normal', lineHeight: 1.3 }}>
                    {pkg.address || <span style={{ color: 'var(--muted)' }}>—</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                    {pkg.commune
                      ? <span style={{ fontSize: 9, color: 'var(--muted)' }}>{pkg.commune}</span>
                      : <span style={{ fontSize: 9, fontWeight: 700, color: '#b91c1c', background: '#ef444412', border: '1px solid #ef444430', borderRadius: 20, padding: '1px 5px' }}>⛔ Sin comuna</span>
                    }
                    {noAddrNum && <span style={{ fontSize: 9, fontWeight: 700, color: '#b91c1c', background: '#ef444412', border: '1px solid #ef444430', borderRadius: 20, padding: '1px 5px' }}>⛔ Sin nº</span>}
                    {pkg.aptFloor && <span style={{ fontSize: 9, color: 'var(--muted)' }}>{pkg.aptFloor}</span>}
                  </div>
                </td>

                {/* Teléfono */}
                <td style={{ ...td(), minWidth: 100 }}>
                  {pkg.customerPhone
                    ? <a href={`tel:${pkg.customerPhone}`} style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>{pkg.customerPhone}</a>
                    : <span style={{ fontSize: 9, fontWeight: 700, color: '#92400e', background: '#f59e0b10', border: '1px solid #f59e0b28', borderRadius: 20, padding: '1px 5px' }}>📞 Sin tel.</span>
                  }
                </td>

                {/* Empresa */}
                <td style={{ ...td(), minWidth: 80 }}>
                  <span style={{ fontSize: 10, color: '#7c3aed' }}>
                    {companyMap[pkg.companyId] || companyMap[pkg.companyId?._id] || '—'}
                  </span>
                </td>

                {/* Ruta */}
                <td style={{ ...td(), minWidth: 70 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {routeMap[pkg.routeId] || routeMap[pkg.routeId?._id] || <span style={{ color: '#cbd5e1' }}>sin ruta</span>}
                  </span>
                </td>

                {/* Estado */}
                <td style={{ ...td(), minWidth: 90 }}>
                  <select
                    value={pkg.status}
                    onChange={e => onStatusChange(pkg, e.target.value)}
                    style={{ fontSize: 10, padding: '3px 5px', borderRadius: 7, border: '1px solid var(--border)', background: '#fff', color: sc, fontWeight: 700, cursor: 'pointer', WebkitAppearance: 'none', width: '100%' }}
                  >
                    <option value="pendiente">⏳ Pendiente</option>
                    <option value="entregado">✅ Entregado</option>
                    <option value="no-entregado">❌ No entregado</option>
                  </select>
                </td>

                {/* Precio */}
                <td style={{ ...td(), minWidth: 65, fontWeight: 700, color: '#0052FF' }}>
                  {pkg.price > 0 ? `$${Number(pkg.price).toLocaleString('es-CL')}` : <span style={{ color: 'var(--muted)', fontWeight: 400 }}>—</span>}
                </td>

                {/* Acciones */}
                <td style={{ ...td(), whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'nowrap' }}>
                    <TblBtn color="#7c3aed" onClick={() => onEdit(pkg)} title="Editar">✏️</TblBtn>
                    <TblBtn color="#0077aa" onClick={() => onMove(pkg)} title="Mover de ruta">🔀</TblBtn>
                    <TblBtn color="#e5534b" onClick={() => onDelete(pkg)} title="Eliminar">🗑</TblBtn>
                    {hasFlags && (
                      <TblBtn color="#16a34a" onClick={() => onMarkReviewed(pkg)} title="Marcar advertencias como revisadas">✓</TblBtn>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TblBtn({ color, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 6, color, cursor: 'pointer', fontSize: 12, padding: '3px 6px', lineHeight: 1 }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.color = color; }}
    >{children}</button>
  );
}

function th() {
  return { padding: '7px 8px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'var(--muted)', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)', textTransform: 'uppercase' };
}
function td() {
  return { padding: '5px 8px', verticalAlign: 'top' };
}

/* ─── Move modal ──────────────────────────────────────────────────── */
function MoveModal({ pkg, routes, targetRouteId, onSelect, onConfirm, onClose }) {
  const currentRouteId = String(pkg.routeId?._id || pkg.routeId || '');
  const otherRoutes = routes.filter(r => String(r._id) !== currentRouteId);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 900, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 30px #00000022' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>🔀 Mover paquete a otra ruta</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{pkg.customerName} {pkg.customerLastName} — {pkg.address}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Ruta actual: <b>{pkg.routeId?.routeCode || '📭 sin ruta'}</b></div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
          {otherRoutes.length === 0
            ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: 13 }}>No hay otras rutas disponibles</div>
            : otherRoutes.map(r => (
              <button key={r._id} onClick={() => onSelect(r._id)} style={{
                width: '100%', textAlign: 'left', padding: '11px 13px', marginBottom: 6, borderRadius: 11, cursor: 'pointer',
                border: targetRouteId === r._id ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: targetRouteId === r._id ? '#0052FF10' : '#fff',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: targetRouteId === r._id ? 'var(--accent)' : 'var(--text)' }}>
                  {r.routeCode}{r.name ? ` · ${r.name}` : ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {new Date(r.date).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  {r.driverId?.name ? ` · 🚗 ${r.driverId.name}` : ''}
                </div>
              </button>
            ))
          }
        </div>
        <div style={{ padding: '12px 16px calc(20px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button onClick={onConfirm} disabled={!targetRouteId}
            style={{ flex: 1, padding: 13, borderRadius: 11, border: 'none', fontSize: 13, fontWeight: 700, cursor: targetRouteId ? 'pointer' : 'not-allowed', background: targetRouteId ? 'var(--accent)' : 'var(--card2)', color: targetRouteId ? '#fff' : 'var(--muted)' }}>
            🔀 Confirmar traslado
          </button>
          <button onClick={onClose} style={{ padding: '13px 18px', borderRadius: 11, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit package modal ──────────────────────────────────────────── */
function EditPackageModal({ pkg, companies, onClose, onSave }) {
  const [form, setForm] = useState({
    customerName:     pkg.customerName     || '',
    customerLastName: pkg.customerLastName || '',
    customerPhone:    pkg.customerPhone    || '',
    address:          pkg.address          || '',
    commune:          pkg.commune          || '',
    aptFloor:         pkg.aptFloor         || '',
    price:            pkg.price            || '',
    note:             pkg.note             || '',
    status:           pkg.status           || 'pendiente',
    companyId:        pkg.companyId?._id   || pkg.companyId || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerName || !form.address) return toast('❌ Nombre y dirección son requeridos');
    setSaving(true);
    try {
      await onSave(pkg._id, {
        customerName:     form.customerName,
        customerLastName: form.customerLastName || null,
        customerPhone:    form.customerPhone    || null,
        address:          form.address,
        commune:          form.commune          || null,
        aptFloor:         form.aptFloor         || null,
        price:            Number(form.price)    || 0,
        note:             form.note             || null,
        status:           form.status,
        companyId:        form.companyId        || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet title="✏️ Editar paquete" onClose={onClose} tall>
      <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: .5 }}>
          🔖 {pkg.trackingId}
        </div>

        <div>
          <FormLabel required>🏢 Empresa</FormLabel>
          <select value={form.companyId} onChange={e => set('companyId', e.target.value)}
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 13, outline: 'none', background: 'var(--card2)', WebkitAppearance: 'none', boxSizing: 'border-box' }}>
            <option value="">— Sin empresa —</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FormLabel required>Nombre</FormLabel>
            <FormInput value={form.customerName} onChange={v => set('customerName', v)} placeholder="María" required />
          </div>
          <div style={{ flex: 1 }}>
            <FormLabel>Apellido</FormLabel>
            <FormInput value={form.customerLastName} onChange={v => set('customerLastName', v)} placeholder="González" />
          </div>
        </div>

        <div>
          <FormLabel>Teléfono</FormLabel>
          <FormInput value={form.customerPhone} onChange={v => set('customerPhone', v)} placeholder="+56912345678" type="tel" />
        </div>

        <div>
          <FormLabel required>Dirección</FormLabel>
          <FormInput value={form.address} onChange={v => set('address', v)} placeholder="Av. Providencia 1234" required />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FormLabel>Comuna</FormLabel>
            <select value={form.commune} onChange={e => set('commune', e.target.value)}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 13, outline: 'none', background: 'var(--card2)', WebkitAppearance: 'none', boxSizing: 'border-box' }}>
              <option value="">— Sin comuna —</option>
              {COMMUNES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <FormLabel>Depto / Casa</FormLabel>
            <FormInput value={form.aptFloor} onChange={v => set('aptFloor', v)} placeholder="Dpto 3B" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FormLabel>Precio</FormLabel>
            <FormInput value={form.price} onChange={v => set('price', v)} placeholder="0" type="number" />
          </div>
          <div style={{ flex: 1 }}>
            <FormLabel>Estado</FormLabel>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 13, outline: 'none', background: 'var(--card2)', WebkitAppearance: 'none', boxSizing: 'border-box' }}>
              <option value="pendiente">⏳ Pendiente</option>
              <option value="entregado">✅ Entregado</option>
              <option value="no-entregado">❌ No entregado</option>
            </select>
          </div>
        </div>

        <div>
          <FormLabel>Nota interna</FormLabel>
          <FormInput value={form.note} onChange={v => set('note', v)} placeholder="Dejar en conserjería…" />
        </div>

        <div style={{ display: 'flex', gap: 8, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <button type="submit" disabled={saving}
            style={{ flex: 1, padding: 13, borderRadius: 11, border: 'none', background: saving ? 'var(--card2)' : 'var(--accent)', color: saving ? 'var(--muted)' : '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando…' : '✅ Guardar cambios'}
          </button>
          <button type="button" onClick={onClose}
            style={{ padding: '13px 18px', borderRadius: 11, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

/* ─── Confirm delete sheet ────────────────────────────────────────── */
function ConfirmDeleteSheet({ pkg, loading, onConfirm, onClose }) {
  const isPermanent = pkg.status === 'eliminado';
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 900, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', boxShadow: '0 -4px 30px #00000022', padding: '20px 16px calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
          {isPermanent ? '⚠️ Eliminar permanentemente' : '🗑 Eliminar paquete'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
          <b style={{ color: 'var(--text)' }}>{pkg.customerName} {pkg.customerLastName}</b>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{pkg.address}{pkg.commune ? `, ${pkg.commune}` : ''}</div>
        <div style={{ fontSize: 12, color: '#e5534b', background: '#e5534b0c', border: '1px solid #e5534b28', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
          {isPermanent
            ? 'Este paquete ya está eliminado. Confirmar lo borrará permanentemente de la base de datos. Esta acción NO se puede revertir.'
            : 'El paquete quedará marcado como eliminado. Puedes revertirlo desde el filtro "Eliminados".'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{ flex: 1, padding: 13, borderRadius: 11, border: 'none', background: loading ? 'var(--card2)' : '#e5534b', color: loading ? 'var(--muted)' : '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? '⏳ Eliminando…' : isPermanent ? '⚠️ Borrar permanentemente' : '🗑 Confirmar eliminación'}
          </button>
          <button onClick={onClose} disabled={loading}
            style={{ padding: '13px 18px', borderRadius: 11, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared components ───────────────────────────────────────────── */
function BottomSheet({ title, onClose, children, tall }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 900, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: tall ? '92dvh' : '85dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 30px #00000022' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange, flagged, required, placeholder }) {
  return (
    <div>
      <div style={fieldLblStyle(flagged)}>{label}{flagged ? ' ⚠' : ''}{required ? ' *' : ''}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ''}
        style={{
          width: '100%', borderRadius: 8, padding: '6px 9px', fontSize: 12, outline: 'none',
          border: `1px solid ${flagged ? '#f59e0b' : 'var(--border)'}`,
          background: flagged ? '#fff7ed' : 'var(--card2)',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function FormLabel({ children, required }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, letterSpacing: .3 }}>
      {children}{required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
    </div>
  );
}

function FormInput({ value, onChange, placeholder, type = 'text', required }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', background: 'var(--card2)', boxSizing: 'border-box' }} />
  );
}

function ActionBtn({ color, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${color}28`, background: `${color}12`, color, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

function fieldLblStyle(flagged) {
  return { fontSize: 10, fontWeight: 700, color: flagged ? '#f59e0b' : 'var(--muted)', letterSpacing: .8, marginBottom: 3, textTransform: 'uppercase' };
}

function pageBtn(active) {
  return { padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', background: active ? 'var(--accent)' : 'var(--card2)', color: active ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: active ? 'pointer' : 'not-allowed' };
}

function selStyle(hasValue) {
  return { flex: 1, minWidth: 120, background: hasValue ? '#0052FF10' : 'var(--card2)', border: `1px solid ${hasValue ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '7px 10px', fontSize: 12, outline: 'none', color: hasValue ? 'var(--accent)' : 'var(--muted)', fontWeight: hasValue ? 700 : 400, WebkitAppearance: 'none' };
}

function actionBtn(color) {
  return { flexShrink: 0, width: 36, height: 36, borderRadius: 10, border: `1px solid ${color}30`, background: `${color}12`, color, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' };
}

function previewInput(flagged, errored = false) {
  const color = errored ? '#ef4444' : flagged ? '#f59e0b' : '#e2e8f0';
  const bg    = errored ? '#fef2f2' : flagged ? '#fff7ed' : '#fff';
  return { width: '100%', border: `1px solid ${color}`, borderRadius: 5, padding: '5px 7px', fontSize: 11, outline: 'none', background: bg, boxSizing: 'border-box', minWidth: 72 };
}
