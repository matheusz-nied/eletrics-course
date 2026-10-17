import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber, formatSI, NBSP } from './formato';

const s = (text: string) => text.replaceAll(' ', NBSP);

describe('formatSI', () => {
  it('picks the engineering prefix and uses the decimal comma', () => {
    expect(formatSI(0.085, 'A')).toBe(s('85 mA'));
    expect(formatSI(4700, 'Ω')).toBe(s('4,7 kΩ'));
    expect(formatSI(0.00127, 'A')).toBe(s('1,27 mA'));
    expect(formatSI(1e6, 'Ω')).toBe(s('1 MΩ'));
    expect(formatSI(0.0000127, 'A')).toBe(s('12,7 µA'));
    expect(formatSI(0, 'V')).toBe(s('0 V'));
  });

  it('rounds before choosing the prefix', () => {
    expect(formatSI(0.99996, 'A')).toBe(s('1 A'));
  });
});

describe('formatNumber and formatMoney', () => {
  it('formats the Brazilian way', () => {
    expect(formatNumber(1500.5, 1)).toBe('1.500,5');
    expect(formatNumber(5500, 0)).toBe('5.500');
    expect(formatMoney(66)).toBe(s('R$ 66,00'));
  });
});
