import React, { useState } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/Toast.jsx';
import { DEMO_ARCHIVE_KEY } from './adminHelpers.js';

export default function DemoModeBtn({ onDone, wide = false }) {
  const [busy, setBusy] = useState(false);
  const [archived, setArchived] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DEMO_ARCHIVE_KEY) || 'null'); } catch { return null; }
  });

  const handleEnter = async () => {
    if (!window.confirm('Esto archivará TODOS los paquetes y rutas activos para que el sistema se vea limpio en la demo. Todo lo que crees DESPUÉS (durante la demo) se archivará automáticamente cuando salgas de modo demo, y tu entorno actual volverá intacto. ¿Continuar?')) return;
    setBusy(true);
    try {
      const routes = await api.getRoutes();
      const routesToArchive = routes.filter(r => r.status !== 'cancelled');
      const { ids: packageIds } = await api.demoArchivePackages();
      await Promise.all(routesToArchive.map(r => api.deleteRoute(r._id)));
      const snapshot = {
        packageIds,
        routes: routesToArchive.map(r => ({ id: r._id, status: r.status })),
        at: new Date().toISOString(),
      };
      localStorage.setItem(DEMO_ARCHIVE_KEY, JSON.stringify(snapshot));
      setArchived(snapshot);
      toast(`🎬 Modo demo activado: ${packageIds.length} paquetes y ${routesToArchive.length} rutas archivados`);
      onDone?.();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleExit = async () => {
    if (!archived) return;
    if (!window.confirm('Vas a salir de modo demo: todo lo que creaste durante la demo se va a archivar (oculto, no se pierde) y tu entorno de antes va a volver tal como estaba. ¿Continuar?')) return;
    setBusy(true);
    try {
      // Everything currently active is what got created DURING the demo (the pre-demo data is already archived).
      const routesNow = await api.getRoutes();
      const demoRouteIds = routesNow.filter(r => r.status !== 'cancelled').map(r => r._id);
      await api.demoArchivePackages();
      await Promise.all(demoRouteIds.map(id => api.deleteRoute(id)));

      // Bring back exactly what was archived on entry.
      await api.demoRestorePackages(archived.packageIds);
      await Promise.all(archived.routes.map(r => api.updateRoute(r.id, { status: r.status })));

      localStorage.removeItem(DEMO_ARCHIVE_KEY);
      setArchived(null);
      toast('🚪 Modo demo cerrado — tu entorno normal está de vuelta');
      onDone?.();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  if (archived) {
    return (
      <button
        onClick={handleExit}
        disabled={busy}
        style={{ background: '#0e749008', border: '1px solid #0e749030', borderRadius: wide ? 12 : 8, padding: wide ? '11px 12px' : '4px 10px', fontSize: wide ? 13 : 11, fontWeight: wide ? 900 : 700, color: '#0e7490', cursor: busy ? 'not-allowed' : 'pointer', width: wide ? '100%' : 'auto', textAlign: wide ? 'left' : 'center' }}
      >
        {busy ? '⏳ Cerrando modo demo…' : `🚪 Salir de modo demo (restaura ${archived.packageIds.length} paq. · ${archived.routes.length} rutas)`}
        {wide && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>Archiva lo que hiciste en la demo y trae de vuelta tu entorno normal</div>}
      </button>
    );
  }

  return (
    <button
      onClick={handleEnter}
      disabled={busy}
      style={{ background: '#7c3aed08', border: '1px solid #7c3aed30', borderRadius: wide ? 12 : 8, padding: wide ? '11px 12px' : '4px 10px', fontSize: wide ? 13 : 11, fontWeight: wide ? 900 : 700, color: '#7c3aed', cursor: busy ? 'not-allowed' : 'pointer', width: wide ? '100%' : 'auto', textAlign: wide ? 'left' : 'center' }}
    >
      {busy ? '⏳ Archivando…' : '🎬 Entrar a modo demo'}
      {wide && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>Oculta tus paquetes y rutas actuales para dejar el sistema limpio</div>}
    </button>
  );
}
