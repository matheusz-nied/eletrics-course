import { describe, expect, it } from 'vitest';
import type { ParamValue, SimEvent, SimFrame } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import { checkGoal } from '../../engine/analysis/goals';
import doc, { FAULTS, SCHEMES } from './maquina-de-lavar.circuit';

/**
 * What lesson 7.2 says about the washing machine with an insulation fault:
 * every number in the text and in the circuit's description comes from here.
 * The circuit runs in the quasi-static analysis (5 ms steps); readouts are RMS.
 */
interface Run {
  first: SimFrame['readouts'];
  last: SimFrame['readouts'];
  events: SimEvent[];
  /** When the person's shock first reached zone AC-4 (s), if it did. */
  ac4?: number;
}

function run(settings: Record<string, ParamValue>, seconds = 1): Run {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  const events: SimEvent[] = [];
  let first: SimFrame['readouts'] | undefined;
  let ac4: number | undefined;
  const steps = Math.round(seconds / sim.dt);
  for (let i = 0; i < steps; i++) {
    sim.step();
    const frame = sim.frame({ samples: false });
    first ??= frame.readouts;
    events.push(...frame.events);
    if (ac4 === undefined && frame.readouts['P.worst'] === 'AC-4') ac4 = frame.t;
  }
  return { first: first!, last: sim.frame({ samples: false }).readouts, events, ac4 };
}

const n = (r: SimFrame['readouts'], key: string) => r[key] as number;
const tripped = (r: Run, element: string) =>
  r.events.find((e) => e.kind === 'tripped' && e.element === element);

const FASE = { 'RF.resistance': FAULTS.franca };
const TOUCH = { 'TOQUE.closed': true };
const PE = { 'SPE.closed': true };
const TT = { 'REDE.earth': SCHEMES.tt };
const WITH_DR = { 'CH.actuated': false };

describe('a máquina de lavar com falha de isolação (aula 7.2)', { timeout: 60_000 }, () => {
  it('without a fault, the machine draws 3,9 A and its case has no voltage', () => {
    const r = run({});
    expect(n(r.last, 'IDJ')).toBeCloseTo(3.9, 1);
    expect(n(r.last, 'VC')).toBeLessThan(0.5);
  });

  it('with the phase on the case and no PE, the case sits at about 125 V in both schemes', () => {
    for (const scheme of [{}, TT]) {
      const r = run({ ...FASE, ...scheme });
      expect(n(r.last, 'VC')).toBeGreaterThan(124.5);
      expect(n(r.last, 'VC')).toBeLessThan(126.5);
      expect(r.events).toHaveLength(0);
    }
  });

  it('without PE and without DR, about 107 mA go through the person: AC-4 in about half a second', () => {
    for (const scheme of [{}, TT]) {
      const r = run({ ...FASE, ...TOUCH, ...scheme }, 2);
      expect(n(r.last, 'IP')).toBeGreaterThan(0.104);
      expect(n(r.last, 'IP')).toBeLessThan(0.109);
      expect(r.last['P.worst']).toBe('AC-4');
      expect(r.ac4).toBeGreaterThan(0.4);
      expect(r.ac4).toBeLessThan(0.6);
      expect(tripped(r, 'DJ')).toBeUndefined();
      expect(n(r.last, 'IDJ')).toBeLessThan(4.2);
    }
  });

  it('with wet skin the current is larger still', () => {
    const r = run({ ...FASE, ...TOUCH, 'P.skin': 'wet' }, 2);
    expect(n(r.last, 'IP')).toBeGreaterThan(0.11);
    expect(r.last['P.worst']).toBe('AC-4');
  });

  it('a damp insulation (20 kΩ) gives the tingle: 14 V on the case, under 6 mA, zone AC-2', () => {
    const r = run({ 'RF.resistance': FAULTS.umida, ...TOUCH }, 3);
    expect(n(r.last, 'VC')).toBeCloseTo(13.7, 1);
    expect(n(r.last, 'IP')).toBeGreaterThan(0.0055);
    expect(n(r.last, 'IP')).toBeLessThan(0.006);
    expect(r.last['P.worst']).toBe('AC-2');
  });

  it('a bad insulation (2 kΩ) without PE: about 59 V and 34 mA through the person, zone AC-3', () => {
    const r = run({ 'RF.resistance': FAULTS.ruim, ...TOUCH }, 3);
    expect(n(r.last, 'VC')).toBeCloseTo(58.5, 0);
    expect(n(r.last, 'IP')).toBeGreaterThan(0.033);
    expect(n(r.last, 'IP')).toBeLessThan(0.034);
    expect(r.last['P.worst']).toBe('AC-3');
    // Before anyone touches, a meter on the case reads almost the whole 127 V.
    expect(n(run({ 'RF.resistance': FAULTS.ruim }).last, 'VC')).toBeGreaterThan(120);
  });

  it('with PE in TN, the fault current passes 200 A and the breaker trips at once', () => {
    const r = run({ ...FASE, ...PE }, 0.5);
    expect(n(r.first, 'IPE')).toBeGreaterThan(250);
    expect(n(r.first, 'IPE')).toBeLessThan(290);
    const trip = tripped(r, 'DJ');
    expect(trip?.message).toMatch(/curto-circuito \(disparo magnético, curva C\)/);
    expect(trip!.t).toBeLessThanOrEqual(0.0051);
    // The breaker's message quotes the current it measured: more than 200 A.
    const amps = Number(/corrente de ([\d,]+) A/.exec(trip!.message)![1].replace(',', '.'));
    expect(amps).toBeGreaterThan(200);
    // During those 5 ms the case had about 37 V; afterwards, nothing.
    expect(n(r.first, 'VC')).toBeCloseTo(37, 0);
    expect(n(r.last, 'VC')).toBeLessThan(0.01);
  });

  it('with PE in TT, about 3 A of fault current: the breaker holds and the case keeps 93 V', () => {
    const r = run({ ...FASE, ...PE, ...TT }, 60);
    expect(n(r.last, 'IPE')).toBeCloseTo(3.1, 1);
    expect(n(r.last, 'IDJ')).toBeCloseTo(7.0, 1);
    expect(n(r.last, 'VC')).toBeGreaterThan(93);
    expect(n(r.last, 'VC')).toBeLessThan(94.5);
    expect(r.events).toHaveLength(0);
    expect(n(r.last, 'DJ.heat')).toBeLessThan(0.1);
  });

  it('in TT the person touching that case gets about 69 mA: AC-4', () => {
    const r = run({ ...FASE, ...PE, ...TT, ...TOUCH }, 2);
    expect(n(r.last, 'IP')).toBeGreaterThan(0.067);
    expect(n(r.last, 'IP')).toBeLessThan(0.071);
    expect(r.last['P.worst']).toBe('AC-4');
    expect(tripped(r, 'DJ')).toBeUndefined();
  });

  it('with a 2 kΩ fault and PE, the case stays near 0 V and 63 mA leak through the green wire', () => {
    const r = run({ 'RF.resistance': FAULTS.ruim, ...PE, ...TOUCH }, 2);
    expect(n(r.last, 'VC')).toBeLessThan(0.05);
    expect(n(r.last, 'IPE')).toBeCloseTo(0.063, 3);
    expect(r.last['P.worst']).toBe('AC-1');
    expect(r.events).toHaveLength(0);
  });

  it('the DR switches off within the first 5 ms step, before the shock gets dangerous', () => {
    const cases = [
      { ...FASE, ...PE, ...TT },
      { ...FASE, ...TOUCH },
      { ...FASE, ...TOUCH, ...TT },
      { 'RF.resistance': FAULTS.ruim, ...PE },
    ];
    for (const settings of cases) {
      const r = run({ ...settings, ...WITH_DR }, 0.5);
      const trip = tripped(r, 'DR');
      expect(trip, JSON.stringify(settings)).toBeDefined();
      expect(trip!.t).toBeLessThanOrEqual(0.0051);
      expect(tripped(r, 'DJ')).toBeUndefined();
      expect(['AC-1', 'AC-2']).toContain(r.last['P.worst']);
      expect(n(r.last, 'VC')).toBeLessThan(0.01);
    }
  });

  it('a damp insulation (20 kΩ) with DR and no PE trips it only when someone touches', () => {
    // 5,6 mA of leak is below the DR's 30 mA: it stays on and the tingle stays.
    const r = run({ 'RF.resistance': FAULTS.umida, ...TOUCH, ...WITH_DR }, 2);
    expect(tripped(r, 'DR')).toBeUndefined();
    expect(n(r.last, 'IP')).toBeLessThan(0.006);
  });

  for (const goal of doc.goals ?? []) {
    it(`meets goal "${goal.id}" with its solution`, () => {
      const r = run(goal.solution ?? {}, goal.at ?? 1);
      expect(checkGoal(goal, { t: 0, nodeVoltages: {}, readouts: r.last, events: [] })).toBe(true);
    });
  }
});
