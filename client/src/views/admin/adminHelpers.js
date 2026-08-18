// Pure constants/helpers shared across the admin view components that used to all
// live inline inside the single AdminView.jsx file.

export const STATUS_META = {
  draft:      { label: 'Borrador',   color: 'var(--muted)',   bg: 'var(--card2)' },
  active:     { label: '● Activa',   color: 'var(--accent)',  bg: '#0052FF12' },
  paused:     { label: '⏸ Pausada',  color: '#f57c00',        bg: '#f57c0012' },
  completed:  { label: '✓ Completada', color: '#0077aa',      bg: '#0077aa12' },
  cancelled:  { label: 'Cancelada',  color: 'var(--danger)',  bg: '#cc224412' }
};

export function actBtn(color) {
  return { padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${color}30`, background: `${color}12`, color };
}

export const RESET_TARGETS = [
  { id: 'routes',    label: 'Rutas y paquetes',     desc: 'Elimina todas las rutas y sus paquetes' },
  { id: 'quotes',    label: 'Cotizaciones',          desc: 'Elimina todas las cotizaciones (flete/mensajería)' },
  { id: 'tariffs',   label: 'Tarifas',               desc: 'Elimina tarifas y sus ítems de precios' },
  { id: 'prices',    label: 'Precios por comuna',    desc: 'Elimina la configuración de precios por zona' },
  { id: 'zones',     label: 'Zonas geográficas',     desc: 'Elimina los polígonos de zonas' },
  { id: 'companies', label: 'Empresas / clientes',   desc: 'Elimina todos los registros de empresas' },
];

export const DEMO_ARCHIVE_KEY = 'muve_demo_archive';
