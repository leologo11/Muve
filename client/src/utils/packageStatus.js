// Single source of truth for package status color/label/icon — used to be duplicated
// (and inconsistent) across AllPackagesView, PackageTable, and a second literal copy
// inside AllPackagesView itself, none of which agreed on colors or included 'devuelto'.
export const PACKAGE_STATUS = {
  pendiente:      { color: 'var(--muted)',    bg: 'var(--card2)',       label: 'Pendiente',     icon: '⏳' },
  entregado:      { color: 'var(--accent)',   bg: 'var(--accent-dim)',  label: 'Entregado',     icon: '✅' },
  'no-entregado': { color: 'var(--danger)',   bg: 'var(--danger-dim)',  label: 'No entregado',  icon: '❌' },
  devuelto:       { color: 'var(--devuelto)', bg: 'var(--devuelto-dim)', label: 'Devuelto',     icon: '📦' },
  eliminado:      { color: 'var(--elim)',     bg: 'var(--elim-dim)',    label: 'Eliminado',     icon: '🗑️' },
};

export function packageStatusColor(status) {
  return PACKAGE_STATUS[status]?.color || 'var(--muted)';
}

export function packageStatusLabel(status, { withIcon = true } = {}) {
  const s = PACKAGE_STATUS[status];
  if (!s) return status;
  return withIcon ? `${s.icon} ${s.label}` : s.label;
}
