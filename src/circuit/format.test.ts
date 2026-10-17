import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  formatSI,
  formatSpeed,
  formatTime,
  parseSI,
  roundSignificant,
} from './format';

const nb = (s: string) => s.replace(/\u00a0/g, ' ');

describe('formatSI', () => {
  it('uses engineering prefixes and the decimal comma', () => {
    expect(nb(formatSI(4700, 'Ω'))).toBe('4,7 kΩ');
    expect(nb(formatSI(0.00255, 'A'))).toBe('2,55 mA');
    expect(nb(formatSI(12, 'V'))).toBe('12 V');
    expect(nb(formatSI(1e-6, 'F'))).toBe('1 µF');
    expect(nb(formatSI(2.2e-9, 'F'))).toBe('2,2 nF');
    expect(nb(formatSI(1.5e6, 'Ω'))).toBe('1,5 MΩ');
    expect(nb(formatSI(0.5, 'A'))).toBe('500 mA');
  });

  it('rounds to significant digits and carries into the next prefix', () => {
    expect(nb(formatSI(999.7, 'Ω'))).toBe('1 kΩ');
    expect(nb(formatSI(1234.5, 'W'))).toBe('1,23 kW');
    expect(nb(formatSI(0.0012345, 'A', { digits: 4 }))).toBe('1,235 mA');
  });

  it('keeps trailing zeros when asked, like an instrument', () => {
    expect(nb(formatSI(2.5, 'V', { fixed: true }))).toBe('2,50 V');
  });

  it('writes zero, negatives and non-finite values', () => {
    expect(nb(formatSI(0, 'V'))).toBe('0 V');
    expect(nb(formatSI(-0.012, 'A'))).toBe('−12 mA');
    expect(nb(formatSI(3, 'V', { signed: true }))).toBe('+3 V');
    expect(formatSI(Number.NaN, 'V')).toBe('—');
    expect(formatSI(Number.POSITIVE_INFINITY, 'Ω')).toBe('∞');
  });

  it('does not use prefixes for plain units', () => {
    expect(nb(formatSI(1750, 'rpm'))).toBe('1.750 rpm');
    expect(nb(formatSI(85.4, '%'))).toBe('85,4 %');
    expect(nb(formatSI(-3.01, 'dB'))).toBe('−3,01 dB');
  });
});

describe('formatTime and formatSpeed', () => {
  it('formats simulated time', () => {
    expect(nb(formatTime(0))).toBe('0 s');
    expect(nb(formatTime(0.0125))).toBe('12,5 ms');
    expect(nb(formatTime(1.25))).toBe('1,25 s');
    expect(nb(formatTime(125))).toBe('2 min 05 s');
  });

  it('formats speed factors', () => {
    expect(formatSpeed(1)).toBe('1×');
    expect(formatSpeed(0.01)).toBe('0,01×');
  });
});

describe('formatNumber and roundSignificant', () => {
  it('formats plain numbers', () => {
    expect(formatNumber(1234.5)).toBe('1.234,5');
    expect(formatNumber(-0.5)).toBe('−0,5');
  });

  it('rounds to significant digits', () => {
    expect(roundSignificant(0.012345, 2)).toBe(0.012);
    expect(roundSignificant(98765, 3)).toBe(98800);
  });
});

describe('parseSI', () => {
  it('reads values typed by students', () => {
    expect(parseSI('4,7k')).toBe(4700);
    expect(parseSI('4.7 kΩ')).toBeCloseTo(4700);
    expect(parseSI('100u')).toBeCloseTo(1e-4);
    expect(parseSI('100 µF')).toBeCloseTo(1e-4);
    expect(parseSI('10mA')).toBeCloseTo(0.01);
    expect(parseSI('1.000')).toBe(1000);
    expect(parseSI('0,5')).toBe(0.5);
    expect(parseSI('2M2'.replace('M2', 'M'))).toBe(2e6);
    expect(parseSI('−3')).toBe(-3);
  });

  it('rejects text that is not a number', () => {
    expect(parseSI('abc')).toBeNaN();
    expect(parseSI('')).toBeNaN();
    expect(parseSI('4,7,1')).toBeNaN();
  });
});
