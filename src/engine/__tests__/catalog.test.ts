import { describe, expect, it } from 'vitest';
import type { CircuitDoc, DeviceInfo } from '../contract';
import { Simulator } from '../analysis/simulator';
import { getDeviceInfo, listDevices } from '../index';
import { netlist, type NetPart } from './utils';

/** Pin names the plan fixes for the level-2 devices (docs/plano/02-arquitetura.md, 5.3). */
const PLAN_PINS: Record<string, string[]> = {
  npn: ['b', 'c', 'e'],
  pnp: ['b', 'c', 'e'],
  nmos: ['g', 'd', 's'],
  pmos: ['g', 'd', 's'],
  'relay-spdt': ['coil1', 'coil2', 'com', 'nc', 'no'],
  transformer: ['p1', 'p2', 's1', 's2'],
};
const LEVEL_2 = [
  'diode',
  'led',
  'zener',
  'npn',
  'pnp',
  'nmos',
  'pmos',
  'relay-spdt',
  'transformer',
  'dc-motor',
  'buzzer',
  'ldr',
  'ntc',
  'opamp',
  'timer-555',
  'and',
  'or',
  'not',
  'nand',
  'nor',
  'xor',
  'scr',
  'triac',
  'optocoupler',
  'breaker',
  'rcd',
  'human-body',
];

const testSources = import.meta.glob<string>('./*.test.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('level-2 catalog', () => {
  it('has every level-2 device of the plan, with its pins', () => {
    const types = listDevices().map((d) => d.type);
    for (const t of LEVEL_2) expect(types).toContain(t);
    for (const [type, pins] of Object.entries(PLAN_PINS))
      expect(getDeviceInfo(type).pins.map((p) => p.name)).toEqual(pins);
    expect(getDeviceInfo('led').readouts).toContain('brightness');
    expect(getDeviceInfo('relay-spdt').readouts).toContain('closed');
    expect(getDeviceInfo('dc-motor').readouts).toEqual(expect.arrayContaining(['rpm', 'torque']));
  });

  it('labels pins of N-terminal devices, parameters and readouts in pt-BR', () => {
    for (const info of listDevices()) {
      if (info.terminals === 'fixed' && info.type !== 'ground')
        for (const p of info.pins) expect(p.label, `${info.type}.${p.name}`).toBeTruthy();
      for (const [name, p] of Object.entries(info.params)) {
        expect(p.label.length, `${info.type}.${name}`).toBeGreaterThan(2);
        if (p.options) expect(p.options.map((o) => o.value)).toContain(p.default);
      }
      for (const r of info.readouts)
        expect(info.readoutInfo?.[r]?.label, `${info.type}.${r}`).toBeTruthy();
    }
  });

  it('every device type has a test', () => {
    const sources = Object.entries(testSources)
      .filter(([path]) => !path.endsWith('catalog.test.ts'))
      .map(([, text]) => text)
      .join('\n');
    for (const { type } of listDevices()) {
      if (type === 'wire' || type === 'ground') continue;
      // A circuit element of that type, or a key of a table of types (the logic gates).
      expect(sources, type).toMatch(new RegExp(`'${type}'|^\\s+${type}: \\[`, 'm'));
    }
  });
});

/**
 * Every device in a small circuit: each pin on its own node, tied through
 * 1 kΩ to a 5 V source (and the first pin also to ground through 1 kΩ), then
 * DC, a short transient and an AC sweep. Nothing may throw or turn NaN.
 */
function smoke(info: DeviceInfo, analysis: CircuitDoc['analysis']): CircuitDoc {
  const parts: NetPart[] = [
    { id: 'V1', type: 'dc-voltage', nodes: ['s', '0'], params: { voltage: 5 } },
  ];
  const nodes: Record<string, string> = {};
  info.pins.forEach((pin, k) => {
    nodes[pin.name] = `p${k}`;
    parts.push({ id: `R${k}`, type: 'resistor', nodes: ['s', `p${k}`] });
  });
  parts.push({ id: 'RG', type: 'resistor', nodes: ['p0', '0'] });
  const dut: NetPart =
    info.terminals === 'two'
      ? { id: 'X1', type: info.type, nodes: ['p0', 'p1'] }
      : { id: 'X1', type: info.type, nodes };
  return netlist(`smoke-${info.type}`, [...parts, dut], analysis);
}

describe('every device in DC, transient and AC sweep', () => {
  for (const info of listDevices()) {
    if (info.type === 'wire' || info.type === 'ground') continue;
    it(info.type, () => {
      const dc = new Simulator(smoke(info, { kind: 'dc' }));
      dc.refresh();
      for (let i = 0; i < 20; i++) dc.step();
      const tran = new Simulator(smoke(info, { kind: 'transient', dt: 1e-5 }));
      tran.refresh();
      for (let i = 0; i < 200; i++) tran.step();
      for (const sim of [dc, tran]) {
        const { readouts, nodeVoltages } = sim.frame();
        for (const [key, value] of Object.entries(readouts))
          if (typeof value === 'number') expect(Number.isNaN(value), key).toBe(false);
        for (const v of Object.values(nodeVoltages)) expect(Number.isFinite(v)).toBe(true);
      }
      const ac = new Simulator(
        smoke(info, { kind: 'ac-sweep', source: 'V1', fStart: 10, fStop: 1e5, points: 9 }),
      );
      ac.refresh();
      const { sweep } = ac.frame();
      expect(sweep?.f).toHaveLength(9);
      for (const values of Object.values(sweep!.magnitude))
        for (const m of values) expect(Number.isFinite(m)).toBe(true);
    });
  }
});
