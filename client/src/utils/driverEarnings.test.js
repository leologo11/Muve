import { describe, it, expect } from 'vitest';
import { computeRouteEarnings, isPayableForDriver, weekStart, sumWeekEarnings } from './driverEarnings.js';

describe('isPayableForDriver', () => {
  it('counts entregado as payable', () => {
    expect(isPayableForDriver({ status: 'entregado' })).toBe(true);
  });
  it('counts no-entregado as payable only with a failReason', () => {
    expect(isPayableForDriver({ status: 'no-entregado' })).toBe(false);
    expect(isPayableForDriver({ status: 'no-entregado', failReason: 'no había nadie' })).toBe(true);
  });
  it('counts devuelto as payable only with a failReason or note', () => {
    expect(isPayableForDriver({ status: 'devuelto' })).toBe(false);
    expect(isPayableForDriver({ status: 'devuelto', note: 'cliente rechazó' })).toBe(true);
  });
  it('never counts pendiente as payable', () => {
    expect(isPayableForDriver({ status: 'pendiente' })).toBe(false);
  });
  it('excludes a package the admin explicitly rejected for pay, even if delivered', () => {
    expect(isPayableForDriver({ status: 'entregado', deliveryMeta: { payStatus: 'rejected' } })).toBe(false);
  });
});

describe('computeRouteEarnings', () => {
  it('falls back to route.stats when no packages are loaded', () => {
    const route = { driverPayout: 10000, stats: { total: 4, delivered: 3, failed: 1 } };
    const pay = computeRouteEarnings(route);
    expect(pay.base).toBe(10000);
    expect(pay.payable).toBe(4); // delivered + failed
    expect(pay.earned).toBe(10000); // 100% payable -> full base
  });

  it('computes proportionally from loaded packages when provided', () => {
    const route = { driverPayout: 10000 };
    const packages = [
      { status: 'entregado' },
      { status: 'entregado' },
      { status: 'pendiente' },
      { status: 'eliminado' }, // excluded from `active`
    ];
    const pay = computeRouteEarnings(route, packages);
    expect(pay.total).toBe(3); // eliminado excluded
    expect(pay.payable).toBe(2);
    expect(pay.earned).toBe(Math.round(10000 * 2 / 3));
  });

  it('uses the approved settlement amount once finalized, ignoring the suggested figure', () => {
    const route = {
      driverPayout: 10000,
      driverSettlement: { status: 'approved', approvedAmount: 7500 },
      stats: { total: 4, delivered: 4, failed: 0 },
    };
    const pay = computeRouteEarnings(route);
    expect(pay.isFinal).toBe(true);
    expect(pay.earned).toBe(7500);
  });

  it('never returns a negative amount', () => {
    const route = { driverPayout: 1000, driverSettlement: { adjustment: -5000 }, stats: { total: 1, delivered: 1, failed: 0 } };
    const pay = computeRouteEarnings(route);
    expect(pay.earned).toBe(0);
  });
});

describe('sumWeekEarnings', () => {
  it('only sums routes on/after the given week start', () => {
    const routes = [
      { routeCode: 'RT-20260101-AAAA', driverPayout: 5000, stats: { total: 1, delivered: 1, failed: 0 } },
      { routeCode: 'RT-20260601-BBBB', driverPayout: 3000, stats: { total: 1, delivered: 1, failed: 0 } },
    ];
    const from = weekStart('2026-05-01');
    const total = sumWeekEarnings(routes, from);
    expect(total).toBe(3000);
  });
});
