import { describe, expect, it } from 'vitest';
import { dcAndRms, dmmReading } from './dmm';

describe('dmmReading', () => {
  it('autoranges like a 3½-digit meter', () => {
    // 1999 counts: 1,234 V keeps three decimals, 4,523 V goes to the 20 V range
    expect(dmmReading(1.234, 'V')).toEqual({ digits: ' 1.234', unit: 'V', overload: false });
    expect(dmmReading(4.523, 'V').digits).toBe(' 4.52');
    expect(dmmReading(12.346, 'V').digits).toBe(' 12.35');
    expect(dmmReading(127.3, 'V').digits).toBe(' 127.3');
    expect(dmmReading(0.0255, 'A')).toEqual({ digits: ' 25.5', unit: 'mA', overload: false });
    expect(dmmReading(0.01534, 'A').digits).toBe(' 15.34');
    expect(dmmReading(0.1234, 'V')).toEqual({ digits: ' 123.4', unit: 'mV', overload: false });
    expect(dmmReading(-1.5, 'V').digits).toBe('-1.500');
  });

  it('shows zero on the 2 V range and OL above the top range', () => {
    expect(dmmReading(0, 'V').digits).toBe(' 0.000');
    expect(dmmReading(2500, 'V').overload).toBe(true);
    expect(dmmReading(Number.NaN, 'V').overload).toBe(true);
  });

  it('stops at the 200 mV and 200 µA ranges, so leakage reads as zero', () => {
    expect(dmmReading(1.2e-8, 'A')).toEqual({ digits: ' 0.000', unit: 'A', overload: false });
    expect(dmmReading(3e-6, 'A')).toEqual({ digits: ' 3.0', unit: 'µA', overload: false });
    expect(dmmReading(0.0123, 'V')).toEqual({ digits: ' 12.3', unit: 'mV', overload: false });
  });
});

describe('dcAndRms', () => {
  it('separates the DC level from the AC part', () => {
    const n = 1000;
    const values = Array.from({ length: n }, (_, i) => 2 + 10 * Math.sin((2 * Math.PI * i) / n));
    const { mean, rms } = dcAndRms(values);
    expect(mean).toBeCloseTo(2, 6);
    expect(rms).toBeCloseTo(10 / Math.SQRT2, 3);
  });
});
