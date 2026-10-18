import { describe, expect, it } from 'vitest';
import {
  bestPrefix,
  decodeMarking,
  engineering,
  formatCalculator,
  formatPlain,
  formatScientific,
  inPrefix,
  scientific,
  toBase,
} from './unidades';

describe('prefixes', () => {
  it('converts to base units and back without floating-point noise', () => {
    expect(toBase(4.7, 'k')).toBe(4700);
    expect(toBase(100, 'n')).toBe(1e-7);
    expect(toBase(25.5, 'm')).toBe(0.0255);
    expect(inPrefix(4700, 'k')).toBe(4.7);
    expect(inPrefix(1e-7, 'µ')).toBe(0.1);
    expect(inPrefix(1e-7, 'p')).toBe(100_000);
  });

  it('picks the prefix that leaves a number between 1 and 999', () => {
    expect(bestPrefix(0.0255).symbol).toBe('m');
    expect(bestPrefix(4700).symbol).toBe('k');
    expect(bestPrefix(2.55e-6).symbol).toBe('µ');
    expect(bestPrefix(12).symbol).toBe('');
    expect(bestPrefix(1.4e10).symbol).toBe('G');
  });
});

describe('notation', () => {
  it('writes scientific notation with a mantissa between 1 and 10', () => {
    expect(scientific(4700)).toEqual({ mantissa: 4.7, exponent: 3 });
    expect(scientific(0.00255)).toEqual({ mantissa: 2.55, exponent: -3 });
    expect(scientific(1.602e-19)).toEqual({ mantissa: 1.602, exponent: -19 });
    expect(scientific(99999)).toEqual({ mantissa: 1, exponent: 5 });
  });

  it('writes engineering notation with exponents in steps of 3', () => {
    expect(engineering(47_000)).toEqual({ mantissa: 47, exponent: 3 });
    expect(engineering(0.0000001)).toEqual({ mantissa: 100, exponent: -9 });
    expect(engineering(5500)).toEqual({ mantissa: 5.5, exponent: 3 });
  });

  it('formats the Brazilian way, as a calculator and in powers of ten', () => {
    expect(formatPlain(4.7e9)).toBe('4.700.000.000');
    expect(formatPlain(0.0000047)).toBe('0,0000047');
    expect(formatScientific(4700)).toBe('4,7 × 10³');
    expect(formatScientific(1.602e-19)).toBe('1,602 × 10⁻¹⁹');
    expect(formatScientific(5)).toBe('5');
    expect(formatCalculator(0.002553)).toBe('2.553E-3');
    expect(formatCalculator(4700)).toBe('4.7E3');
  });
});

describe('component markings', () => {
  it('reads resistor letter codes', () => {
    expect(decodeMarking('4K7', 'resistor')?.value).toBe(4700);
    expect(decodeMarking('4k7', 'resistor')?.value).toBe(4700);
    expect(decodeMarking('2R2', 'resistor')?.value).toBe(2.2);
    expect(decodeMarking('R47', 'resistor')?.value).toBe(0.47);
    expect(decodeMarking('1M', 'resistor')?.value).toBe(1e6);
    expect(decodeMarking('470R', 'resistor')?.value).toBe(470);
  });

  it('reads SMD resistor digits', () => {
    expect(decodeMarking('472', 'resistor')?.value).toBe(4700);
    expect(decodeMarking('470', 'resistor')?.value).toBe(47);
    expect(decodeMarking('1002', 'resistor')?.value).toBe(10_000);
  });

  it('reads ceramic capacitor codes in picofarads', () => {
    expect(decodeMarking('104', 'capacitor')?.value).toBe(1e-7);
    expect(decodeMarking('102', 'capacitor')?.value).toBe(1e-9);
    expect(decodeMarking('22', 'capacitor')?.value).toBe(2.2e-11);
    expect(decodeMarking('4n7', 'capacitor')?.value).toBe(4.7e-9);
    const k = decodeMarking('104K', 'capacitor');
    expect(k?.value).toBe(1e-7);
    expect(k?.tolerance).toBe('±10 %');
  });

  it('explains the reading', () => {
    expect(decodeMarking('104', 'capacitor')?.steps).toContain('10 × 10⁴ = 100.000 pF');
    expect(decodeMarking('4K7', 'resistor')?.steps).toContain('4K7 = 4,7 kΩ');
  });

  it('rejects what is not a code', () => {
    expect(decodeMarking('', 'resistor')).toBeUndefined();
    expect(decodeMarking('abc', 'resistor')).toBeUndefined();
    expect(decodeMarking('1K2K', 'resistor')).toBeUndefined();
    expect(decodeMarking('100K', 'resistor')?.value).toBe(100_000);
    expect(decodeMarking('K', 'resistor')).toBeUndefined();
    expect(decodeMarking('1002', 'capacitor')).toBeUndefined();
  });
});
