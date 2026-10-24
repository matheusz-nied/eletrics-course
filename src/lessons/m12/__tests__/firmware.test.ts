/** Module 12 firmware: readout labels reach the mcu, and the pure helpers. */
import { describe, expect, it } from 'vitest';
import { getDeviceInfo } from '../../../engine';
import { quantityMeta } from '../../../circuit/readouts';
import { adc10, debounce, DEBOUNCE, released } from '../arduino';
import { resistenciaNtc, temperaturaNtc } from '../firmware/termometro';
import { tempoMinuteria } from '../firmware/minuteria';

describe('firmware readout labels', () => {
  it('merges the firmware labels into the mcu readoutInfo', () => {
    const info = getDeviceInfo('mcu', { firmware: 'm12/motor-pwm' });
    expect(info.readouts).toContain('ciclo');
    expect(info.readoutInfo?.ciclo).toEqual({ label: 'Ciclo de trabalho', unit: '%' });
    expect(quantityMeta('ciclo', info).label).toBe('Ciclo de trabalho');
    // the course's own words still win for common quantities
    const termo = getDeviceInfo('mcu', { firmware: 'm12/termometro' });
    expect(quantityMeta('temperature', termo)).toMatchObject({ label: 'Temperatura', unit: '°C' });
    expect(quantityMeta('leitura', termo).label).toBe('Leitura do ADC (A0)');
  });
});

describe('arduino helpers', () => {
  it('reads the 10-bit ADC like the Uno', () => {
    expect(adc10(0)).toBe(0);
    expect(adc10(2.5)).toBe(512);
    expect(adc10(5)).toBe(1023);
    expect(adc10(1.73)).toBe(354);
  });

  it('debounces: a press counts only after DEBOUNCE of a steady contact', () => {
    let b = released();
    const dt = 0.001;
    const edges: string[] = [];
    // bounce for 10 ms, then steady
    for (let i = 0; i < 100; i++) {
      const raw = i < 10 ? i % 2 === 0 : true;
      const r = debounce(b, raw, dt);
      b = r.button;
      if (r.edge) edges.push(`${r.edge}@${i}`);
    }
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatch(/^press@/);
    expect(Number(edges[0]!.split('@')[1])).toBeGreaterThanOrEqual(DEBOUNCE / dt);
  });
});

describe('NTC and timer math', () => {
  it('goes from reading to temperature as in the worked example', () => {
    expect(resistenciaNtc(354)).toBeCloseTo(5284, -1);
    expect(temperaturaNtc(resistenciaNtc(354))).toBeCloseTo(40.1, 1);
  });

  it('maps the TEMPO trimpot from 5 to 60 s', () => {
    expect(tempoMinuteria(0)).toBe(5);
    expect(tempoMinuteria(5)).toBe(60);
  });
});
