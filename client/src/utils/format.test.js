import { describe, it, expect } from 'vitest';
import { formatCLP } from './format.js';

describe('formatCLP', () => {
  it('formats thousands with Chilean locale separators', () => {
    expect(formatCLP(1234567)).toBe((1234567).toLocaleString('es-CL'));
  });
  it('treats null/undefined as zero', () => {
    expect(formatCLP(null)).toBe('0');
    expect(formatCLP(undefined)).toBe('0');
  });
});
