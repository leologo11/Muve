import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';

export default function PoolAssignModal({ route, onClose, onAssigned }) {
  const [packages, setPackages]     = useState([]);
  const [companies, setCompanies]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [companyF, setCompanyF]     = useState('');
  const [selected, setSelected]     = useState(new Set());
  const [assigning, setAssigning]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pkgs = await api.getPoolPackages({ search: search || undefined, companyId: companyF || undefined });
      setPackages(pkgs);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [search, companyF]);

  useEffect(() => {
    api.getCompanies().then(setCompanies).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setAssigning(true);
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => api.updatePackage(id, { routeId: route._id })));
      toast(`✅ ${ids.length} paquete${ids.length !== 1 ? 's' : ''} asignado${ids.length !== 1 ? 's' : ''} a ${route.routeCode}`);
      onAssigned();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 900, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 30px #00000022' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>📦 Asignar paquetes del pool</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Ruta <b>{route.routeCode}</b>{route.name ? ` · ${route.name}` : ''} — selecciona los paquetes a agregar
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Buscar nombre, dirección, tracking…"
              style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 20, padding: '7px 12px', fontSize: 12, outline: 'none' }}
            />
            {companies.length > 0 && (
              <select
                value={companyF}
                onChange={e => setCompanyF(e.target.value)}
                style={{ background: companyF ? '#0052FF10' : 'var(--card2)', border: `1px solid ${companyF ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '7px 10px', fontSize: 12, outline: 'none', color: companyF ? 'var(--accent)' : 'var(--muted)', fontWeight: companyF ? 700 : 400, WebkitAppearance: 'none' }}
              >
                <option value="">🏢 Todas</option>
                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            )}
          </div>

          {/* Count */}
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 6, letterSpacing: .4 }}>
            {loading ? 'Cargando…' : `${packages.length} paquete${packages.length !== 1 ? 's' : ''} en el pool`}
            {selected.size > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>· {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>}
          </div>
        </div>

        {/* Package list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)', fontSize: 13 }}>Cargando pool…</div>
          ) : packages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              {search || companyF ? 'Sin resultados para este filtro' : 'No hay paquetes sin asignar en el pool'}
              <div style={{ fontSize: 11, marginTop: 6 }}>Ingresa paquetes desde la sección Paquetes primero</div>
            </div>
          ) : (
            packages.map(pkg => {
              const isSel = selected.has(pkg._id);
              const company = pkg.companyId;
              return (
                <div
                  key={pkg._id}
                  onClick={() => toggle(pkg._id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', marginBottom: 6, borderRadius: 11, cursor: 'pointer',
                    border: isSel ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: isSel ? '#0052FF08' : '#fff',
                    transition: 'all .1s',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: isSel ? 'var(--accent)' : 'var(--card2)',
                    border: `2px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#fff',
                  }}>
                    {isSel && '✓'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
                      {pkg.customerName} {pkg.customerLastName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pkg.address}{pkg.commune ? `, ${pkg.commune}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                      {company?.name && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: '#7c3aed12', color: '#7c3aed', border: '1px solid #7c3aed28' }}>
                          🏢 {company.name}
                        </span>
                      )}
                      {pkg.commune && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', padding: '1px 6px', borderRadius: 20, background: 'var(--card2)', border: '1px solid var(--border)' }}>
                          {pkg.commune}
                        </span>
                      )}
                      {pkg.price > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#0052FF' }}>
                          ${Number(pkg.price).toLocaleString('es-CL')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px calc(20px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button
            onClick={handleAssign}
            disabled={selected.size === 0 || assigning}
            style={{
              flex: 1, padding: 13, borderRadius: 11, border: 'none', fontSize: 13, fontWeight: 700,
              cursor: selected.size > 0 && !assigning ? 'pointer' : 'not-allowed',
              background: selected.size > 0 && !assigning ? 'var(--accent)' : 'var(--card2)',
              color: selected.size > 0 && !assigning ? '#fff' : 'var(--muted)',
            }}
          >
            {assigning
              ? 'Asignando…'
              : selected.size === 0
                ? 'Selecciona paquetes'
                : `📦 Asignar ${selected.size} paquete${selected.size !== 1 ? 's' : ''} a ${route.routeCode}`
            }
          </button>
          <button onClick={onClose} style={{ padding: '13px 18px', borderRadius: 11, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
