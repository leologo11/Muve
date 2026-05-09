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

        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 6, letterSpacing: .5 }}>
          {loading ? 'Cargando…' : `${total} paquete${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
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
        ) : (
          packages.map(pkg => (
            <PkgRow
              key={pkg._id}
              pkg={pkg}
              routes={routes}
              onMove={() => setMoveTarget({ pkg, targetRouteId: '' })}
              onStatusChange={handleStatusChange}
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

  /* ── Edit individual field ── */
  const setField = (idx, field, val) =>
    setPreview(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));

  /* ── Remove package from preview ── */
  const remove = (idx) => setPreview(prev => prev.filter((_, i) => i !== idx));

  /* ── Save all ── */
  const handleConfirm = async () => {
    if (!preview.length || !companyId) return;
    setSaving(true);
    try {
      const clean = preview.map(({ _id, _flags, _suggestedPrice, ...rest }) => rest);
      const res = await api.importPoolConfirm(clean, companyId);
      toast(`✅ ${res.count} paquete${res.count !== 1 ? 's' : ''} ingresado${res.count !== 1 ? 's' : ''}`);
      onDone();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const flagCount = preview.filter(p => p._flags?.length > 0).length;

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
            <div style={{ padding: '8px 16px 6px', flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', flex: 1 }}>
                {preview.length} paquete{preview.length !== 1 ? 's' : ''} detectado{preview.length !== 1 ? 's' : ''}
              </div>
              {flagCount > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: '#f59e0b12', border: '1px solid #f59e0b30', borderRadius: 20, padding: '2px 10px' }}>
                  ⚠ {flagCount} con datos dudosos — revisa antes de confirmar
                </div>
              )}
              <button
                onClick={() => { setStage('upload'); setPreview([]); }}
                style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                ← Cambiar archivo
              </button>
            </div>

            {/* Editable package cards */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 4px' }}>
              {preview.map((pkg, idx) => {
                const flags = pkg._flags || [];
                const hasFlags = flags.length > 0;
                return (
                  <div key={pkg._id} style={{
                    border: `1px solid ${hasFlags ? '#f59e0b' : 'var(--border)'}`,
                    borderRadius: 12, padding: '10px 12px', marginBottom: 8,
                    background: hasFlags ? '#fff7ed' : '#fff',
                  }}>
                    {/* Card header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', background: 'var(--card2)', borderRadius: 20, padding: '2px 8px' }}>
                          #{idx + 1}
                        </span>
                        {hasFlags && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>
                            ⚠ Revisar: {flags.join(', ')}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => remove(idx)}
                        style={{ background: 'none', border: 'none', color: '#cc2244', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                        title="Eliminar este paquete"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Editable fields grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <EditField
                        label="Nombre"
                        value={pkg.customerName || ''}
                        onChange={v => setField(idx, 'customerName', v)}
                        flagged={flags.includes('customerName')}
                      />
                      <EditField
                        label="Apellido"
                        value={pkg.customerLastName || ''}
                        onChange={v => setField(idx, 'customerLastName', v)}
                        flagged={flags.includes('customerLastName')}
                      />
                      <div style={{ gridColumn: '1/-1' }}>
                        <EditField
                          label="Dirección"
                          value={pkg.address || ''}
                          onChange={v => setField(idx, 'address', v)}
                          flagged={flags.includes('address')}
                          required
                        />
                      </div>
                      <EditField
                        label="Teléfono"
                        value={pkg.customerPhone || ''}
                        onChange={v => setField(idx, 'customerPhone', v)}
                        flagged={flags.includes('customerPhone')}
                        placeholder="+56912345678"
                      />
                      <div>
                        <div style={fieldLblStyle(flags.includes('commune'))}>
                          Comuna{flags.includes('commune') ? ' ⚠' : ''}
                        </div>
                        <select
                          value={pkg.commune || ''}
                          onChange={e => setField(idx, 'commune', e.target.value)}
                          style={{
                            width: '100%', borderRadius: 8, padding: '6px 8px', fontSize: 12, outline: 'none',
                            border: `1px solid ${flags.includes('commune') ? '#f59e0b' : 'var(--border)'}`,
                            background: flags.includes('commune') ? '#fff7ed' : 'var(--card2)',
                            WebkitAppearance: 'none',
                          }}
                        >
                          <option value="">— Sin comuna —</option>
                          {COMMUNES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <EditField
                        label="Depto / Casa / Piso"
                        value={pkg.aptFloor || ''}
                        onChange={v => setField(idx, 'aptFloor', v)}
                        flagged={flags.includes('aptFloor')}
                        placeholder="Dpto 3B"
                      />
                    </div>
                  </div>
                );
              })}
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
function PkgRow({ pkg, routes, onMove, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_COLOR[pkg.status] || '#888';
  const route = pkg.routeId;
  const driver = route?.driverId;
  const company = pkg.companyId;

  return (
    <div style={{ margin: '0 8px 6px', borderRadius: 12, border: '1px solid var(--border)', background: '#fff', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: sc, opacity: 0.8 }} />

      <div onClick={() => setExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 13px', cursor: 'pointer' }}>
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

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '9px 10px 10px 13px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>🔖 {pkg.trackingId}</span>
            {pkg.customerPhone && <a href={`tel:${pkg.customerPhone}`} style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>📞 {pkg.customerPhone}</a>}
            {pkg.aptFloor && <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 600 }}>🏢 {pkg.aptFloor}</span>}
            {pkg.price > 0 && <span style={{ fontSize: 10, color: '#0052FF', fontWeight: 700 }}>${Number(pkg.price).toLocaleString('es-CL')}</span>}
          </div>
          {pkg.note && <div style={{ fontSize: 11, color: '#3366cc', background: '#3b82f608', borderRadius: 6, padding: '4px 8px' }}>📝 {pkg.note}</div>}
          {pkg.failReason && <div style={{ fontSize: 11, color: 'var(--danger)' }}>↳ {pkg.failReason}</div>}

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
            {pkg.status !== 'entregado' && <ActionBtn color="#0052FF" onClick={() => onStatusChange(pkg, 'entregado')}>✅ Entregado</ActionBtn>}
            {pkg.status !== 'pendiente' && <ActionBtn color="#888" onClick={() => onStatusChange(pkg, 'pendiente')}>↩ Pendiente</ActionBtn>}
            <ActionBtn color="#0077aa" onClick={onMove}>🔀 Mover de ruta</ActionBtn>
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
