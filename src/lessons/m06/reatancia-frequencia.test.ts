import { describe, expect, it } from 'vitest';
import circuit from './reatancia-frequencia.circuit';
import { measureAc } from './fase-reatancia-medidas';

/** What the three multimeters of lesson 6.4 read (mA, A~) at the frequency `f`. */
function at(f: number) {
  const m = measureAc(circuit, ['IR', 'IC', 'IL'], {
    settings: { 'V1.frequency': f },
    frequency: f,
  });
  return {
    ir: m.IR!.rms * 1000,
    ic: m.IC!.rms * 1000,
    il: m.IL!.rms * 1000,
    phaseC: m.IC!.phase,
    phaseL: m.IL!.phase,
  };
}

const xc = (f: number) => 1 / (2 * Math.PI * f * 10e-6);
const xl = (f: number) => 2 * Math.PI * f * 0.1;

describe('reatância e frequência (aula 6.4)', () => {
  it('matches X_C and X_L as the lesson computes them', () => {
    expect(xc(60)).toBeCloseTo(265.3, 1);
    expect(xl(60)).toBeCloseTo(37.7, 1);
    expect(xc(1000)).toBeCloseTo(15.9, 1); // the 16 Ω of lesson 9.7
    expect(xl(1000)).toBeCloseTo(628.3, 1);
    // Where the two reactances are equal.
    expect(1 / (2 * Math.PI * Math.sqrt(0.1 * 10e-6))).toBeCloseTo(159.2, 1);
  });

  it('reads 70,7 mA, 26,7 mA and 187 mA at 60 Hz', () => {
    const m = at(60);
    expect(m.ir).toBeCloseTo(70.7, 1);
    expect(m.ic).toBeCloseTo(26.7, 1);
    expect(m.il).toBeGreaterThan(186.5);
    expect(m.il).toBeLessThan(187.5);
    expect(m.phaseC).toBeCloseTo(90, 0);
    expect(m.phaseL).toBeLessThan(-86);
  });

  it('ten times the frequency: ten times the capacitor current, a tenth of the coil current', () => {
    const m = at(600);
    expect(m.ir).toBeCloseTo(70.7, 1);
    expect(m.ic).toBeGreaterThan(266);
    expect(m.ic).toBeLessThan(268);
    expect(m.il).toBeCloseTo(18.7, 1);
  });

  it('gives three currents near 70 mA at 160 Hz', () => {
    const m = at(160);
    for (const i of [m.ir, m.ic, m.il]) {
      expect(i).toBeGreaterThan(69.5);
      expect(i).toBeLessThan(71.5);
    }
  });

  it('reads about 445 mA in the capacitor and 11 mA in the coil at 1.000 Hz', () => {
    const m = at(1000);
    expect(m.ic).toBeGreaterThan(443);
    expect(m.ic).toBeLessThan(447);
    expect(m.il).toBeGreaterThan(10.8);
    expect(m.il).toBeLessThan(11.6);
  });
});
