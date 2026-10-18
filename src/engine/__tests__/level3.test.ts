import { describe, expect, it } from 'vitest';
import type { CircuitDoc, SimEvent, SimFrame } from '../contract';
import { Simulator } from '../analysis/simulator';
import { phaseControlFactor } from '../devices/triac';
import { getDeviceInfo, validateCircuit } from '../index';
import { gateCircuit } from './gate-circuit';
import { loop, netlist, runFor, type NetPart } from './utils';

const r = (frame: SimFrame, key: string) => frame.readouts[key] as number;
const qs = (dtMech = 0.01): CircuitDoc['analysis'] => ({
  kind: 'quasi-static',
  frequency: 60,
  dtMech,
});

/** A simulator that collects every event as it steps. */
class Bench {
  readonly sim: Simulator;
  readonly events: SimEvent[] = [];
  constructor(doc: CircuitDoc) {
    this.sim = new Simulator(doc);
    this.sim.refresh();
    this.events.push(...this.sim.frame({ samples: false }).events);
  }
  run(seconds: number, each?: (frame: SimFrame) => void): SimFrame {
    const steps = Math.round(seconds / this.sim.dt);
    for (let i = 0; i < steps; i++) {
      this.sim.step();
      if (each || i % 20 === 0 || i === steps - 1) {
        const frame = this.sim.frame({ samples: false });
        this.events.push(...frame.events);
        each?.(frame);
      }
    }
    return this.frame;
  }
  /** Runs until `done` holds, failing after `max` seconds; returns the time it took. */
  until(done: (frame: SimFrame) => boolean, max: number): number {
    const start = this.sim.t;
    const steps = Math.round(max / this.sim.dt);
    for (let i = 0; i < steps; i++) {
      this.sim.step();
      const frame = this.sim.frame({ samples: false });
      this.events.push(...frame.events);
      if (done(frame)) return this.sim.t - start;
    }
    throw new Error(`condition not met in ${max} s`);
  }
  set(element: string, param: string, value: number | boolean | string): void {
    this.sim.setParam(element, param, value);
  }
  get frame(): SimFrame {
    return this.sim.frame({ samples: false });
  }
  said(text: string): SimEvent | undefined {
    return this.events.find((e) => e.message.includes(text));
  }
}

const mains = (voltage = 127): NetPart => ({
  id: 'AC',
  type: 'mains',
  nodes: { l: 'L', n: '0', pe: '0' },
  params: { voltage },
});

describe('quasi-static analysis', () => {
  it('matches the phasor solution of an RL circuit and steps at dtMech', () => {
    // 10 V peak at 60 Hz on 10 Ω + j10 Ω: 0,5 A RMS, 5 V RMS on each part.
    const doc = netlist(
      'qs-rl',
      [
        { id: 'VA', type: 'ac-voltage', nodes: ['A', '0'], params: { amplitude: 10 } },
        { id: 'R1', type: 'resistor', nodes: ['A', 'B'], params: { resistance: 10 } },
        {
          id: 'L1',
          type: 'inductor',
          nodes: ['B', '0'],
          params: { inductance: 10 / (120 * Math.PI) },
        },
      ],
      qs(0.02),
    );
    const { sim, frame } = runFor(doc, 0.1);
    expect(sim.dt).toBe(0.02);
    expect(frame.t).toBeCloseTo(0.1, 9);
    expect(r(frame, 'R1.current')).toBeCloseTo(0.5, 6);
    expect(r(frame, 'R1.voltage')).toBeCloseTo(5, 5);
    expect(r(frame, 'L1.voltage')).toBeCloseTo(5, 5);
    expect(r(frame, 'R1.power')).toBeCloseTo(2.5, 5);
    expect(frame.nodeVoltages[Object.keys(frame.nodeVoltages)[0]]).toBeDefined();
    expect(r(frame, 'vA')).toBeCloseTo(10 / Math.SQRT2, 5);
    // Phasor at B: 5∠−45° plus... magnitude only: 5 V RMS.
    expect(r(frame, 'vB')).toBeCloseTo(5, 5);
  });

  it('adds the DC and AC parts as true RMS', () => {
    // 3 V DC + 4 V RMS on 1 Ω: 5 A RMS, 25 W.
    const doc = netlist(
      'qs-dc-ac',
      [
        {
          id: 'VA',
          type: 'ac-voltage',
          nodes: ['A', '0'],
          params: { amplitude: 4 * Math.SQRT2, offset: 3 },
        },
        { id: 'R1', type: 'resistor', nodes: ['A', '0'], params: { resistance: 1 } },
      ],
      qs(),
    );
    const { frame } = runFor(doc, 0.05);
    expect(r(frame, 'R1.current')).toBeCloseTo(5, 4);
    expect(r(frame, 'R1.power')).toBeCloseTo(25, 3);
  });

  it('warns about a source at another frequency and rejects devices it cannot run', () => {
    const at50 = netlist(
      'qs-50hz',
      [
        { id: 'VA', type: 'ac-voltage', nodes: ['A', '0'], params: { frequency: 50 } },
        { id: 'R1', type: 'resistor', nodes: ['A', '0'] },
      ],
      qs(),
    );
    const result = validateCircuit(at50);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/50 Hz/);
    // A source off the analysis frequency gives no AC at all.
    expect(r(runFor(at50, 0.02).frame, 'R1.current')).toBeCloseTo(0, 9);

    const motorInTransient = netlist(
      'motor-transient',
      [
        { id: 'VA', type: 'ac-voltage', nodes: ['A', '0'] },
        { id: 'M1', type: 'ac-motor-1ph-cap', nodes: { w1: 'A', w2: 'A', common: '0' } },
      ],
      { kind: 'transient', dt: 1e-4 },
    );
    expect(validateCircuit(motorInTransient).errors.join(' ')).toMatch(/não funciona na análise/);
  });
});

describe('mains', () => {
  it('feeds a lamp at its rated power with unity power factor, and switches off', () => {
    const doc = netlist(
      'mains-lamp',
      [
        mains(),
        { id: 'H1', type: 'lamp', nodes: ['L', '0'], params: { voltage: 127, power: 100 } },
      ],
      qs(),
    );
    const b = new Bench(doc);
    const on = b.run(1);
    // 0,3 Ω of source impedance takes a little of the 127 V.
    expect(r(on, 'AC.voltage')).toBeGreaterThan(126.5);
    expect(r(on, 'AC.current')).toBeCloseTo(100 / 127, 2);
    expect(r(on, 'AC.power')).toBeCloseTo(100, 0);
    expect(r(on, 'AC.powerFactor')).toBeCloseTo(1, 6);
    b.set('AC', 'on', false);
    expect(r(b.run(0.5), 'AC.current')).toBeLessThan(1e-6);
  });

  it('reports the power factor of a motor', () => {
    const doc = netlist('mains-motor', [mains(), ...motor({})], qs());
    const frame = runFor(doc, 2).frame;
    expect(r(frame, 'AC.powerFactor')).toBeGreaterThan(0.5);
    expect(r(frame, 'AC.powerFactor')).toBeLessThan(1);
  });
});

/** Mains straight to a gate motor and its capacitor (no central). */
function motor(opts: {
  /** Winding that gets the phase directly (the capacitor feeds the other). */
  phase?: 'w1' | 'w2' | 'both';
  capacitor?: Record<string, string | number | boolean>;
  params?: Record<string, string | number | boolean>;
}): NetPart[] {
  const phase = opts.phase ?? 'w1';
  const w1 = phase === 'w2' ? 'W1' : 'L';
  const w2 = phase === 'w1' ? 'W2' : 'L';
  const parts: NetPart[] = [
    { id: 'M1', type: 'ac-motor-1ph-cap', nodes: { w1, w2, common: '0' }, params: opts.params },
  ];
  if (phase !== 'both') {
    parts.push({
      id: 'C1',
      type: 'capacitor',
      nodes: phase === 'w1' ? ['L', 'W2'] : ['L', 'W1'],
      params: { capacitance: 25e-6, voltage: 250, acRated: true, ...opts.capacitor },
    });
  }
  return parts;
}

describe('ac-motor-1ph-cap', () => {
  const run = (opts: Parameters<typeof motor>[0], dtMech = 0.01) =>
    new Bench(netlist('motor', [mains(), ...motor(opts)], qs(dtMech)));

  it('starts and runs near synchronous speed the way of the winding with the phase', () => {
    const b = run({});
    let locked = 0;
    b.run(0.01, (f) => (locked = r(f, 'M1.current')));
    const frame = b.run(2);
    expect(r(frame, 'M1.rpm')).toBeGreaterThan(1750);
    expect(r(frame, 'M1.rpm')).toBeLessThan(1800);
    expect(r(frame, 'M1.direction')).toBe(1);
    expect(frame.readouts['M1.humming']).toBe(false);
    // Locked-rotor current several times the running current.
    expect(locked).toBeGreaterThan(4);
    expect(locked / r(frame, 'M1.current')).toBeGreaterThan(3);
    expect(r(frame, 'M1.power')).toBeGreaterThan(0);
    expect(b.events.filter((e) => e.kind !== 'info')).toEqual([]);
  });

  it('turns the other way when the capacitor goes to the other side (05-portao.md, 5.4)', () => {
    const frame = run({ phase: 'w2' }).run(2);
    expect(r(frame, 'M1.rpm')).toBeLessThan(-1750);
    expect(r(frame, 'M1.direction')).toBe(-1);
  });

  it('hums and does not start without a working capacitor, or with both windings on the phase', () => {
    for (const opts of [{ capacitor: { fault: 'open' } }, { phase: 'both' as const }]) {
      const frame = run(opts).run(1);
      expect(Math.abs(r(frame, 'M1.rpm'))).toBeLessThan(1);
      expect(frame.readouts['M1.humming']).toBe(true);
      expect(r(frame, 'M1.current')).toBeGreaterThan(4);
      expect(r(frame, 'M1.torque')).toBeCloseTo(0, 6);
    }
  });

  it('starts slower with a weak capacitor, and hums with a shorted one', () => {
    const time = (capacitor: Record<string, string>) =>
      run({ capacitor, params: { load: 0.1 } }).until((f) => r(f, 'M1.rpm') > 1500, 10);
    expect(time({ fault: 'weak' })).toBeGreaterThan(1.5 * time({}));
    // A shorted capacitor puts the phase on both windings: no start under load.
    const shorted = run({ capacitor: { fault: 'short' }, params: { load: 0.1 } }).run(1);
    expect(shorted.readouts['M1.humming']).toBe(true);
  });

  it('opens its thermal protector when locked, and closes it again once cool', () => {
    const b = run({ capacitor: { fault: 'open' } }, 0.1);
    const opened = b.until((f) => f.readouts['M1.protector'] === true, 120);
    expect(opened).toBeGreaterThan(20);
    expect(b.said('protetor térmico do motor M1 abriu')?.kind).toBe('warning');
    const off = b.run(1);
    expect(r(off, 'M1.current')).toBeLessThan(0.01);
    expect(off.readouts['M1.humming']).toBe(false);
    b.until((f) => f.readouts['M1.protector'] === false, 3000);
    expect(b.said('fechou de novo')?.kind).toBe('info');
    expect(r(b.frame, 'M1.temperature')).toBeLessThanOrEqual(85);
  });

  it('reads as two windings to an ohmmeter (DC)', () => {
    const doc = netlist('motor-ohm', [
      { id: 'V1', type: 'dc-voltage', nodes: ['A', '0'], params: { voltage: 1 } },
      { id: 'M1', type: 'ac-motor-1ph-cap', nodes: { w1: 'A', w2: '0', common: 'C' } },
    ]);
    const { frame } = runFor(doc);
    // ABRE–FECHA: both windings in series, 14 Ω; the common sits in the middle.
    expect(Math.abs(r(frame, 'V1.current'))).toBeCloseTo(1 / 14, 4);
    expect(r(frame, 'vC')).toBeCloseTo(0.5, 3);
  });

  it('documents its pins, parameters and readouts in pt-BR', () => {
    const info = getDeviceInfo('ac-motor-1ph-cap');
    expect(info.pins.map((p) => p.name)).toEqual(['w1', 'w2', 'common']);
    expect(info.params.poles.label).toBe('Número de polos');
    expect(info.readouts).toContain('humming');
  });
});

describe('gate-mechanics', () => {
  const gate = (params: Record<string, string | number | boolean> = {}) =>
    new Bench(
      netlist(
        'gate',
        [
          mains(),
          ...motor({}),
          { id: 'G1', type: 'gate-mechanics', nodes: {}, params: { motor: 'M1', ...params } },
        ],
        qs(),
      ),
    );

  it('moves the gate at about 15 m/min and stops it against the end stop', () => {
    const b = gate();
    const frame = b.run(4);
    expect(r(frame, 'G1.velocity')).toBeGreaterThan(0.24);
    expect(r(frame, 'G1.velocity')).toBeLessThan(0.27);
    expect(frame.readouts['G1.state']).toBe('abrindo');
    expect(r(frame, 'G1.force')).toBeGreaterThan(90);
    b.until((f) => f.readouts['G1.blocked'] === true, 20);
    const end = b.run(0.5);
    expect(r(end, 'G1.distance')).toBe(4);
    expect(r(end, 'G1.position')).toBe(1);
    expect(end.readouts['G1.state']).toBe('aberto');
    expect(Math.abs(r(end, 'M1.rpm'))).toBeLessThan(1);
    expect(end.readouts['M1.humming']).toBe(true);
    expect(b.said('batente de abertura')).toBeDefined();
  });

  it('opens the other way with the motor mounted on the other side', () => {
    const frame = gate({ invert: true, position: 2 }).run(3);
    expect(r(frame, 'G1.velocity')).toBeLessThan(-0.24);
    expect(frame.readouts['G1.state']).toBe('fechando');
  });

  it('is braked by the worm gear when the power goes', () => {
    const b = gate();
    b.run(3);
    const at = r(b.frame, 'G1.distance');
    b.set('AC', 'on', false);
    const frame = b.run(1);
    expect(r(frame, 'G1.velocity')).toBe(0);
    expect(r(frame, 'G1.distance') - at).toBeLessThan(0.06);
    expect(frame.readouts['G1.state']).toBe('parado');
  });

  it('stays put while released, the motor spinning free', () => {
    const b = gate({ released: true });
    const frame = b.run(2);
    expect(r(frame, 'G1.distance')).toBe(0);
    expect(r(frame, 'M1.rpm')).toBeGreaterThan(1750);
    b.set('G1', 'released', false);
    expect(r(b.run(2), 'G1.distance')).toBeGreaterThan(0.2);
  });

  it('stops against someone holding it, and slows on a stiff stretch of track', () => {
    const held = gate({ hold: true, holdAt: 0.5 });
    held.run(5);
    expect(held.frame.readouts['G1.blocked']).toBe(true);
    expect(r(held.frame, 'G1.distance')).toBeCloseTo(0.5, 6);
    const free = gate({ position: 1.6 }).run(1.5);
    const stiff = gate({ position: 1.6, extraFriction: 120 }).run(1.5);
    expect(r(stiff, 'G1.velocity')).toBeLessThan(r(free, 'G1.velocity'));
    expect(r(stiff, 'M1.current')).toBeGreaterThan(r(free, 'M1.current'));
  });

  it('only couples to a motor', () => {
    const doc = netlist(
      'gate-bad-link',
      [
        mains(),
        { id: 'R1', type: 'resistor', nodes: ['L', '0'] },
        { id: 'G1', type: 'gate-mechanics', nodes: {}, params: { motor: 'R1' } },
        { id: 'G2', type: 'gate-mechanics', nodes: {}, params: { motor: 'X9' } },
      ],
      qs(),
    );
    const errors = validateCircuit(doc).errors.join('\n');
    expect(errors).toMatch(/G1/);
    expect(errors).toMatch(/G2/);
  });
});

describe('reed-switch', () => {
  const reed = (params: Record<string, string | number | boolean>, gateAt?: number) => {
    const parts: NetPart[] = [
      { id: 'V1', type: 'dc-voltage', nodes: ['A', '0'], params: { voltage: 5 } },
      { id: 'R1', type: 'resistor', nodes: ['A', 'B'], params: { resistance: 1000 } },
      { id: 'S1', type: 'reed-switch', nodes: ['B', '0'], params },
    ];
    if (gateAt !== undefined)
      parts.push({ id: 'G1', type: 'gate-mechanics', nodes: {}, params: { position: gateAt } });
    return runFor(netlist('reed', parts)).frame;
  };

  it('closes with the magnet near, on its own or on a gate', () => {
    expect(r(reed({ closed: true }), 'R1.current')).toBeCloseTo(5 / 1000.1, 6);
    expect(r(reed({ closed: false }), 'R1.current')).toBeLessThan(1e-6);
    expect(reed({ gate: 'G1', magnet: 1.02 }, 1).readouts['S1.closed']).toBe(true);
    expect(reed({ gate: 'G1', magnet: 1.1 }, 1).readouts['S1.closed']).toBe(false);
    expect(reed({ gate: 'G1', magnet: 1.1, zone: 0.15 }, 1).readouts['S1.closed']).toBe(true);
  });

  it('never closes when defective', () => {
    expect(reed({ closed: true, defective: true }).readouts['S1.closed']).toBe(false);
  });
});

describe('photocell', () => {
  const cell = (supply: number, params: Record<string, boolean> = {}) =>
    runFor(
      netlist('photocell', [
        { id: 'V1', type: 'dc-voltage', nodes: ['V', '0'], params: { voltage: supply } },
        {
          id: 'PH',
          type: 'photocell',
          nodes: { vp: 'V', gnd: '0', nc: 'NC', com: '0', no: 'NO' },
          params,
        },
        { id: 'RNC', type: 'resistor', nodes: ['V', 'NC'], params: { resistance: 10000 } },
        { id: 'RNO', type: 'resistor', nodes: ['V', 'NO'], params: { resistance: 10000 } },
      ]),
      0.1,
    ).frame;

  it('keeps NC closed while the beam is clear and swaps when it is broken', () => {
    const clear = cell(12);
    expect(clear.readouts['PH.powered']).toBe(true);
    expect(clear.readouts['PH.beam']).toBe(true);
    expect(r(clear, 'vNC')).toBeLessThan(0.01);
    expect(r(clear, 'vNO')).toBeCloseTo(12, 2);
    // The transmitter and receiver draw about 40 mA from 12 V.
    expect(Math.abs(r(clear, 'V1.current'))).toBeGreaterThan(0.035);
    for (const params of [{ blocked: true }, { misaligned: true }] as Record<string, boolean>[]) {
      const broken = cell(12, params);
      expect(broken.readouts['PH.beam']).toBe(false);
      expect(r(broken, 'vNC')).toBeCloseTo(12, 2);
      expect(r(broken, 'vNO')).toBeLessThan(0.01);
    }
  });

  it('reads as a broken beam without power (fails safe)', () => {
    const off = cell(6);
    expect(off.readouts['PH.powered']).toBe(false);
    expect(r(off, 'vNC')).toBeCloseTo(6, 2);
  });
});

describe('rf-receiver', () => {
  const receiver = (supply = 5) =>
    new Bench(
      netlist('rf', [
        { id: 'V1', type: 'dc-voltage', nodes: ['V', '0'], params: { voltage: supply } },
        { id: 'RX', type: 'rf-receiver', nodes: { vp: 'V', gnd: '0', out: 'D' } },
      ]),
    );
  const press = (b: Bench, param = 'press') => {
    b.set('RX', param, true);
    b.run(0.01);
    b.set('RX', param, false);
    return b.run(0.01);
  };

  it('delivers one frame per press when powered, with the remote and button', () => {
    const b = receiver();
    b.set('RX', 'button', 2);
    b.set('RX', 'remote', '9E04B7');
    const frame = press(b);
    expect(frame.readouts['RX.powered']).toBe(true);
    expect(r(frame, 'RX.sent')).toBe(1);
    expect(frame.readouts['RX.lastSerial']).toBe('9E04B7');
    expect(r(frame, 'RX.lastButton')).toBe(2);
    press(b);
    expect(r(press(b, 'replay'), 'RX.sent')).toBe(3);
  });

  it('sends nothing without power', () => {
    const b = receiver(2);
    const frame = press(b);
    expect(frame.readouts['RX.powered']).toBe(false);
    expect(r(frame, 'RX.sent')).toBe(0);
  });
});

describe('mcu', () => {
  const FIRMWARE = 'm16/central-generica';

  it('takes its pins and readouts from the firmware', () => {
    const info = getDeviceInfo('mcu', { firmware: FIRMWARE });
    const pins = Object.fromEntries(info.pins.map((p) => [p.name, p]));
    // Inputs on the left, outputs on the right, the radio input added.
    expect(pins.FCA.offset[0]).toBe(-6);
    expect(pins.K1.offset[0]).toBe(6);
    expect(pins.RF.offset[0]).toBe(-6);
    expect(pins.FCA.label).toBe('Fim de curso de abertura');
    expect(pins.vcc.offset[1]).toBeLessThan(pins.FCA.offset[1]);
    expect(info.readouts).toContain('level.FCA');
    expect(info.readouts).toContain('estado');
    // Without a firmware it is only the supply pins.
    expect(getDeviceInfo('mcu').pins.map((p) => p.name)).toEqual(['vcc', 'gnd']);
    const moved = getDeviceInfo('mcu', { firmware: FIRMWARE, pinsRight: 'FCA' });
    expect(moved.pins.find((p) => p.name === 'FCA')!.offset[0]).toBe(6);
  });

  it('needs a firmware that exists', () => {
    const doc = (firmware: string) =>
      netlist('mcu-firmware', [
        { id: 'V1', type: 'dc-voltage', nodes: ['V', '0'] },
        { id: 'U1', type: 'mcu', nodes: { vcc: 'V', gnd: '0' }, params: { firmware } },
      ]);
    expect(validateCircuit(doc('m99/nada')).errors.join(' ')).toMatch(
      /firmware "m99\/nada" não existe.*m16\/central-generica/,
    );
    expect(validateCircuit(doc('')).errors.join(' ')).toMatch(/precisa de um firmware/);
    expect(validateCircuit(doc(FIRMWARE)).errors).toEqual([]);
  });

  it('reads its inputs and drives its outputs', () => {
    const b = new Bench(gateCircuit());
    b.run(0.2);
    // The closing limit switch pulls FCF low; FCA floats high on its pull-up.
    expect(b.frame.readouts['U1.level.FCF']).toBe(false);
    expect(b.frame.readouts['U1.level.FCA']).toBe(true);
    expect(r(b.frame, 'U1.level.FORCA')).toBeCloseTo(2.5, 1);
    b.set('BOT', 'pressed', true);
    b.run(0.5);
    const frame = b.frame;
    expect(frame.readouts['U1.level.K1']).toBe(true);
    expect(r(frame, 'vK1B')).toBeGreaterThan(4.5);
    expect(frame.readouts['K1.energized']).toBe(true);
  });

  it('stops below the brown-out voltage and keeps its memory (EEPROM)', () => {
    const b = new Bench(gateCircuit());
    b.run(0.2);
    b.set('PROG', 'pressed', true);
    b.run(0.1);
    b.set('PROG', 'pressed', false);
    b.set('RX', 'press', true);
    b.run(0.1);
    b.set('RX', 'press', false);
    expect(r(b.run(0.1), 'U1.controles')).toBe(1);
    b.set('V5', 'voltage', 2.5);
    const off = b.run(0.2);
    expect(off.readouts['U1.powered']).toBe(false);
    expect(off.readouts['U1.estado']).toBeUndefined();
    expect(b.said('O microcontrolador U1 desligou')).toBeDefined();
    b.set('V5', 'voltage', 5);
    const on = b.run(0.2);
    expect(on.readouts['U1.powered']).toBe(true);
    expect(r(on, 'U1.controles')).toBe(1);
  });
});

describe('jumper', () => {
  it('connects its pins only when fitted', () => {
    const current = (fitted: boolean) =>
      r(
        runFor(
          loop('jumper', [
            { id: 'V1', type: 'dc-voltage', params: { voltage: 5 } },
            { id: 'R1', type: 'resistor', params: { resistance: 1000 } },
            { id: 'J1', type: 'jumper', params: { fitted } },
          ]),
        ).frame,
        'R1.current',
      );
    expect(current(true)).toBeCloseTo(0.005, 6);
    expect(current(false)).toBeLessThan(1e-6);
  });
});

describe('dip-switch', () => {
  it('has a pair of pins per switch and closes the ones that are on', () => {
    expect(getDeviceInfo('dip-switch', { positions: 3 }).pins.map((p) => p.name)).toEqual([
      'a1',
      'b1',
      'a2',
      'b2',
      'a3',
      'b3',
    ]);
    const { frame } = runFor(
      netlist('dip', [
        { id: 'V1', type: 'dc-voltage', nodes: ['V', '0'], params: { voltage: 5 } },
        { id: 'R1', type: 'resistor', nodes: ['V', 'A1'], params: { resistance: 1000 } },
        { id: 'R2', type: 'resistor', nodes: ['V', 'A2'], params: { resistance: 1000 } },
        {
          id: 'S1',
          type: 'dip-switch',
          nodes: { a1: 'A1', b1: '0', a2: 'A2', b2: '0' },
          params: { s2: true },
        },
      ]),
    );
    expect(r(frame, 'vA1')).toBeCloseTo(5, 3);
    expect(r(frame, 'vA2')).toBeLessThan(0.01);
  });
});

describe('trimpot', () => {
  it('divides the voltage at its cursor and is rated a quarter watt', () => {
    const { frame } = runFor(
      netlist('trimpot', [
        { id: 'V1', type: 'dc-voltage', nodes: ['V', '0'], params: { voltage: 5 } },
        { id: 'P1', type: 'trimpot', nodes: { a: '0', w: 'W', b: 'V' }, params: { position: 0.3 } },
      ]),
    );
    expect(r(frame, 'vW')).toBeCloseTo(1.5, 3);
    expect(getDeviceInfo('trimpot').params.watts.default).toBe(0.25);
    expect(getDeviceInfo('potentiometer').params.watts.default).toBe(0.5);
  });
});

describe('electric-lock', () => {
  const lock = (doc: CircuitDoc) => runFor(doc, 0.1).frame;
  it('opens at its rated voltage, DC or AC RMS, and not well below it', () => {
    const dc = (voltage: number) =>
      lock(
        loop('lock', [
          { id: 'V1', type: 'dc-voltage', params: { voltage } },
          { id: 'LK', type: 'electric-lock' },
        ]),
      );
    expect(dc(12).readouts['LK.open']).toBe(true);
    expect(r(dc(12), 'LK.current')).toBeCloseTo(1, 3);
    expect(dc(6).readouts['LK.open']).toBe(false);
    const ac = lock(
      netlist('lock-ac', [mains(12), { id: 'LK', type: 'electric-lock', nodes: ['L', '0'] }], qs()),
    );
    expect(ac.readouts['LK.open']).toBe(true);
  });
});

describe('current-sensor', () => {
  it('gives 0,5 V per ampere RMS, AC or DC, up to its full scale', () => {
    const sensed = (load: number) =>
      runFor(
        netlist(
          'sensor',
          [
            mains(),
            {
              id: 'R1',
              type: 'resistor',
              nodes: ['L', 'S'],
              params: { resistance: load, watts: 5000 },
            },
            { id: 'CS', type: 'current-sensor', nodes: { a: 'S', b: '0', out: 'O', gnd: '0' } },
          ],
          qs(),
        ),
        1,
      ).frame;
    const three = sensed(127 / 3);
    expect(r(three, 'CS.measured')).toBeCloseTo(3, 1);
    expect(r(three, 'vO')).toBeCloseTo(1.5, 1);
    // 20 A is past the 10 A full scale: the output saturates at 5 V.
    expect(r(sensed(127 / 20), 'vO')).toBeCloseTo(5, 1);
    const dc = runFor(
      netlist(
        'sensor-dc',
        [
          { id: 'V1', type: 'dc-voltage', nodes: ['V', '0'], params: { voltage: 2 } },
          { id: 'R1', type: 'resistor', nodes: ['V', 'S'], params: { resistance: 1, watts: 10 } },
          { id: 'CS', type: 'current-sensor', nodes: { a: 'S', b: '0', out: 'O', gnd: '0' } },
        ],
        { kind: 'transient', dt: 1e-3 },
      ),
      0.5,
    ).frame;
    expect(r(dc, 'vO')).toBeCloseTo(1, 2);
  });
});

describe('triac in the quasi-static analysis', () => {
  it('lets through the fundamental of a phase-controlled sine', () => {
    expect(phaseControlFactor(1).re).toBeCloseTo(1, 12);
    expect(phaseControlFactor(1).im).toBeCloseTo(0, 12);
    expect(phaseControlFactor(0).re).toBeCloseTo(0, 12);
    const half = phaseControlFactor(0.5);
    expect(half.re).toBeCloseTo(0.5, 12);
    expect(half.im).toBeCloseTo(-1 / Math.PI, 12);
  });

  it('conducts fully with gate current, and blocks without it', () => {
    const lamp = (gate: number) =>
      runFor(
        netlist(
          'triac-qs',
          [
            mains(),
            { id: 'Q1', type: 'triac', nodes: { mt2: 'L', mt1: 'T', g: 'G' } },
            { id: 'H1', type: 'lamp', nodes: ['T', '0'], params: { voltage: 127, power: 60 } },
            { id: 'VG', type: 'dc-voltage', nodes: ['GS', '0'], params: { voltage: gate } },
            { id: 'RG', type: 'resistor', nodes: ['GS', 'G'], params: { resistance: 220 } },
          ],
          qs(),
        ),
        0.5,
      ).frame;
    const on = lamp(5);
    expect(r(on, 'Q1.conduction')).toBe(1);
    expect(r(on, 'H1.power')).toBeCloseTo(60, -1);
    const off = lamp(0);
    expect(r(off, 'Q1.conduction')).toBe(0);
    expect(r(off, 'H1.power')).toBeLessThan(0.01);
    expect(r(off, 'Q1.v')).toBeCloseTo(127, 0);
  });

  it('follows the conduction set by the microcontroller (phase control)', () => {
    const b = new Bench(gateCircuit({ position: 2, forca: 0.5 }));
    b.set('BOT', 'pressed', true);
    b.run(3);
    const frame = b.frame;
    expect(frame.readouts['U1.motor']).toBe('regime');
    // FORÇA at half: 70 % of each half-cycle; the load gets |K(0,7)| of the supply.
    expect(r(frame, 'Q1.conduction')).toBeCloseTo(0.7, 2);
    const k = phaseControlFactor(0.7);
    expect(r(frame, 'vABRE') / (127 * Math.hypot(k.re, k.im))).toBeCloseTo(1, 1);
  });
});

describe('protection and loads with AC (quasi-static)', () => {
  it('blows a fuse on an AC overload', () => {
    const b = new Bench(
      netlist(
        'fuse-ac',
        [
          mains(),
          { id: 'F1', type: 'fuse', nodes: ['L', 'F'], params: { rating: 1 } },
          {
            id: 'R1',
            type: 'resistor',
            nodes: ['F', '0'],
            params: { resistance: 20, watts: 1000 },
          },
        ],
        qs(),
      ),
    );
    b.until((f) => f.readouts['F1.blown'] === true, 2);
    expect(r(b.run(0.1), 'R1.current')).toBeLessThan(1e-3);
  });

  it('judges a motor capacitor by its AC rating', () => {
    // 220 V RMS is 311 V at the peak: fine for 250 V AC, too much for 250 V DC.
    const warns = (acRated: boolean) => {
      const b = new Bench(
        netlist(
          'cap-ac',
          [
            mains(220),
            {
              id: 'C1',
              type: 'capacitor',
              nodes: ['L', '0'],
              params: { capacitance: 10e-6, voltage: 250, acRated },
            },
          ],
          qs(),
        ),
      );
      b.run(0.5);
      return b.said('acima da tensão nominal');
    };
    expect(warns(true)).toBeUndefined();
    expect(warns(false)?.message).toMatch(/de pico/);
  });

  it('has the faults of a motor capacitor', () => {
    const current = (fault: string) =>
      r(
        runFor(
          netlist(
            'cap-fault',
            [
              mains(),
              {
                id: 'C1',
                type: 'capacitor',
                nodes: ['L', '0'],
                params: { capacitance: 10e-6, voltage: 250, acRated: true, fault },
              },
            ],
            qs(),
          ),
          0.02,
        ).frame,
        'C1.current',
      );
    const healthy = 127 * 120 * Math.PI * 10e-6;
    expect(current('none')).toBeCloseTo(healthy, 2);
    expect(current('weak')).toBeCloseTo(0.3 * healthy, 2);
    expect(current('open')).toBeLessThan(1e-6);
    expect(current('short')).toBeGreaterThan(10);
  });
});

describe('current probes', () => {
  it('measure the current in a wire (DC and quasi-static)', () => {
    const doc = (analysis: CircuitDoc['analysis'], source: Omit<NetPart, 'nodes'>) =>
      loop(
        'wire-probe',
        [source, { id: 'R1', type: 'resistor', params: { resistance: 100 } }],
        analysis,
        { probes: [{ id: 'iw', kind: 'current', element: 'Wret' }] },
      );
    const dc = runFor(
      doc({ kind: 'dc' }, { id: 'V1', type: 'dc-voltage', params: { voltage: 5 } }),
    );
    expect(Math.abs(r(dc.frame, 'iw'))).toBeCloseTo(0.05, 6);
    const ac = new Simulator(
      doc(qs(), { id: 'V1', type: 'ac-voltage', params: { amplitude: 10 } }),
    );
    ac.refresh();
    ac.step();
    const frame = ac.frame();
    expect(Math.abs(r(frame, 'iw'))).toBeCloseTo(10 / Math.SQRT2 / 100, 6);
    expect(Math.abs(frame.samples!.values.iw[0])).toBeCloseTo(10 / Math.SQRT2 / 100, 6);
  });
});
