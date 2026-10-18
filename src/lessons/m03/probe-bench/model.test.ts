import { describe, expect, it } from 'vitest';
import {
  formatOhms,
  FUNCTIONS,
  measure,
  resistanceBetween,
  SCENARIOS,
  type BenchState,
} from './model';

const at = (
  scenario: string,
  red: string | null,
  black: string | null,
  fn: BenchState['fn'] = 'ohm',
  options: Record<string, boolean> = {},
) => measure({ scenario, fn, red, black, options });

describe('resistance solver', () => {
  it('adds series and combines parallel paths', () => {
    const edges = [
      { a: 'x', b: 'y', ohms: 4700 },
      { a: 'x', b: 'm', ohms: 10000 },
      { a: 'm', b: 'y', ohms: 2200 },
    ];
    expect(resistanceBetween(edges, 'x', 'y')).toBeCloseTo((4700 * 12200) / 16900, 6);
    expect(resistanceBetween(edges, 'x', 'm')).toBeCloseTo((10000 * 6900) / 16900, 6);
  });

  it('returns Infinity when there is no path', () => {
    expect(resistanceBetween([{ a: 'x', b: 'y', ohms: 1 }], 'x', 'z')).toBe(Infinity);
  });
});

describe('display', () => {
  it('autoranges like a 6.000-count meter', () => {
    expect(formatOhms(0.31)).toEqual({ digits: '0.3', unit: 'Ω' });
    expect(formatOhms(16)).toEqual({ digits: '16.0', unit: 'Ω' });
    expect(formatOhms(4700)).toEqual({ digits: '4.700', unit: 'kΩ' });
    expect(formatOhms(130434.8)).toEqual({ digits: '130.4', unit: 'kΩ' });
    expect(formatOhms(1e6)).toEqual({ digits: '1.000', unit: 'MΩ' });
    expect(formatOhms(Infinity).digits).toBe('OL');
    expect(formatOhms(1000, 600).digits).toBe('OL');
  });
});

describe('probe bench', () => {
  it('shows OL with the tips in the air', () => {
    const r = at('extensao-c', 'plug-1', null);
    expect(r.digits).toBe('OL');
    expect(r.tone).toBe('idle');
  });

  it('tells the three extension cords apart', () => {
    // A: wire 2 broken.
    expect(at('extensao-a', 'plug-1', 'tom-1', 'cont').beep).toBe(true);
    expect(at('extensao-a', 'plug-2', 'tom-2', 'cont')).toMatchObject({
      beep: false,
      tone: 'warn',
    });
    // B: the two wires touch.
    expect(at('extensao-b', 'plug-1', 'plug-2', 'cont')).toMatchObject({
      beep: true,
      tone: 'warn',
    });
    // C: good.
    expect(at('extensao-c', 'plug-2', 'tom-2', 'cont')).toMatchObject({ beep: true, tone: 'ok' });
    expect(at('extensao-c', 'plug-1', 'plug-2')).toMatchObject({ digits: 'OL', tone: 'ok' });
    expect(at('extensao-c', 'plug-1', 'tom-1').digits).toBe('0.3');
  });

  it('needs the jumper to test wires inside the wall', () => {
    expect(at('parede-quarto', 'f', 'n').digits).toBe('OL');
    const good = at('parede-quarto', 'f', 'n', 'ohm', { jumper: true });
    expect(good.digits).toBe('0.4');
    expect(good.tone).toBe('ok');
    expect(at('parede-varanda', 'f', 'n', 'ohm', { jumper: true })).toMatchObject({
      digits: 'OL',
      tone: 'warn',
    });
  });

  it('finds the common wire of the gate motor (example values)', () => {
    expect(at('motor', 'm1', 'm2').digits).toBe('16.0');
    expect(at('motor', 'm1', 'm3').digits).toBe('8.0');
    expect(at('motor', 'm2', 'm3').digits).toBe('8.2');
    expect(at('motor', 'm1', 'carcaca').digits).toBe('OL');
    for (const pair of [
      ['m1', 'm2'],
      ['m1', 'm3'],
      ['m2', 'm3'],
    ]) {
      expect(at('motor', pair[0]!, pair[1]!, 'cont').beep).toBe(true);
    }
  });

  it('tests fuses and a switch', () => {
    expect(at('fusivel-vidro', 'f1', 'f2', 'cont').beep).toBe(true);
    expect(at('fusivel-ceramico', 'f1', 'f2', 'cont')).toMatchObject({ beep: false, tone: 'warn' });
    expect(at('interruptor', 's1', 's2').digits).toBe('OL');
    expect(at('interruptor', 's1', 's2', 'cont', { ligado: true }).beep).toBe(true);
  });

  it('reads the fingers in parallel with a 1 MΩ resistor', () => {
    expect(at('resistor', 'r1', 'r2').digits).toBe('1.000');
    const hands = at('resistor', 'r1', 'r2', 'ohm', { dedos: true });
    expect(hands).toMatchObject({ digits: '130.4', unit: 'kΩ', tone: 'warn' });
  });

  it('tests a diode and an LED only in the diode function', () => {
    expect(at('diodo', 'a', 'k', 'diode')).toMatchObject({ digits: '0.562', unit: 'V' });
    expect(at('diodo', 'k', 'a', 'diode').digits).toBe('OL');
    expect(at('diodo', 'a', 'k', 'cont').beep).toBe(false);
    expect(at('diodo', 'a', 'k', 'ohm').digits).toBe('OL');
    const led = at('led', 'a', 'k', 'diode');
    expect(led).toMatchObject({ digits: '1.780', glow: true });
    expect(at('led', 'k', 'a', 'diode').glow).toBe(false);
  });

  it('shows the leads alone with both tips on one point', () => {
    expect(at('motor', 'm1', 'm1').digits).toBe('0.2');
  });

  it('has a pt-BR message for every combination', () => {
    for (const s of SCENARIOS) {
      const ids = s.points.map((p) => p.id);
      const optionSets = [{}, Object.fromEntries((s.options ?? []).map((o) => [o.id, true]))];
      for (const f of FUNCTIONS)
        for (const red of ids)
          for (const black of ids)
            for (const options of optionSets) {
              const r = at(s.id, red, black, f.id, options);
              expect(r.message.length, `${s.id}/${f.id}/${red}/${black}`).toBeGreaterThan(30);
              expect(r.digits.length).toBeGreaterThan(0);
            }
    }
  });
});
