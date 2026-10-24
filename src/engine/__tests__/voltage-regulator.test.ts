import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ParamValue, SimEvent } from '../contract';
import { Simulator } from '../analysis/simulator';
import { netlist, runFor } from './utils';

const r = (sim: Simulator, key: string) => sim.frame({ samples: false }).readouts[key] as number;

/** Source → regulator → load, with optional regulator params. */
function bench(
  vin: number,
  load: number,
  reg: Record<string, ParamValue> = {},
  analysis: CircuitDoc['analysis'] = { kind: 'dc' },
): CircuitDoc {
  return netlist(
    'regulador',
    [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: vin } },
      { id: 'U1', type: 'voltage-regulator', nodes: { in: '1', out: '2', com: '0' }, params: reg },
      { id: 'RL', type: 'resistor', nodes: ['2', '0'], params: { resistance: load, watts: 50 } },
    ],
    analysis,
  );
}

describe('voltage-regulator', () => {
  it('holds 12 V from 15 V to 30 V of input, from light load to 1 A', () => {
    for (const vin of [15, 20, 30]) {
      for (const load of [1000, 24, 12]) {
        const { frame } = runFor(bench(vin, load));
        const vout = frame.readouts['U1.vout'] as number;
        expect(vout, `${vin} V, ${load} Ω`).toBeGreaterThan(11.97);
        expect(vout, `${vin} V, ${load} Ω`).toBeLessThan(12.01);
        expect(frame.readouts['U1.state']).toBe('regulando');
      }
    }
  });

  it('takes the load current plus about 5 mA from the input and dissipates (Vin − Vout)·I', () => {
    const { frame } = runFor(bench(20, 24));
    const iout = frame.readouts['U1.iout'] as number;
    expect(iout).toBeCloseTo(0.5, 2);
    expect((frame.readouts['U1.iin'] as number) - iout).toBeCloseTo(0.005, 3);
    expect(frame.readouts['U1.power'] as number).toBeCloseTo(8 * 0.5 + 20 * 0.005, 1);
    expect(frame.readouts['V1.current'] as number).toBeCloseTo(0.505, 3);
  });

  it('drops out about 2 V below the input and only sources current', () => {
    const { frame } = runFor(bench(13, 24));
    const vout = frame.readouts['U1.vout'] as number;
    expect(vout).toBeGreaterThan(10.8);
    expect(vout).toBeLessThan(11.2);
    expect(frame.readouts['U1.state']).toBe('sem folga');
    // Input below the output: no current back into the regulator.
    const off = runFor(bench(0, 24)).frame;
    expect(Math.abs(off.readouts['U1.iout'] as number)).toBeLessThan(1e-4);
    expect(off.readouts['U1.state']).toBe('desligado');
  });

  it('limits the current of a short circuit', () => {
    const { frame } = runFor(bench(15, 0.1));
    expect(frame.readouts['U1.iout'] as number).toBeCloseTo(1.5, 1);
    expect(frame.readouts['U1.state']).toBe('limitando a corrente');
  });

  it('an LM317 holds 1,25 V over R1 and sets Vout = 1,25·(1 + R2/R1) + Iadj·R2', () => {
    const doc = netlist('lm317', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 15 } },
      {
        id: 'U1',
        type: 'voltage-regulator',
        nodes: { in: '1', out: '2', com: '3' },
        params: { vref: 1.25, adjustable: true, iq: 50e-6 },
      },
      { id: 'R1', type: 'resistor', nodes: ['2', '3'], params: { resistance: 240 } },
      { id: 'R2', type: 'resistor', nodes: ['3', '0'], params: { resistance: 1500 } },
      { id: 'RL', type: 'resistor', nodes: ['2', '0'], params: { resistance: 100 } },
    ]);
    const { frame } = runFor(doc);
    const expected = 1.25 * (1 + 1500 / 240) + 50e-6 * 1500;
    expect(frame.readouts['v2'] as number).toBeCloseTo(expected, 1);
  });

  it('overheats without a heatsink and the thermal protection turns the output off', () => {
    // 25 V in, 12 V out, 0,5 A: 6,5 W, about 350 °C at 50 °C/W: it shuts down.
    const sim = new Simulator(bench(25, 24, { tau: 2 }));
    sim.refresh();
    const events: SimEvent[] = [];
    let sawOff = false;
    let sawBackOn = false;
    while (sim.t < 20) {
      sim.step();
      const f = sim.frame({ samples: false });
      events.push(...f.events);
      if (f.readouts['U1.shutdown'] === true) sawOff = true;
      else if (sawOff) sawBackOn = true;
    }
    expect(sawOff).toBe(true);
    expect(sawBackOn).toBe(true);
    expect(events.filter((e) => e.kind === 'warning' && e.element === 'U1')).toHaveLength(1);
    expect(events[0]!.message).toContain('proteção térmica');
    expect(r(sim, 'U1.temperature')).toBeLessThan(165);
    expect(r(sim, 'U1.temperature')).toBeGreaterThan(130);
  });

  it('stays cool on a heatsink', () => {
    const sim = new Simulator(bench(25, 24, { tau: 2, rth: 8 }));
    sim.refresh();
    while (sim.t < 20) sim.step();
    expect(r(sim, 'U1.temperature')).toBeCloseTo(25 + 6.6 * 8, -1);
    expect(sim.frame().readouts['U1.shutdown']).toBe(false);
  });

  it('keeps the output smooth over a rippling input in a transient run', () => {
    const doc = netlist(
      'ondulacao',
      [
        {
          id: 'V1',
          type: 'ac-voltage',
          nodes: ['1', '0'],
          params: { amplitude: 1, frequency: 120, offset: 16 },
        },
        { id: 'U1', type: 'voltage-regulator', nodes: { in: '1', out: '2', com: '0' } },
        { id: 'C1', type: 'capacitor', nodes: ['2', '0'], params: { capacitance: 1e-4 } },
        { id: 'RL', type: 'resistor', nodes: ['2', '0'], params: { resistance: 24, watts: 50 } },
      ],
      { kind: 'transient', dt: 2e-5 },
    );
    const sim = new Simulator(doc);
    sim.refresh();
    const out: number[] = [];
    while (sim.t < 0.1) {
      sim.step();
      if (sim.t > 0.05) out.push(sim.frame({ samples: false }).readouts.v2 as number);
    }
    expect(Math.max(...out) - Math.min(...out)).toBeLessThan(0.005);
    expect(out[0]).toBeCloseTo(12, 1);
  });
});
