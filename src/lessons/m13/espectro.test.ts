import { describe, expect, it } from 'vitest';
import {
  bandOf,
  EXAMPLES,
  formatFrequency,
  formatLength,
  quarterWave,
  radioBandOf,
  wavelength,
} from './espectro';

const example = (id: string) => EXAMPLES.find((e) => e.id === id)!;
/** The formatters put a non-breaking space before the unit. */
const length = (m: number) => formatLength(m).replace(/\u00a0/g, ' ');
const freq = (f: number) => formatFrequency(f).replace(/\u00a0/g, ' ');

describe('espectro', () => {
  it('gives the wavelengths the lesson quotes', () => {
    // "Exemplo resolvido" of lesson 13.1 and the antenna of lesson 13.2.
    expect(length(wavelength(60))).toBe('5.000 km');
    expect(length(wavelength(100e6))).toBe('3 m');
    expect(length(wavelength(433.92e6))).toBe('69,1 cm');
    expect(length(quarterWave(433.92e6))).toBe('17,3 cm');
    expect(length(wavelength(2.44e9))).toBe('12,3 cm');
    expect(length(quarterWave(2.44e9))).toBe('3,07 cm');
    expect(length(wavelength(example('controle-tv').f))).toBe('940 nm');
    expect(length(quarterWave(100e6))).toBe('74,9 cm');
  });

  it('formats frequencies in pt-BR', () => {
    expect(freq(433.92e6)).toBe('433,92 MHz');
    expect(freq(60)).toBe('60 Hz');
    expect(freq(2.44e9)).toBe('2,44 GHz');
    expect(freq(example('controle-tv').f)).toBe('319 THz');
  });

  it('puts each example in the right band', () => {
    expect(bandOf(433.92e6).id).toBe('radio');
    expect(radioBandOf(433.92e6)).toBe('UHF');
    expect(radioBandOf(100e6)).toBe('VHF');
    expect(bandOf(example('controle-tv').f).id).toBe('infravermelho');
    expect(bandOf(example('vermelho').f).id).toBe('visivel');
    expect(bandOf(example('azul').f).id).toBe('visivel');
    expect(bandOf(example('uv').f).id).toBe('ultravioleta');
    expect(bandOf(example('raio-x').f).id).toBe('raios-x');
  });

  it('lists the examples in frequency order', () => {
    const fs = EXAMPLES.map((e) => e.f);
    expect([...fs].sort((a, b) => a - b)).toEqual(fs);
  });
});
