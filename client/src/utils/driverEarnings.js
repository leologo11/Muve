// Safely extract YYYY-MM-DD from any date format (DATE, TIMESTAMPTZ, null).
// Falls back to parsing routeCode RT-YYYYMMDD-XXXX when the date field is missing.
export function routeDateISO(route) {
  const raw = route?.date;
  if (raw) {
    const s = String(raw).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  const m = String(route?.routeCode || '').match(/^RT-(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function parseDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T12:00');
  return isNaN(d.getTime()) ? null : d;
}

// Returns the Tuesday that starts the week containing the given ISO date string.
export function weekStart(iso) {
  const d = parseDate(iso);
  if (!d) return new Date(0);
  const dow = d.getDay();
  const back = (dow - 2 + 7) % 7;
  d.setDate(d.getDate() - back);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekLabel(tue) {
  const mon = new Date(tue);
  mon.setDate(tue.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${tue.toLocaleDateString('es-CL', opts)} – ${mon.toLocaleDateString('es-CL', opts)}`;
}

export function groupByWeek(routes) {
  const weeks = {};
  routes.forEach(r => {
    const iso = routeDateISO(r);
    const ws = weekStart(iso);
    const key = ws.getTime();
    if (!weeks[key]) weeks[key] = { tuesday: ws, routes: [] };
    weeks[key].routes.push(r);
  });
  return Object.values(weeks)
    .filter(w => w.tuesday.getTime() > 0)
    .sort((a, b) => b.tuesday - a.tuesday);
}

// A package counts toward the driver's payable total once its outcome is settled,
// so payouts don't hinge on the customer accepting delivery. An admin can reject a
// package's pay explicitly (deliveryMeta.payStatus) — that overrides everything else,
// so a rejected package never counts as payable regardless of its delivery status.
export function isPayableForDriver(pkg) {
  if (pkg.deliveryMeta?.payStatus === 'rejected') return false;
  if (pkg.status === 'entregado') return true;
  if (pkg.status === 'no-entregado') return Boolean(pkg.failReason);
  if (pkg.status === 'devuelto') return Boolean(pkg.failReason || pkg.note);
  return false;
}

// Single source of truth for driver payout math. Pass `packages` when the active
// route's packages are already loaded (more precise); omit to fall back to the
// route's synced `stats` (used by list/summary screens that never load packages).
export function computeRouteEarnings(route, packages = null) {
  const settlement = route?.driverSettlement || {};
  const base = Number(route?.driverPayout || settlement.baseAmount || 0);

  let delivered, payable, total, incidents;
  if (packages) {
    const active = packages.filter(p => p.status !== 'eliminado');
    delivered = active.filter(p => p.status === 'entregado').length;
    payable = active.filter(isPayableForDriver).length;
    total = active.length;
    incidents = active.filter(p => p.status === 'no-entregado').length;
  } else {
    delivered = Number(route?.stats?.delivered ?? 0);
    incidents = Number(route?.stats?.failed ?? 0);
    payable = delivered + incidents;
    total = Number(route?.stats?.total ?? 0);
  }

  const ratio = total ? payable / total : 0;
  const status = settlement.status || 'pending';
  const approved = Number(settlement.approvedAmount || 0);
  const adjustment = Number(settlement.adjustment || 0);
  const mode = settlement.mode || 'proportional_delivered';
  const suggested = mode === 'fixed'
    ? base
    : mode === 'manual'
      ? (approved || base)
      : Math.round(base * ratio);
  const isFinal = ['approved', 'paid'].includes(status) && approved > 0;
  const earned = Math.max(0, isFinal ? approved : suggested + adjustment);

  return {
    base, delivered, payable, incidents, total, adjustment, status, isFinal, earned,
    pricePerPkg: total ? Math.round(base / total) : 0,
  };
}

// Sums `earned` across routes whose date falls on/after `fromDate` (a Date, e.g. weekStart(todayISO)).
export function sumWeekEarnings(routes, fromDate) {
  return routes.reduce((sum, r) => {
    const iso = routeDateISO(r);
    if (!iso) return sum;
    const rd = parseDate(iso);
    if (!rd || rd < fromDate) return sum;
    return sum + computeRouteEarnings(r).earned;
  }, 0);
}
