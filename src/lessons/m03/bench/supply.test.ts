import { describe, expect, it } from 'vitest';
import { LOADS, lampTemperature, loadCurrent, read, type SupplyState } from './supply';

const on = (s: Partial<SupplyState>): SupplyState => ({
  vSet: 12,
  iLimit: 1,
  on: true,
  load: 'nada',
  ...s,
});

describe('loads', () => {
  it('the lamp takes its rated 0,417 A at 12 V and runs at 2700 K', () => {
    expect(lampTemperature(12)).toBeCloseTo(2700, 0);
    expect(loadCurrent('lampada', 12)).toBeCloseTo(5 / 12, 3);
  });

  it('a cooler filament has less resistance', () => {
    const rCold = 6 / loadCurrent('lampada', 6);
    expect(rCold).toBeLessThan(28.8);
  });

  it('the LED takes 20 mA at about 2 V', () => {
    expect(loadCurrent('led', 1.99)).toBeCloseTo(0.02, 3);
    expect(loadCurrent('led', 1.5)).toBe(0);
  });
});

describe('bench supply', () => {
  it('shows the settings with the output off', () => {
    const r = read(on({ on: false, load: 'curto' }));
    expect(r.mode).toBe('off');
    expect(r.i).toBe(0);
  });

  it('holds the set voltage while the load takes less than the limit (CV)', () => {
    const r = read(on({ load: 'lampada' }));
    expect(r.mode).toBe('cv');
    expect(r.v).toBe(12);
    expect(r.i).toBeCloseTo(0.4167, 3);
    expect(r.glow).toBeCloseTo(1, 2);
  });

  it('holds the current limit and lowers the voltage (CC)', () => {
    const r = read(on({ load: 'lampada', iLimit: 0.2 }));
    expect(r.mode).toBe('cc');
    expect(r.i).toBe(0.2);
    expect(r.v).toBeGreaterThan(1);
    expect(r.v).toBeLessThan(6);
    expect(loadCurrent('lampada', r.v)).toBeCloseTo(0.2, 4);
  });

  it('survives a short: current at the limit, almost no voltage', () => {
    const r = read(on({ load: 'curto', iLimit: 0.5 }));
    expect(r.mode).toBe('cc');
    expect(r.i).toBe(0.5);
    expect(r.v).toBeCloseTo(0.01, 4);
    expect(r.burns).toBeFalsy();
  });

  it('protects a 10 Ω 5 W resistor with the limit', () => {
    expect(read(on({ load: 'resistor-10', iLimit: 2 })).burns).toBe(true); // 1,2 A, 14,4 W
    const safe = read(on({ load: 'resistor-10', iLimit: 0.5 }));
    expect(safe.mode).toBe('cc');
    expect(safe.v).toBeCloseTo(5, 3);
    expect(safe.p).toBeCloseTo(2.5, 3);
    expect(safe.burns).toBeFalsy();
  });

  it('burns a ¼ W resistor at 30 V', () => {
    expect(read(on({ load: 'resistor-1k', vSet: 30 })).burns).toBe(true); // 0,9 W
    expect(read(on({ load: 'resistor-1k', vSet: 12 })).status).toBe('ok'); // 0,144 W
  });

  it('an LED without resistor burns in CV and lights right in CC at 20 mA', () => {
    expect(read(on({ load: 'led', vSet: 5 })).burns).toBe(true);
    const r = read(on({ load: 'led', vSet: 5, iLimit: 0.02 }));
    expect(r.mode).toBe('cc');
    expect(r.v).toBeCloseTo(1.99, 2);
    expect(r.burns).toBeFalsy();
  });

  it('a lamp burns above about 1,7 times its voltage', () => {
    expect(read(on({ load: 'lampada', vSet: 18 })).burns).toBeFalsy();
    expect(read(on({ load: 'lampada', vSet: 24 })).burns).toBe(true);
  });

  it('a burned part takes no current', () => {
    const r = read(on({ load: 'led', vSet: 5, burned: true }));
    expect(r.i).toBe(0);
    expect(r.mode).toBe('cv');
  });

  it('has a pt-BR message for every load', () => {
    for (const l of LOADS)
      for (const s of [0, 5, 30])
        for (const lim of [0.01, 1, 5]) {
          const r = read(on({ load: l.id, vSet: s, iLimit: lim }));
          expect(r.message.length, `${l.id} ${s} ${lim}`).toBeGreaterThan(20);
          expect(Number.isFinite(r.v) && Number.isFinite(r.i)).toBe(true);
        }
  });
});
