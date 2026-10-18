import { describe, expect, it } from 'vitest';
import { Simulator } from '../../engine/analysis/simulator';
import type { CircuitDoc, ParamValue } from '../../engine/contract';
import fita from './fita-led.circuit';
import ledResistor from './led-resistor.circuit';
import { diodeCurrent } from './diodo-modelo';
import {
  LEDS,
  designResistor,
  ledModel,
  nextE12,
  ratingFor,
  stringCurrent,
  type LedColor,
} from './led-calc';

/** Readouts of a lesson circuit with some parameters changed. */
function run(doc: CircuitDoc, set: Record<string, ParamValue> = {}) {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(set)) {
    const [el, param] = key.split('.') as [string, string];
    sim.setParam(el, param, value);
  }
  sim.refresh();
  // One second, as the lesson goals: long enough for an overloaded LED to burn.
  while (sim.t < 1 - sim.dt * 1e-6) sim.step();
  return sim.frame().readouts;
}

describe('LED calculator of lesson 9.4', () => {
  it('rounds up to the E12 series', () => {
    expect(nextE12(300)).toBe(330);
    expect(nextE12(330)).toBe(330);
    expect(nextE12(135)).toBe(150);
    expect(nextE12(1000)).toBe(1000);
    expect(nextE12(98)).toBe(100);
    expect(nextE12(4.5)).toBe(4.7);
    expect(nextE12(593)).toBe(680);
  });

  it('suggests a rating with twice the power', () => {
    expect(ratingFor(0.03)).toBe(0.125);
    expect(ratingFor(0.1)).toBe(0.25);
    expect(ratingFor(0.2)).toBe(0.5);
  });

  it('gives the same current as the simulator', () => {
    const cases: [number, number, LedColor][] = [
      [9, 330, 'red'],
      [9, 1000, 'red'],
      [9, 330, 'blue'],
      [5, 330, 'red'],
      [9, 330, 'yellow'],
      [9, 330, 'green'],
    ];
    for (const [volts, ohms, color] of cases) {
      const r = run(ledResistor, {
        'V1.voltage': volts,
        'R1.resistance': ohms,
        'D1.color': color,
      });
      expect(stringCurrent(volts, ohms, color)).toBeCloseTo(r['ILED'] as number, 6);
    }
    for (const volts of [10, 12, 14.4]) {
      const r = run(fita, { 'V1.voltage': volts });
      expect(stringCurrent(volts, 150, 'white', 3)).toBeCloseTo(r['I1'] as number, 6);
    }
  });

  it('matches the worked examples', () => {
    // Red LED on 5 V at 10 mA: 300 Ω, 330 Ω in the series, about 9,5 mA.
    const red = designResistor(5, 'red', 1, 0.01);
    expect(red.ideal).toBeCloseTo(300, 6);
    expect(red.chosen).toBe(330);
    expect(red.current).toBeCloseTo(0.0095, 4);
    expect(red.ledVoltage).toBeCloseTo(1.86, 2);
    expect(red.power).toBeCloseTo(0.03, 3);
    // Blue LED on 12 V at 15 mA: about 593 Ω, 680 Ω, 13 mA, 0,12 W.
    const blue = designResistor(12, 'blue', 1, 0.015);
    expect(blue.ideal).toBeCloseTo(593.3, 1);
    expect(blue.chosen).toBe(680);
    expect(blue.current).toBeCloseTo(0.0132, 4);
    expect(blue.power).toBeCloseTo(0.119, 3);
    expect(blue.rating).toBe(0.25);
    // A 12 V strip segment: three white LEDs, 135 Ω calculated, 150 Ω used.
    const strip = designResistor(12, 'white', 3, 0.02);
    expect(strip.ideal).toBeCloseTo(135, 6);
    expect(strip.chosen).toBe(150);
    expect(strip.current).toBeCloseTo(0.0185, 4);
    // The calculator warns about the strip and about two red LEDs on 5 V, not about one.
    expect(strip.tight).toBe(true);
    expect(designResistor(5, 'red', 2, 0.01).tight).toBe(true);
    expect(red.tight).toBe(false);
    expect(blue.tight).toBe(false);
  });

  it('a red LED goes from 20 mA at 2,0 V to more than 50 mA at 2,4 V', () => {
    expect(diodeCurrent(2.0, ledModel('red'))).toBeCloseTo(0.02, 3);
    expect(diodeCurrent(2.4, ledModel('red'))).toBeGreaterThan(0.05);
  });

  it('says when the supply cannot light the LEDs', () => {
    const d = designResistor(5, 'white', 2, 0.01);
    expect(d.chosen).toBeUndefined();
    expect(d.headroom).toBeCloseTo(5 - 2 * LEDS.white.vf, 9);
  });
});

describe('simulations of lesson 9.4', () => {
  it('LED and resistor: the values in the text', () => {
    const red = run(ledResistor);
    expect(red['ILED']).toBeCloseTo(0.0212, 4);
    expect(red['VLED']).toBeCloseTo(2.01, 2);
    expect(red['VR1']).toBeCloseTo(6.99, 2);
    expect(red['PR1']).toBeCloseTo(0.148, 3);
    expect(run(ledResistor, { 'R1.resistance': 1000 })['ILED']).toBeCloseTo(0.0072, 4);
    const blue = run(ledResistor, { 'D1.color': 'blue' });
    expect(blue['ILED']).toBeCloseTo(0.018, 3);
    expect(blue['VLED']).toBeCloseTo(3.07, 2);
    // Without the resistor the LED burns open and keeps the whole 9 V.
    const burned = run(ledResistor, { 'S1.closed': true });
    expect(burned['D1.burned']).toBe(true);
    expect(burned['VLED']).toBeCloseTo(9, 3);
    // The lowest resistor that keeps the red LED under its 30 mA.
    expect(run(ledResistor, { 'R1.resistance': 220 })['ILED']).toBeGreaterThan(0.03);
    expect(run(ledResistor, { 'R1.resistance': 270 })['ILED']).toBeLessThan(0.03);
  });

  it('LED strip: the values in the text', () => {
    const twelve = run(fita);
    expect(twelve['I1']).toBeCloseTo(0.0185, 4);
    expect(twelve['VD1']).toBeCloseTo(3.08, 2);
    expect(twelve['VR1']).toBeCloseTo(2.77, 2);
    const car = run(fita, { 'V1.voltage': 14.4 });
    expect(car['I1']).toBeCloseTo(0.0309, 4);
    expect(car['VR1']).toBeCloseTo(4.64, 2);
    expect(run(fita, { 'V1.voltage': 10 })['I1']).toBeCloseTo(0.0084, 4);
  });
});
