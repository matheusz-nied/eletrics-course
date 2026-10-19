import { describe, expect, it } from 'vitest';
import { Simulator } from '../../engine/analysis/simulator';
import type { CircuitDoc, ParamValue, SimFrame } from '../../engine/contract';
import dimmer from './dimmer-triac.circuit';
import opto from './optoacoplador-rede.circuit';
import scr from './scr-alarme.circuit';

/** A lesson circuit that can be driven step by step, as the student would. */
function start(doc: CircuitDoc, set: Record<string, ParamValue> = {}) {
  const sim = new Simulator(doc);
  const apply = (values: Record<string, ParamValue>) => {
    for (const [key, value] of Object.entries(values)) {
      const [el, param] = key.split('.') as [string, string];
      sim.setParam(el, param, value);
    }
    sim.refresh();
  };
  apply(set);
  /** Runs for `seconds`, calling `each` with every frame. */
  const run = (seconds: number, each?: (frame: SimFrame) => void) => {
    const until = sim.t + seconds;
    while (sim.t < until - sim.dt * 1e-6) {
      sim.step();
      each?.(sim.frame({ samples: false }));
    }
    return sim.frame().readouts;
  };
  return { apply, run };
}

const num = (frame: SimFrame, key: string) => frame.readouts[key] as number;

describe('lesson 9.9: the SCR alarm latches', () => {
  it('blocks at rest, fires with the sensor and keeps the siren on until reset', () => {
    const sim = start(scr);
    let r = sim.run(0.2);
    expect(r['X1.vak']).toBeGreaterThan(11.5);
    expect(r['SR1.sounding']).toBe(false);
    expect(r['SR1.current']).toBeLessThan(1e-4);

    // Sensor pressed: about 11 mA in the gate, 27 mA in the siren, 0,9 V on the SCR
    sim.apply({ 'S1.pressed': true });
    r = sim.run(0.2);
    expect(r['X1.on']).toBe(true);
    expect(r['SR1.sounding']).toBe(true);
    expect(r['R1.current']).toBeGreaterThan(0.0105);
    expect(r['R1.current']).toBeLessThan(0.0115);
    expect(r['SR1.current']).toBeGreaterThan(0.026);
    expect(r['SR1.current']).toBeLessThan(0.029);
    expect(r['X1.vak']).toBeGreaterThan(0.85);
    expect(r['X1.vak']).toBeLessThan(1);

    // Sensor released: no gate current, and the siren keeps sounding
    sim.apply({ 'S1.pressed': false });
    r = sim.run(0.5);
    expect(r['R1.current']).toBeLessThan(1e-6);
    expect(r['X1.on']).toBe(true);
    expect(r['SR1.sounding']).toBe(true);

    // Reset (NC) pressed and released: the SCR turns off and stays off
    sim.apply({ 'S2.pressed': true });
    r = sim.run(0.2);
    expect(r['SR1.current']).toBeLessThan(1e-4);
    sim.apply({ 'S2.pressed': false });
    r = sim.run(0.5);
    expect(r['X1.on']).toBe(false);
    expect(r['SR1.sounding']).toBe(false);
    expect(r['X1.vak']).toBeGreaterThan(11.5);
  });
});

/** Average lamp power, lamp RMS voltage and firing delay after each positive zero crossing. */
function dimmerAt(position: number) {
  const sim = start(dimmer, { 'P1.position': position });
  let power = 0;
  let squares = 0;
  let n = 0;
  let lastV = 0;
  let zeroT = Number.NaN;
  let wasOn = false;
  let capPeak = 0;
  let brightness = 0;
  const delays: number[] = [];
  sim.run(0.4, (f) => {
    const v = num(f, 'V1.voltage');
    const on = f.readouts['T1.on'] === true;
    if (lastV <= 0 && v > 0) zeroT = f.t;
    if (f.t >= 0.2) {
      if (on && !wasOn && v > 0) delays.push(f.t - zeroT);
      power += num(f, 'L1.power');
      squares += num(f, 'L1.voltage') ** 2;
      capPeak = Math.max(capPeak, Math.abs(num(f, 'C1.voltage')));
      brightness += num(f, 'L1.brightness');
      n++;
    }
    wasOn = on;
    lastV = v;
  });
  const delay = delays.length ? delays.reduce((a, b) => a + b) / delays.length : Number.NaN;
  return {
    power: power / n,
    vrms: Math.sqrt(squares / n),
    delay,
    // Firing angle in the half-cycle (180° = 8,33 ms at 60 Hz)
    angle: delay * 60 * 360,
    capPeak,
    brightness: brightness / n,
    fired: delays.length > 0,
  };
}

describe('lesson 9.9: dimmer with TRIAC and DIAC', () => {
  it('at 80 % (the start) it fires about 3 ms after the zero, near 64°', () => {
    const d = dimmerAt(0.8);
    expect(d.delay).toBeGreaterThan(0.0028);
    expect(d.delay).toBeLessThan(0.0031);
    expect(d.angle).toBeGreaterThan(60);
    expect(d.angle).toBeLessThan(67);
    expect(d.vrms).toBeGreaterThan(108);
    expect(d.vrms).toBeLessThan(113);
    expect(d.power).toBeGreaterThan(48);
    expect(d.power).toBeLessThan(52);
    // The capacitor climbs to the 32 V of the DIAC
    expect(d.capPeak).toBeGreaterThan(30);
    expect(d.capPeak).toBeLessThan(34);
  });

  it('at 100 % it fires near 18° and the lamp gets almost the whole mains', () => {
    const d = dimmerAt(1);
    expect(d.delay).toBeLessThan(0.001);
    expect(d.angle).toBeGreaterThan(15);
    expect(d.angle).toBeLessThan(21);
    expect(d.vrms).toBeGreaterThan(124);
    expect(d.vrms).toBeLessThan(127.5);
    expect(d.power).toBeGreaterThan(58);
    expect(d.power).toBeLessThan(61);
  });

  it('at 50 % it fires near 107° and the lamp gets about 70 V and 27 W', () => {
    const d = dimmerAt(0.5);
    expect(d.delay).toBeGreaterThan(0.0048);
    expect(d.delay).toBeLessThan(0.0052);
    expect(d.angle).toBeGreaterThan(103);
    expect(d.angle).toBeLessThan(111);
    expect(d.vrms).toBeGreaterThan(67);
    expect(d.vrms).toBeLessThan(73);
    expect(d.power).toBeGreaterThan(25.5);
    expect(d.power).toBeLessThan(29);
  });

  it('at 40 % it still fires, but the filament barely glows', () => {
    const d = dimmerAt(0.4);
    expect(d.fired).toBe(true);
    expect(d.brightness).toBeLessThan(0.02);
  });

  it('at 25 % the capacitor no longer reaches the DIAC and the lamp is off', () => {
    const d = dimmerAt(0.25);
    expect(d.fired).toBe(false);
    expect(d.capPeak).toBeLessThan(32);
    expect(d.power).toBeLessThan(0.5);
  });
});

/** Waveforms of the optocoupler circuit over three cycles. */
function optoAt(amplitude: number) {
  const sim = start(opto, { 'V1.amplitude': amplitude });
  let ledPeak = 0;
  let low = 0;
  let high = 0;
  let n = 0;
  let powerR1 = 0;
  let lastOut = Number.NaN;
  let lastV = 0;
  let zeroT = Number.NaN;
  const fallVoltages: number[] = [];
  const fallDelays: number[] = [];
  let maxNegativeOut = Number.POSITIVE_INFINITY;
  sim.run(0.15, (f) => {
    const v = num(f, 'V1.voltage');
    const out = num(f, 'OK1.vce');
    if (lastV <= 0 && v > 0) zeroT = f.t;
    if (f.t >= 0.1) {
      ledPeak = Math.max(ledPeak, num(f, 'OK1.ledCurrent'));
      powerR1 += num(f, 'R1.power');
      if (out < 0.4) low++;
      if (out > 4.9) high++;
      if (v < -20) maxNegativeOut = Math.min(maxNegativeOut, out);
      if (lastOut >= 2.5 && out < 2.5) {
        fallVoltages.push(v);
        fallDelays.push(f.t - zeroT);
      }
      n++;
    }
    lastOut = out;
    lastV = v;
  });
  return {
    ledPeak,
    lowFraction: low / n,
    highFraction: high / n,
    fallVoltage: fallVoltages.reduce((a, b) => a + b, 0) / fallVoltages.length,
    fallDelay: Math.max(...fallDelays),
    minOutWhileNegative: maxNegativeOut,
    powerR1: powerR1 / n,
  };
}

describe('lesson 9.9: optocoupler reading the mains', () => {
  it('on 127 V the LED gets 1,9 mA at the peak and the output follows the half-cycles', () => {
    const o = optoAt(179.6);
    expect(o.ledPeak).toBeGreaterThan(0.00185);
    expect(o.ledPeak).toBeLessThan(0.00195);
    // The output crosses 2,5 V when the mains passes about 25 V
    expect(o.fallVoltage).toBeGreaterThan(20);
    expect(o.fallVoltage).toBeLessThan(30);
    // "menos de meio milissegundo depois do zero"
    expect(o.fallDelay).toBeLessThan(0.0005);
    // It stays at 5 V all through the negative half-cycle
    expect(o.minOutWhileNegative).toBeGreaterThan(4.9);
    expect(o.lowFraction).toBeGreaterThan(0.38);
    expect(o.highFraction).toBeGreaterThan(0.5);
    // Each 47 kΩ resistor: about 0,09 W
    expect(o.powerR1).toBeGreaterThan(0.08);
    expect(o.powerR1).toBeLessThan(0.09);
  });

  it('on 220 V the LED gets 3,3 mA and each resistor about 0,26 W', () => {
    const o = optoAt(311.1);
    expect(o.ledPeak).toBeGreaterThan(0.0032);
    expect(o.ledPeak).toBeLessThan(0.0034);
    expect(o.minOutWhileNegative).toBeGreaterThan(4.9);
    expect(o.lowFraction).toBeGreaterThan(0.38);
    expect(o.powerR1).toBeGreaterThan(0.25);
    expect(o.powerR1).toBeLessThan(0.265);
  });
});
