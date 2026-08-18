import React, { useState } from 'react';
import QuotesBadgeBtn from './QuotesBadgeBtn.jsx';
import ResetDataBtn from './ResetDataBtn.jsx';
import DemoModeBtn from './DemoModeBtn.jsx';

export default function AdminMainMenu({ setView, onResetDone }) {
  const [open, setOpen] = useState(false);
  const go = (nextView) => {
    setOpen(false);
    setView(nextView);
  };
  const items = [
    { label: 'Paquetes', desc: 'Ver, mover e importar paquetes', view: 'allPackages', color: 'var(--accent)', bg: '#0052FF14' },
    { label: 'Mapa general', desc: 'Mapa, filtros y zonas de entrega', view: 'generalMap', color: '#16a34a', bg: '#22c55e14' },
    { label: 'Zonas', desc: 'Sectores y mapa de comunas', view: 'zones', color: '#5c35cc', bg: '#5c35cc14' },
    { label: 'Cobros', desc: 'Facturas y rutas por cobrar', view: 'invoices', color: '#f57c00', bg: '#fff3e0' },
    { label: 'Empresas', desc: 'Clientes, proveedores y contactos', view: 'companies', color: '#005078', bg: '#0050780e' },
    { label: 'Usuarios', desc: 'Admin, drivers y empresas', view: 'users', color: 'var(--muted)', bg: 'var(--card2)' },
    { label: 'Precios', desc: 'Fletes, mudanzas e items', view: 'movePricing', color: 'var(--accent)', bg: '#0052FF12' },
    { label: 'Precios comuna', desc: 'Tarifas de paquetería por comuna', view: 'prices', color: '#0e7490', bg: '#0e749012' },
    { label: 'API Keys',   desc: 'Credenciales de integracion',             view: 'credentials', color: '#fff', bg: 'linear-gradient(135deg, #0052FF 0%, #00DAFF 100%)' },
    { label: 'Analytics',    desc: 'Funnel de visitas del cotizador público',  view: 'analytics',   color: '#7C3AED', bg: '#7c3aed10' },
    { label: 'Presupuestos', desc: 'Generar presupuesto PDF con ítems y precios', view: 'presupuesto', color: '#0369a1', bg: '#e0f2fe' },
    { label: 'Entrena IA', desc: 'Revisar y corregir cotizaciones del cotizador público', view: 'aiTraining', color: '#7C3AED', bg: '#7c3aed10' },
  ];

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, minHeight: 34,
          border: '1px solid #0052FF30', borderRadius: 10, padding: '7px 11px',
          background: '#0052FF12', color: 'var(--accent)', fontSize: 12,
          fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>☰</span>
        Menu
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(15,23,42,.34)', display: 'flex',
            justifyContent: 'flex-end', alignItems: 'flex-start',
            padding: 'max(12px, env(safe-area-inset-top)) 10px 10px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(390px, calc(100vw - 20px))',
              maxHeight: 'calc(100dvh - 24px)',
              overflowY: 'auto',
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 18,
              boxShadow: '0 20px 70px rgba(15,23,42,.28)',
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>Menu admin</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Todas las opciones en un solo lugar</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menu"
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card2)',
                  color: 'var(--muted)', fontSize: 18, fontWeight: 800, cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <QuotesBadgeBtn onClick={() => go('quotes')} wide />
              {items.map(item => (
                <button
                  key={item.view}
                  onClick={() => go(item.view)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    background: item.bg,
                    color: item.color === '#fff' ? '#fff' : 'var(--text)',
                    padding: '11px 12px',
                    cursor: 'pointer',
                    boxShadow: item.color === '#fff' ? '0 8px 18px #0052ff24' : 'none',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, color: item.color }}>{item.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: item.color === '#fff' ? 'rgba(255,255,255,.86)' : 'var(--muted)', marginTop: 2 }}>
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DemoModeBtn onDone={() => { setOpen(false); onResetDone?.(); }} wide />
              <ResetDataBtn onDone={() => { setOpen(false); onResetDone?.(); }} wide />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
