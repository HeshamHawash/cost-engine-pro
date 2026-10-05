import { describe, it, expect } from 'vitest';
import { normalizeUnit, calculateResourceMetrics, formatPriceHelper } from './helpers';
import { STANDARD_UNITS } from './constants';

describe('normalizeUnit', () => {
  it('returns default option when unit is undefined or empty', () => {
    expect(normalizeUnit(undefined, STANDARD_UNITS)).toBe(STANDARD_UNITS[0]);
    expect(normalizeUnit(null, STANDARD_UNITS)).toBe(STANDARD_UNITS[0]);
  });

  it('matches exact units regardless of casing', () => {
    expect(normalizeUnit('M3', STANDARD_UNITS)).toBe('m3');
    expect(normalizeUnit('KG', STANDARD_UNITS)).toBe('kg');
    expect(normalizeUnit('l', STANDARD_UNITS)).toBe('L');
  });

  it('correctly normalizes fuzzy variations', () => {
    expect(normalizeUnit('cubic meters', STANDARD_UNITS)).toBe('m3');
    expect(normalizeUnit('cum', STANDARD_UNITS)).toBe('m3');
    expect(normalizeUnit('m³', STANDARD_UNITS)).toBe('m3');
    expect(normalizeUnit('square meters', STANDARD_UNITS)).toBe('m2');
    expect(normalizeUnit('sqm', STANDARD_UNITS)).toBe('m2');
    expect(normalizeUnit('m²', STANDARD_UNITS)).toBe('m2');
    expect(normalizeUnit('kilograms', STANDARD_UNITS)).toBe('kg');
    expect(normalizeUnit('kgs', STANDARD_UNITS)).toBe('kg');
    expect(normalizeUnit('hours', STANDARD_UNITS)).toBe('hr');
    expect(normalizeUnit('hrs', STANDARD_UNITS)).toBe('hr');
    expect(normalizeUnit('lump sum', STANDARD_UNITS)).toBe('ls');
  });

  it('falls back to default if unmatched', () => {
    expect(normalizeUnit('unknown_unit_xyz', STANDARD_UNITS)).toBe(STANDARD_UNITS[0]);
  });
});

describe('calculateResourceMetrics', () => {
  describe('Material Resources', () => {
    it('calculates material unit cost and total quantity with waste and single usage', () => {
      // 100 m3 of concrete, consumption 1.05 m3 per 1 unit of BOQ, 5% waste, 1 usage, 250 USD/m3
      const metrics = calculateResourceMetrics(
        100, // boqQty
        {
          type: 'Material',
          consumption: 1.05,
          wastePercentage: 5,
          usages: 1,
          unitPrice: 250,
          conversionFactor: 1
        },
        8, // workingHours
        6, // workingDays
        1, // productivity
        1  // conv rate
      );

      // consumption * (1 + 0.05) / 1 = 1.05 * 1.05 = 1.1025
      // unitCost = 1.1025 * 250 = 275.625
      expect(metrics.unitCost).toBeCloseTo(275.625, 4);
      // totalQuantity = 100 * 1 * 1.1025 = 110.25
      expect(metrics.totalQuantity).toBeCloseTo(110.25, 4);
    });

    it('accounts for multiple usages (e.g. formwork shuttering)', () => {
      // Plywood formwork used 4 times
      const metrics = calculateResourceMetrics(
        50,
        {
          type: 'Material',
          consumption: 1.2,
          wastePercentage: 10,
          usages: 4,
          unitPrice: 40,
          conversionFactor: 1
        },
        8,
        6,
        1,
        1
      );

      // (1.2 * 1.10 / 4) = 0.33
      // unitCost = 0.33 * 40 = 13.2
      expect(metrics.unitCost).toBeCloseTo(13.2, 4);
      // totalQuantity = 50 * 0.33 = 16.5
      expect(metrics.totalQuantity).toBeCloseTo(16.5, 4);
    });
  });

  describe('Labor & Equipment Resources', () => {
    it('calculates hourly labor correctly given productivity and crew count', () => {
      // BOQ Qty: 100 m2. Productivity: 20 m2/day.
      // Days required: 100 / 20 = 5 days.
      // Working hours: 8 hr/day. Crew count: 2.
      // Total hours: 5 days * 8 hr/day * 2 workers = 80 hours.
      // Rate: 30 USD/hr.
      // Total cost: 80 * 30 = 2400 USD.
      // Unit cost: 2400 / 100 = 24 USD/m2.
      const metrics = calculateResourceMetrics(
        100,
        {
          type: 'Labor',
          unit: 'hr',
          resourceCount: 2,
          unitPrice: 30,
          conversionFactor: 1
        },
        8,  // working hours
        6,  // working days
        20, // productivity: 20 m2 per day
        1   // conv rate
      );

      expect(metrics.totalQuantity).toBe(80);
      expect(metrics.unitCost).toBe(24);
    });

    it('calculates daily equipment costs correctly', () => {
      // BOQ Qty: 50 m3. Productivity: 10 m3/day -> 5 days required.
      // Unit: 'day'. Machine count: 1.
      // Rate: 500 USD/day.
      // Total quantity = 5 days * 1 machine = 5 days.
      // Unit cost = (5 * 500) / 50 = 50 USD/m3.
      const metrics = calculateResourceMetrics(
        50,
        {
          type: 'Equipment',
          unit: 'day',
          resourceCount: 1,
          unitPrice: 500,
          conversionFactor: 1
        },
        8,
        6,
        10,
        1
      );

      expect(metrics.totalQuantity).toBe(5);
      expect(metrics.unitCost).toBe(50);
    });

    it('handles zero BOQ quantity safely', () => {
      const metrics = calculateResourceMetrics(
        0,
        {
          type: 'Labor',
          unit: 'hr',
          resourceCount: 1,
          unitPrice: 25
        },
        8,
        6,
        10,
        1
      );

      expect(metrics.totalQuantity).toBe(0);
      expect(metrics.unitCost).toBeGreaterThan(0);
    });
  });
});

describe('formatPriceHelper', () => {
  it('formats positive numbers with 2 decimals and currency symbol', () => {
    const formatted = formatPriceHelper(1234.5, '$');
    expect(formatted).toContain('$');
    expect(formatted).toContain('1,234.50');
  });

  it('handles 0 and null safely', () => {
    expect(formatPriceHelper(0, 'SAR')).toContain('SAR 0.00');
    expect(formatPriceHelper(null, 'SAR')).toContain('SAR 0.00');
    expect(formatPriceHelper(undefined, 'USD')).toContain('USD 0.00');
  });
});
