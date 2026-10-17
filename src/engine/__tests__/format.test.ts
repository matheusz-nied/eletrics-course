import { describe, expect, it } from 'vitest';
import type { CircuitDoc } from '../contract';
import {
  buildNetlist,
  getDeviceInfo,
  getPinPositions,
  listDevices,
  validateCircuit,
} from '../index';
import { formatSI } from '../messages';

const base = (elements: CircuitDoc['elements'], extra: Partial<CircuitDoc> = {}): CircuitDoc => ({
  id: 'teste/formato',
  title: 'Formato',
  description: 'Circuito de teste',
  elements,
  analysis: { kind: 'dc' },
  ...extra,
});

describe('buildNetlist', () => {
  const doc = base([
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 10] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [20, 0], b: [20, 10] },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [20, 10],
        [0, 10],
      ],
    },
    { id: 'G1', type: 'ground', at: [0, 10] },
    { id: 'S1', type: 'switch-spdt', at: [43, 0] },
  ]);

  it('joins pins through wire ends and vertices', () => {
    const net = buildNetlist(doc);
    expect(net.pins['B1.a']).toBe(net.pins['R1.a']);
    expect(net.pins['B1.b']).toBe('GND');
    expect(net.pins['R1.b']).toBe('GND');
    expect(net.pins['G1.g']).toBe('GND');
    expect(net.nodes[0].id).toBe('GND');
    const top = net.nodes.find((n) => n.id === net.pins['B1.a'])!;
    expect(top.points).toEqual(
      expect.arrayContaining([
        [0, 0],
        [10, 0],
        [20, 0],
      ]),
    );
  });

  it('places N-terminal pins with rotation and mirroring', () => {
    expect(getPinPositions({ id: 'S', type: 'switch-spdt', at: [10, 10] })).toEqual({
      com: [7, 10],
      nc: [13, 8],
      no: [13, 12],
    });
    // 90° clockwise on screen (y down): right becomes down.
    expect(getPinPositions({ id: 'S', type: 'switch-spdt', at: [10, 10], rot: 90 })).toEqual({
      com: [10, 7],
      nc: [12, 13],
      no: [8, 13],
    });
    expect(getPinPositions({ id: 'S', type: 'switch-spdt', at: [10, 10], flip: true })).toEqual({
      com: [13, 10],
      nc: [7, 8],
      no: [7, 12],
    });
  });

  it('does not join wires that only cross', () => {
    const net = buildNetlist(
      base([
        {
          id: 'W1',
          type: 'wire',
          points: [
            [0, 5],
            [10, 5],
          ],
        },
        {
          id: 'W2',
          type: 'wire',
          points: [
            [5, 0],
            [5, 10],
          ],
        },
        { id: 'G', type: 'ground', at: [0, 5] },
        { id: 'R1', type: 'resistor', a: [5, 0], b: [5, -10] },
      ]),
    );
    expect(net.pins['R1.a']).not.toBe('GND');
  });

  it('uses the negative terminal of the first source as reference without ground', () => {
    const net = buildNetlist(
      base([
        { id: 'R1', type: 'resistor', a: [10, 0], b: [10, 10] },
        { id: 'B1', type: 'battery', a: [0, 0], b: [0, 10] },
        {
          id: 'W1',
          type: 'wire',
          points: [
            [0, 0],
            [10, 0],
          ],
        },
        {
          id: 'W2',
          type: 'wire',
          points: [
            [0, 10],
            [10, 10],
          ],
        },
      ]),
    );
    expect(net.pins['B1.b']).toBe('GND');
    expect(net.pins['R1.b']).toBe('GND');
  });
});

describe('validateCircuit', () => {
  it('accepts a good circuit', () => {
    const doc = base(
      [
        { id: 'B1', type: 'battery', a: [0, 0], b: [0, 10], params: { voltage: 1.5 } },
        {
          id: 'S1',
          type: 'switch',
          a: [0, 0],
          b: [10, 0],
          control: { param: 'closed', label: 'Chave', kind: 'toggle' },
        },
        { id: 'R1', type: 'resistor', a: [10, 0], b: [10, 10] },
        {
          id: 'W1',
          type: 'wire',
          points: [
            [10, 10],
            [0, 10],
          ],
        },
        { id: 'G', type: 'ground', at: [0, 10] },
      ],
      {
        probes: [{ id: 'Vr', kind: 'voltage', plus: 'R1.a', minus: 'GND' }],
        goals: [
          {
            id: 'liga',
            description: 'Ligue a chave',
            check: { readout: 'R1.current', op: '>', value: 0.001 },
            solution: { 'S1.closed': true },
          },
        ],
      },
    );
    expect(validateCircuit(doc)).toEqual({ errors: [], warnings: [] });
  });

  it('lists structural and semantic problems in pt-BR', () => {
    const doc = base(
      [
        { id: 'R1', type: 'resistr', a: [0, 0], b: [10, 0] },
        { id: 'R2', type: 'resistor', a: [0, 0], b: [10, 0], params: { resistence: 10 } },
        { id: 'R3', type: 'resistor', a: [0, 0], params: { resistance: '10' } },
        {
          id: 'S1',
          type: 'switch',
          a: [0, 0],
          b: [0, 5],
          control: { param: 'closed', label: 'x', kind: 'slider' },
        },
      ],
      {},
    );
    const { errors } = validateCircuit(doc);
    expect(errors).toEqual([
      'elemento R1: tipo de dispositivo desconhecido "resistr"',
      'elemento R2: parâmetro desconhecido "resistence" (resistor aceita: resistance, watts, tolerance)',
      'elemento R3: resistor precisa de "a" e "b"',
      'elemento R3: "resistance" deve ser número, recebeu texto',
      'elemento S1: controle "slider" precisa de um parâmetro numérico ("closed" não é)',
    ]);
    expect(
      validateCircuit({ ...doc, elements: [], analysis: { kind: 'transient' } }).errors,
    ).toEqual(['elements: valor pequeno demais (mínimo 1)', 'analysis.dt: campo obrigatório']);
  });

  it('checks probes, goals and 3D bindings', () => {
    const doc = base(
      [
        { id: 'B1', type: 'battery', a: [0, 0], b: [0, 10] },
        { id: 'L1', type: 'lamp', a: [0, 0], b: [0, 10] },
      ],
      {
        probes: [{ id: 'V', kind: 'voltage', plus: 'L1.c', minus: 'GND' }],
        goals: [{ id: 'g', description: 'x', check: { readout: 'L1.brilho', op: '>', value: 1 } }],
        scene3d: { scene: 'x', bindings: { glow: 'L2.brightness' } },
      },
    );
    expect(validateCircuit(doc).errors).toEqual([
      'medidor V: L1 não tem o pino "c" (tem: a, b)',
      'meta g: L1 não tem a leitura "brilho" (tem: current, voltage, power, brightness, temperature, resistance, burned, pin.a, pin.b)',
      'scene3d.bindings["glow"]: leitura "L2.brightness" não existe (use "Elemento.leitura" ou o id de um medidor)',
    ]);
  });

  it('warns about pins that touch nothing or sit in the middle of a wire', () => {
    const doc = base([
      { id: 'B1', type: 'battery', a: [0, 0], b: [0, 10] },
      {
        id: 'W1',
        type: 'wire',
        points: [
          [0, 0],
          [20, 0],
        ],
      },
      { id: 'R1', type: 'resistor', a: [10, 0], b: [10, 10] },
      {
        id: 'W2',
        type: 'wire',
        points: [
          [0, 10],
          [10, 10],
        ],
      },
    ]);
    expect(validateCircuit(doc).warnings).toEqual([
      'R1.a está sobre o fio W1 mas fora de uma ponta ou vértice: não está ligado',
    ]);
  });
});

describe('device catalog', () => {
  it('describes every level-1 device with pt-BR labels', () => {
    const types = listDevices().map((d) => d.type);
    for (const t of [
      'wire',
      'ground',
      'resistor',
      'battery',
      'dc-voltage',
      'dc-current',
      'ac-voltage',
      'switch',
      'push-button',
      'switch-spdt',
      'potentiometer',
      'capacitor',
      'inductor',
      'lamp',
      'fuse',
    ]) {
      expect(types).toContain(t);
    }
    for (const info of listDevices()) {
      expect(info.label.length).toBeGreaterThan(2);
      for (const p of Object.values(info.params)) expect(p.label.length).toBeGreaterThan(2);
      for (const r of info.readouts)
        expect(info.readoutInfo?.[r]?.label, `${info.type}.${r}`).toBeTruthy();
      if (info.terminals === 'two') expect(info.pins.map((p) => p.name)).toEqual(['a', 'b']);
    }
    expect(getDeviceInfo('potentiometer').pins.map((p) => p.name)).toEqual(['a', 'w', 'b']);
    expect(() => getDeviceInfo('flux-capacitor')).toThrow('Tipo de dispositivo desconhecido');
  });
});

describe('formatSI', () => {
  it('formats values the Brazilian way with engineering prefixes', () => {
    expect(formatSI(0.085, 'A')).toBe('85 mA');
    expect(formatSI(4700, 'Ω')).toBe('4,7 kΩ');
    expect(formatSI(220, 'V')).toBe('220 V');
    expect(formatSI(0.99996, 'A')).toBe('1 A');
    expect(formatSI(1.5e-6, 'F')).toBe('1,5 µF');
    expect(formatSI(-12.345, 'V')).toBe('-12,3 V');
    expect(formatSI(0, 'W')).toBe('0 W');
  });
});

describe('README example', () => {
  it('validates and meets its goal once the switch closes', async () => {
    const readme = (await import('../README.md?raw')).default as string;
    const code = readme.match(/export default defineCircuit\((\{[\s\S]*?\})\);/)![1];
    const doc = new Function(`return (${code});`)() as CircuitDoc;
    expect(validateCircuit(doc)).toEqual({ errors: [], warnings: [] });
    const { Simulator } = await import('../analysis/simulator');
    const { checkGoal } = await import('../analysis/goals');
    const sim = new Simulator(doc);
    sim.setParam('S1', 'closed', true);
    sim.refresh();
    for (let i = 0; i < 1000; i++) sim.step();
    expect(checkGoal(doc.goals![0], sim.frame())).toBe(true);
  });
});
