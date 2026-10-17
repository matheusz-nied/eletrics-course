import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ElementDoc } from '../../engine/contract';
import { sweepOf } from '../runtime/sweep';
import { buildNetlist, createSimulation, getDeviceInfo } from './index';

const wire = (id: string, ...points: [number, number][]): ElementDoc => ({
  id,
  type: 'wire',
  points,
});

/** 12 V battery (a = +) feeding R1 + R2 in series, GND at the bottom. */
const divider: CircuitDoc = {
  id: 'test/divisor',
  title: 'Divisor',
  description: 'Divisor de tensão',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'dc-voltage', a: [0, 0], b: [0, 10], params: { voltage: 12 } },
    { id: 'R1', type: 'resistor', a: [10, 0], b: [10, 5], params: { resistance: 1000 } },
    { id: 'R2', type: 'resistor', a: [10, 5], b: [10, 10], params: { resistance: 2000 } },
    wire('W1', [0, 0], [10, 0]),
    wire('W2', [0, 10], [10, 10]),
    { id: 'G', type: 'ground', at: [0, 10] },
  ],
  probes: [{ id: 'VR2', kind: 'voltage', plus: 'R2.a', minus: 'GND' }],
};

describe('buildNetlist', () => {
  it('joins pins through wires and names the ground node GND', () => {
    const net = buildNetlist(divider);
    expect(net.pins['B1.b']).toBe('GND');
    expect(net.pins['R2.b']).toBe('GND');
    expect(net.pins['B1.a']).toBe(net.pins['R1.a']);
    expect(net.pins['R1.b']).toBe(net.pins['R2.a']);
    expect(net.pins['R1.b']).not.toBe(net.pins['R1.a']);
    expect(net.nodes.map((n) => n.id).sort()).toEqual(['GND', 'n1', 'n2']);
  });

  it('places fixed pins with rotation and flip', () => {
    const doc: CircuitDoc = {
      ...divider,
      elements: [{ id: 'P1', type: 'potentiometer', at: [10, 10], rot: 90 }],
    };
    const net = buildNetlist(doc);
    const point = (pin: string) => net.nodes.find((n) => n.id === net.pins[pin])!.points[0];
    // rot 90 turns clockwise on screen: a [-4,0] → [0,-4]; w [0,-3] → [3,0]
    expect(point('P1.a')).toEqual([10, 6]);
    expect(point('P1.w')).toEqual([13, 10]);
  });
});

describe('operating point', () => {
  it('solves a divider with the real engine sign conventions', async () => {
    const sim = createSimulation();
    const frames: Record<string, number | boolean | string>[] = [];
    sim.subscribe((f) => frames.push(f.readouts));
    await sim.load(divider);
    const r = frames.at(-1)!;
    expect(r.VR2 as number).toBeCloseTo(8, 6);
    expect(r['R1.current'] as number).toBeCloseTo(0.004, 6);
    expect(r['R1.voltage'] as number).toBeCloseTo(4, 6);
    expect(r['R1.power'] as number).toBeCloseTo(0.016, 6);
    // Sources report the current they deliver (out of a, the + pin).
    expect(r['B1.current'] as number).toBeCloseTo(0.004, 6);
    expect(r['B1.power'] as number).toBeCloseTo(0.048, 6);
    // pin.<name>: current entering the part through that pin.
    expect(r['R1.pin.a'] as number).toBeCloseTo(0.004, 6);
    expect(r['B1.pin.a'] as number).toBeCloseTo(-0.004, 6);
  });

  it('updates when a parameter changes while paused', async () => {
    const sim = createSimulation();
    let last: Record<string, number | boolean | string> = {};
    sim.subscribe((f) => (last = f.readouts));
    await sim.load(divider);
    sim.setParam('R2', 'resistance', 1000);
    expect(last.VR2 as number).toBeCloseTo(6, 6);
  });
});

describe('transient', () => {
  const rc: CircuitDoc = {
    id: 'test/rc',
    title: 'RC',
    description: 'Carga de capacitor',
    analysis: { kind: 'transient', dt: 1e-5 },
    elements: [
      { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 10], params: { voltage: 10 } },
      { id: 'R1', type: 'resistor', a: [0, 0], b: [10, 0], params: { resistance: 1000 } },
      { id: 'C1', type: 'capacitor', a: [10, 0], b: [10, 10], params: { capacitance: 1e-6 } },
      wire('W', [0, 10], [10, 10]),
      { id: 'G', type: 'ground', at: [0, 10] },
    ],
    probes: [{ id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND' }],
  };

  it('charges a capacitor with time constant RC', async () => {
    const sim = createSimulation();
    await sim.load(rc);
    const frames = await sim.runUntil(1e-3);
    const last = frames.at(-1)!;
    expect(last.t).toBeCloseTo(1e-3, 6);
    // 10·(1 − e^-1) = 6,32 V (backward Euler is slightly behind)
    expect(last.readouts.VC as number).toBeGreaterThan(6.2);
    expect(last.readouts.VC as number).toBeLessThan(6.4);
    // capacitor current = resistor current
    expect(last.readouts['C1.current'] as number).toBeCloseTo(
      last.readouts['R1.current'] as number,
      5,
    );
  });

  it('shows the circuit at t = 0 before it plays', async () => {
    const sim = createSimulation();
    let last: Record<string, number | boolean | string> = {};
    sim.subscribe((f) => (last = f.readouts));
    await sim.load(rc);
    // the discharged capacitor holds (almost) 0 V: the 10 V are across R1
    expect(last.VC as number).toBeLessThan(0.2);
    expect(last['R1.current'] as number).toBeCloseTo(0.01, 3);
    expect(last['V1.current'] as number).toBeCloseTo(0.01, 3);
  });

  it('recomputes at once when a parameter changes while paused, keeping the charge', async () => {
    const sim = createSimulation();
    let last: Record<string, number | boolean | string> = {};
    sim.subscribe((f) => (last = f.readouts));
    await sim.load(rc);
    await sim.runUntil(1e-3);
    sim.setParam('R1', 'resistance', 2000);
    expect(last.VC as number).toBeGreaterThan(6.2);
    expect(last['R1.current'] as number).toBeCloseTo((10 - (last.VC as number)) / 2000, 6);
  });
});

describe('damage', () => {
  it('burns a LED without a resistor and opens it', async () => {
    const doc: CircuitDoc = {
      id: 'test/led',
      title: 'LED',
      description: 'LED sem resistor',
      analysis: { kind: 'transient', dt: 1e-4 },
      elements: [
        { id: 'B1', type: 'battery', a: [0, 0], b: [0, 10], params: { voltage: 9 } },
        { id: 'D1', type: 'led', a: [0, 0], b: [10, 0] },
        wire('W', [10, 0], [10, 10], [0, 10]),
      ],
    };
    const sim = createSimulation();
    await sim.load(doc);
    const frames = await sim.runUntil(0.1);
    const events = frames.flatMap((f) => f.events);
    expect(events.some((e) => e.kind === 'damaged' && e.element === 'D1')).toBe(true);
    expect(events[0]!.message.replace(/\u00a0/g, ' ')).toMatch(
      /^O LED D1 queimou: corrente de .+ máximo 30 mA\.$/,
    );
    expect(frames.at(-1)!.readouts['D1.burned']).toBe(true);
    // generic flag for anything a 'damaged' event destroyed, until reset
    expect(frames.at(-1)!.readouts['D1.damaged']).toBe(true);
    expect(Math.abs(frames.at(-1)!.readouts['D1.current'] as number)).toBeLessThan(1e-6);
  });

  it('keeps a LED with a 470 Ω resistor near 15 mA', async () => {
    const doc: CircuitDoc = {
      id: 'test/led-ok',
      title: 'LED',
      description: 'LED com resistor',
      analysis: { kind: 'dc' },
      elements: [
        { id: 'B1', type: 'dc-voltage', a: [0, 0], b: [0, 10], params: { voltage: 9 } },
        { id: 'R1', type: 'resistor', a: [0, 0], b: [10, 0], params: { resistance: 470 } },
        { id: 'D1', type: 'led', a: [10, 0], b: [10, 10] },
        wire('W', [10, 10], [0, 10]),
      ],
    };
    const sim = createSimulation();
    await sim.load(doc);
    const [frame] = await sim.runUntil(0);
    const i = frame!.readouts['D1.current'] as number;
    expect(i).toBeGreaterThan(0.013);
    expect(i).toBeLessThan(0.016);
    expect(frame!.readouts['D1.burned']).toBe(false);
  });

  it('blows a fuse on a short circuit', async () => {
    const doc: CircuitDoc = {
      id: 'test/fuse',
      title: 'Fusível',
      description: 'Curto',
      analysis: { kind: 'transient', dt: 1e-4 },
      elements: [
        {
          id: 'B1',
          type: 'battery',
          a: [0, 0],
          b: [0, 10],
          params: { voltage: 12, resistance: 0.1 },
        },
        { id: 'F1', type: 'fuse', a: [0, 0], b: [10, 0], params: { rating: 2 } },
        wire('W', [10, 0], [10, 10], [0, 10]),
      ],
    };
    const sim = createSimulation();
    await sim.load(doc);
    const frames = await sim.runUntil(0.05);
    expect(frames.at(-1)!.readouts['F1.blown']).toBe(true);
    const event = frames.flatMap((f) => f.events).find((e) => e.element === 'F1')!;
    expect(event.message).toContain('O fusível F1 rompeu');
  });
});

describe('level 2 devices (names shared with the real engine)', () => {
  it('trips a breaker on a short and re-arms it when switched back on', async () => {
    const doc: CircuitDoc = {
      id: 'test/breaker',
      title: 'Disjuntor',
      description: 'Curto',
      analysis: { kind: 'transient', dt: 1e-4 },
      elements: [
        {
          id: 'B1',
          type: 'battery',
          a: [0, 0],
          b: [0, 10],
          params: { voltage: 12, resistance: 0.1 },
        },
        { id: 'Q1', type: 'breaker', a: [0, 0], b: [10, 0], params: { rating: 10 } },
        wire('W', [10, 0], [10, 10], [0, 10]),
      ],
    };
    const sim = createSimulation();
    let last: Record<string, number | boolean | string> = {};
    sim.subscribe((f) => (last = f.readouts));
    await sim.load(doc);
    const frames = await sim.runUntil(0.01);
    const r = frames.at(-1)!.readouts;
    expect(r['Q1.tripped']).toBe(true);
    expect(r['Q1.closed']).toBe(false);
    expect(frames.flatMap((f) => f.events).some((e) => e.kind === 'tripped')).toBe(true);
    sim.setParam('Q1', 'closed', true);
    expect(last['Q1.tripped']).toBe(false);
    expect(last['Q1.closed']).toBe(true);
  });

  it('moves the relay armature over its travel time', async () => {
    const doc: CircuitDoc = {
      id: 'test/relay',
      title: 'Relé',
      description: 'Bobina ligada a 12 V',
      analysis: { kind: 'transient', dt: 1e-4 },
      elements: [
        { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 14], params: { voltage: 12 } },
        // coil1 (16,5), coil2 (16,13), com (22,13), nc (20,5), no (24,5)
        {
          id: 'K1',
          type: 'relay-spdt',
          at: [20, 9],
          params: { coilInductance: 0, travelTime: 0.01 },
        },
        wire('W1', [0, 0], [16, 0], [16, 5]),
        wire('W2', [16, 13], [16, 14], [0, 14]),
        // load from + to the NO contact; COM to ground, like the coil's coil2
        { id: 'R1', type: 'resistor', a: [24, 0], b: [24, 5], params: { resistance: 120 } },
        wire('W3', [16, 0], [24, 0]),
        wire('W4', [22, 13], [22, 14], [16, 14]),
        { id: 'G', type: 'ground', at: [0, 14] },
      ],
    };
    const sim = createSimulation();
    await sim.load(doc);
    const half = (await sim.runUntil(0.005)).at(-1)!.readouts;
    expect(half['K1.energized']).toBe(true);
    expect(half['K1.position'] as number).toBeGreaterThan(0.3);
    expect(half['K1.position'] as number).toBeLessThan(0.7);
    expect(half['K1.closed']).toBe(false);
    const done = (await sim.runUntil(0.02)).at(-1)!.readouts;
    expect(done['K1.position']).toBe(1);
    expect(done['K1.closed']).toBe(true);
    expect(done['K1.welded']).toBe(false);
    // two pins on ground: each one still reports its own current
    expect(done['K1.pin.no'] as number).toBeCloseTo(0.1, 4);
    expect(done['K1.pin.com'] as number).toBeCloseTo(-0.1, 4);
    expect(done['K1.pin.coil1'] as number).toBeCloseTo(0.03, 4);
    expect(done['K1.pin.coil2'] as number).toBeCloseTo(-0.03, 4);
  });

  it('reports the inputs and the output of a logic gate', async () => {
    const doc: CircuitDoc = {
      id: 'test/gate',
      title: 'Porta',
      description: 'Porta OR',
      analysis: { kind: 'dc' },
      elements: [
        { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 14], params: { voltage: 5 } },
        // a (16,9), b (16,11), y (24,10)
        { id: 'U1', type: 'or', at: [20, 10] },
        wire('W1', [0, 0], [16, 0], [16, 9]),
        wire('W2', [16, 11], [16, 14], [0, 14]),
        { id: 'R1', type: 'resistor', a: [24, 10], b: [24, 14], params: { resistance: 1000 } },
        wire('W3', [24, 14], [16, 14]),
        { id: 'G', type: 'ground', at: [0, 14] },
      ],
    };
    const sim = createSimulation();
    await sim.load(doc);
    const [frame] = await sim.runUntil(0);
    expect(frame!.readouts['U1.a']).toBe(true);
    expect(frame!.readouts['U1.b']).toBe(false);
    expect(frame!.readouts['U1.y']).toBe(true);
  });

  it('classifies a shock in the zones of IEC 60479', async () => {
    const doc = (kind: 'dc-voltage' | 'ac-voltage'): CircuitDoc => ({
      id: 'test/choque',
      title: 'Choque',
      description: 'Corrente pelo corpo',
      analysis: { kind: 'transient', dt: 2e-4 },
      elements: [
        {
          id: 'V1',
          type: kind,
          a: [0, 0],
          b: [0, 10],
          params: kind === 'dc-voltage' ? { voltage: 100 } : { amplitude: 100, frequency: 60 },
        },
        { id: 'H1', type: 'human-body', a: [0, 0], b: [10, 0], params: { resistance: 1000 } },
        wire('W', [10, 0], [10, 10], [0, 10]),
      ],
    });
    // 100 mA dc: strong contractions, below the dc fibrillation threshold
    const dc = createSimulation();
    await dc.load(doc('dc-voltage'));
    expect((await dc.runUntil(0.1)).at(-1)!.readouts['H1.zone']).toBe('DC-3');
    // 71 mA rms at 60 Hz: fibrillation is likely
    const ac = createSimulation();
    await ac.load(doc('ac-voltage'));
    const frames = await ac.runUntil(0.1);
    const r = frames.at(-1)!.readouts;
    expect(r['H1.zone']).toBe('AC-4');
    expect(r['H1.worst']).toBe('AC-4');
    expect(r['H1.effect']).toMatch(/fibrilação/);
    expect(frames.flatMap((f) => f.events).some((e) => e.kind === 'warning')).toBe(true);
  });

  it('opens a residual-current device on a leak to earth', async () => {
    const doc: CircuitDoc = {
      id: 'test/dr',
      title: 'DR',
      description: 'Fuga para a terra',
      analysis: { kind: 'transient', dt: 2e-4 },
      elements: [
        {
          id: 'V1',
          type: 'ac-voltage',
          a: [0, 2],
          b: [0, 8],
          params: { amplitude: 180, frequency: 60 },
        },
        // l1 (6,2), n1 (6,8), l2 (14,2), n2 (14,8)
        { id: 'DR1', type: 'rcd', at: [10, 5] },
        wire('W1', [0, 2], [6, 2]),
        wire('W2', [0, 8], [6, 8]),
        { id: 'R1', type: 'resistor', a: [14, 2], b: [14, 8], params: { resistance: 100 } },
        wire('W3', [14, 2], [18, 2]),
        { id: 'R2', type: 'resistor', a: [18, 2], b: [18, 10], params: { resistance: 10000 } },
        wire('W4', [18, 10], [0, 10], [0, 8]),
        { id: 'G', type: 'ground', at: [0, 8] },
      ],
    };
    // 13 mA of leak: below the 30 mA sensitivity
    const sim = createSimulation();
    await sim.load(doc);
    let r = (await sim.runUntil(0.1)).at(-1)!.readouts;
    expect(r['DR1.tripped']).toBe(false);
    expect(r['DR1.residual'] as number).toBeGreaterThan(0.01);
    // the test button trips it
    sim.setParam('DR1', 'test', true);
    r = (await sim.runUntil(0.2)).at(-1)!.readouts;
    expect(r['DR1.tripped']).toBe(true);
    expect(r['DR1.closed']).toBe(false);
    expect(Math.abs(r['R1.current'] as number)).toBeLessThan(1e-3);
  });
});

describe('ac sweep', () => {
  it('gives -3 dB and -45° at the RC cut-off frequency', async () => {
    const doc: CircuitDoc = {
      id: 'test/bode',
      title: 'Filtro RC',
      description: 'Passa-baixas',
      analysis: { kind: 'ac-sweep', source: 'V1', fStart: 10, fStop: 100000, points: 41 },
      elements: [
        { id: 'V1', type: 'ac-voltage', a: [0, 0], b: [0, 10] },
        { id: 'R1', type: 'resistor', a: [0, 0], b: [10, 0], params: { resistance: 1000 } },
        { id: 'C1', type: 'capacitor', a: [10, 0], b: [10, 10], params: { capacitance: 1e-7 } },
        wire('W', [0, 10], [10, 10]),
        { id: 'G', type: 'ground', at: [0, 10] },
      ],
      probes: [{ id: 'VO', kind: 'voltage', plus: 'C1.a', minus: 'GND' }],
    };
    const sim = createSimulation();
    await sim.load(doc);
    const frames = await sim.runUntil(0);
    const sweep = sweepOf(frames)!;
    expect(sweep.f).toHaveLength(41);
    expect(sweep.magnitude.VO).toHaveLength(41);
    const fc = 1 / (2 * Math.PI * 1000 * 1e-7); // 1.59 kHz
    const near = sweep.f.reduce(
      (best, f, i) =>
        Math.abs(Math.log(f / fc)) < Math.abs(Math.log(sweep.f[best]! / fc)) ? i : best,
      0,
    );
    const db = 20 * Math.log10(sweep.magnitude.VO![near]!);
    expect(db).toBeGreaterThan(-4);
    expect(db).toBeLessThan(-2);
    expect(sweep.phase.VO![near]!).toBeGreaterThan(-55);
    expect(sweep.phase.VO![near]!).toBeLessThan(-35);
  });
});

describe('getDeviceInfo', () => {
  it('describes devices with pt-BR labels', () => {
    const info = getDeviceInfo('resistor');
    expect(info.label).toBe('Resistor');
    expect(info.params.resistance!.unit).toBe('Ω');
    expect(getDeviceInfo('relay-spdt').pins.map((p) => p.name)).toEqual([
      'coil1',
      'coil2',
      'com',
      'nc',
      'no',
    ]);
  });

  it('gives instance pins for a DIP switch', () => {
    expect(getDeviceInfo('dip-switch', { positions: 3 }).pins).toHaveLength(6);
  });
});
