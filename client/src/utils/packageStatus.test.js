import { describe, it, expect } from 'vitest';
import { PACKAGE_STATUS, packageStatusColor, packageStatusLabel } from './packageStatus.js';

describe('PACKAGE_STATUS', () => {
  it('covers every real package status, including devuelto', () => {
    for (const status of ['pendiente', 'entregado', 'no-entregado', 'devuelto', 'eliminado']) {
      expect(PACKAGE_STATUS[status]).toBeDefined();
    }
  });
});

describe('packageStatusColor', () => {
  it('returns the color for a known status', () => {
    expect(packageStatusColor('entregado')).toBe('var(--accent)');
    expect(packageStatusColor('devuelto')).toBe('var(--devuelto)');
  });
  it('falls back to var(--muted) for an unknown status', () => {
    expect(packageStatusColor('algo-inventado')).toBe('var(--muted)');
  });
});

describe('packageStatusLabel', () => {
  it('includes the icon by default', () => {
    expect(packageStatusLabel('entregado')).toBe('✅ Entregado');
  });
  it('omits the icon when withIcon is false', () => {
    expect(packageStatusLabel('entregado', { withIcon: false })).toBe('Entregado');
  });
  it('returns the raw status string for an unknown status', () => {
    expect(packageStatusLabel('algo-inventado')).toBe('algo-inventado');
  });
});
