import { describe, expect, it } from 'vitest';
import type { CircuitDoc } from '../contract';
import { Simulator } from '../analysis/simulator';
import { netlist } from './utils';

/**
 * Accuracy against ngspice (docs/plano/02-arquitetura.md, section 5.4): DC
 * within 0,1 %, transient within 1 % of each signal's peak. The references are
 * tools/ngspice/*.cir, rendered to src/engine/__golden__/*.csv.
 */

const csvFiles = import.meta.glob<string>('../__golden__/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function golden(name: string): { header: string[]; rows: number[][] } {
  const text = csvFiles[`../__golden__/${name}.csv`];
  if (!text) throw new Error(`missing golden file ${name}.csv`);
  const [head, ...lines] = text.trim().split('\n');
  return { header: head.split(','), rows: lines.map((l) => l.split(',').map(Number)) };
}

/** ngspice vector → our readout, with the sign convention (ngspice i(V) enters the + terminal). */
type Mapping = Record<string, { readout: string; sign?: number }>;

interface Case {
  name: string;
  doc: CircuitDoc;
  map: Mapping;
}

const cases: Case[] = [
  {
    name: 'dc-ponte',
    doc: netlist('ponte', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 12 } },
      { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
      { id: 'R2', type: 'resistor', nodes: ['1', '3'], params: { resistance: 2200 } },
      { id: 'R3', type: 'resistor', nodes: ['2', '0'], params: { resistance: 3300 } },
      { id: 'R4', type: 'resistor', nodes: ['3', '0'], params: { resistance: 4700 } },
      { id: 'R5', type: 'resistor', nodes: ['2', '3'], params: { resistance: 10000 } },
      { id: 'I1', type: 'dc-current', nodes: ['3', '0'], params: { current: 1e-3 } },
    ]),
    map: {
      'v(2)': { readout: 'v2' },
      'v(3)': { readout: 'v3' },
      'i(v1)': { readout: 'V1.current', sign: -1 },
    },
  },
  {
    name: 'dc-baterias',
    doc: netlist('baterias', [
      { id: 'B1', type: 'battery', nodes: ['1', '0'], params: { voltage: 9, resistance: 0.5 } },
      { id: 'B2', type: 'battery', nodes: ['1', '0'], params: { voltage: 8.5, resistance: 0.8 } },
      { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 47 } },
      {
        id: 'P1',
        type: 'potentiometer',
        nodes: { a: '2', w: '3', b: '0' },
        params: { resistance: 10000, position: 0.3 },
      },
      { id: 'R2', type: 'resistor', nodes: ['3', '0'], params: { resistance: 1000 } },
    ]),
    map: {
      'v(1)': { readout: 'v1' },
      'v(2)': { readout: 'v2' },
      'v(3)': { readout: 'v3' },
      'i(vb1)': { readout: 'B1.current', sign: -1 },
    },
  },
  {
    name: 'rc-carga',
    doc: netlist(
      'rc-carga',
      [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 10 } },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
        { id: 'C1', type: 'capacitor', nodes: ['2', '0'], params: { capacitance: 1e-6 } },
      ],
      { kind: 'transient', dt: 1e-5 },
    ),
    map: { 'v(2)': { readout: 'v2' }, 'i(v1)': { readout: 'V1.current', sign: -1 } },
  },
  {
    name: 'rl-degrau',
    doc: netlist(
      'rl-degrau',
      [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 5 } },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 10 } },
        {
          id: 'L1',
          type: 'inductor',
          nodes: ['2', '0'],
          params: { inductance: 0.01, resistance: 5 },
        },
      ],
      { kind: 'transient', dt: 5e-6 },
    ),
    map: { 'v(2)': { readout: 'v2' }, 'i(v1)': { readout: 'V1.current', sign: -1 } },
  },
  {
    name: 'rlc-serie',
    doc: netlist(
      'rlc-serie',
      [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 10 } },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 20 } },
        { id: 'L1', type: 'inductor', nodes: ['2', '3'], params: { inductance: 0.01 } },
        { id: 'C1', type: 'capacitor', nodes: ['3', '0'], params: { capacitance: 1e-6 } },
      ],
      { kind: 'transient', dt: 2e-6 },
    ),
    map: { 'v(3)': { readout: 'v3' }, 'i(v1)': { readout: 'V1.current', sign: -1 } },
  },
  {
    name: 'rc-senoide',
    doc: netlist(
      'rc-senoide',
      [
        {
          id: 'V1',
          type: 'ac-voltage',
          nodes: ['1', '0'],
          params: { amplitude: 10, frequency: 1000, phase: 30 },
        },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
        { id: 'C1', type: 'capacitor', nodes: ['2', '0'], params: { capacitance: 1e-7 } },
      ],
      { kind: 'transient', dt: 2e-6 },
    ),
    map: { 'v(2)': { readout: 'v2' }, 'i(v1)': { readout: 'V1.current', sign: -1 } },
  },
  {
    name: 'lc-tanque',
    doc: netlist(
      'lc-tanque',
      [
        {
          id: 'V1',
          type: 'ac-voltage',
          nodes: ['1', '0'],
          params: { amplitude: 5, frequency: 1591.55 },
        },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 100 } },
        { id: 'L1', type: 'inductor', nodes: ['2', '0'], params: { inductance: 1e-3 } },
        { id: 'C1', type: 'capacitor', nodes: ['2', '0'], params: { capacitance: 1e-5 } },
      ],
      { kind: 'transient', dt: 2e-6 },
    ),
    map: {
      'v(2)': { readout: 'v2' },
      'i(v1)': { readout: 'V1.current', sign: -1 },
      'i(vl)': { readout: 'L1.current' },
    },
  },
  {
    name: 'dc-diodos',
    doc: netlist('diodos', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 5 } },
      { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
      { id: 'D1', type: 'diode', nodes: ['2', '0'], params: { model: 'rectifier' } },
      { id: 'V2', type: 'dc-voltage', nodes: ['3', '0'], params: { voltage: 12 } },
      { id: 'R2', type: 'resistor', nodes: ['3', '4'], params: { resistance: 470 } },
      { id: 'D2', type: 'zener', nodes: ['0', '4'], params: { voltage: 5.1 } },
      { id: 'R3', type: 'resistor', nodes: ['4', '0'], params: { resistance: 1000 } },
    ]),
    map: {
      'v(2)': { readout: 'v2' },
      'i(v1)': { readout: 'V1.current', sign: -1 },
      'v(4)': { readout: 'v4' },
      'i(v2)': { readout: 'V2.current', sign: -1 },
    },
  },
  {
    name: 'meia-onda',
    doc: netlist(
      'meia-onda',
      [
        {
          id: 'V1',
          type: 'ac-voltage',
          nodes: ['1', '0'],
          params: { amplitude: 10, frequency: 60 },
        },
        { id: 'D1', type: 'diode', nodes: ['1', '2'], params: { model: 'rectifier' } },
        { id: 'R1', type: 'resistor', nodes: ['2', '0'], params: { resistance: 1000 } },
        { id: 'C1', type: 'capacitor', nodes: ['2', '0'], params: { capacitance: 1e-4 } },
      ],
      { kind: 'transient', dt: 5e-6 },
    ),
    map: { 'v(2)': { readout: 'v2' }, 'i(v1)': { readout: 'V1.current', sign: -1 } },
  },
  {
    name: 'dc-transistores',
    doc: netlist('transistores', [
      { id: 'VCC', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 12 } },
      { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 47e3 } },
      { id: 'R2', type: 'resistor', nodes: ['2', '0'], params: { resistance: 10e3 } },
      { id: 'RC', type: 'resistor', nodes: ['1', '3'], params: { resistance: 2200 } },
      { id: 'RE', type: 'resistor', nodes: ['4', '0'], params: { resistance: 1000 } },
      { id: 'Q1', type: 'npn', nodes: { b: '2', c: '3', e: '4' } },
      { id: 'VCC2', type: 'dc-voltage', nodes: ['5', '0'], params: { voltage: 9 } },
      { id: 'RE2', type: 'resistor', nodes: ['5', '6'], params: { resistance: 1000 } },
      { id: 'Q2', type: 'pnp', nodes: { b: '7', c: '0', e: '6' } },
      { id: 'RB2', type: 'resistor', nodes: ['7', '0'], params: { resistance: 100e3 } },
      { id: 'VG', type: 'dc-voltage', nodes: ['8', '0'], params: { voltage: 4 } },
      { id: 'VDD', type: 'dc-voltage', nodes: ['9', '0'], params: { voltage: 12 } },
      { id: 'RD', type: 'resistor', nodes: ['9', '10'], params: { resistance: 10 } },
      { id: 'M1', type: 'nmos', nodes: { g: '8', d: '10', s: '0' } },
      { id: 'VG2', type: 'dc-voltage', nodes: ['11', '0'], params: { voltage: 2.7 } },
      { id: 'RD2', type: 'resistor', nodes: ['9', '12'], params: { resistance: 100 } },
      { id: 'M2', type: 'nmos', nodes: { g: '11', d: '12', s: '0' } },
    ]),
    map: {
      'v(2)': { readout: 'v2' },
      'v(3)': { readout: 'v3' },
      'v(4)': { readout: 'v4' },
      'v(6)': { readout: 'v6' },
      'v(7)': { readout: 'v7' },
      'v(10)': { readout: 'v10' },
      'v(12)': { readout: 'v12' },
      'i(vcc)': { readout: 'VCC.current', sign: -1 },
      'i(vdd)': { readout: 'VDD.current', sign: -1 },
    },
  },
  {
    name: 'ac-filtro-amplificador',
    doc: {
      ...netlist('ac', [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 0 } },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
        { id: 'C1', type: 'capacitor', nodes: ['2', '0'], params: { capacitance: 1e-7 } },
        { id: 'L1', type: 'inductor', nodes: ['2', '8'], params: { inductance: 0.01 } },
        { id: 'R8', type: 'resistor', nodes: ['8', '0'], params: { resistance: 1000 } },
        { id: 'C2', type: 'capacitor', nodes: ['1', '3'], params: { capacitance: 1e-5 } },
        { id: 'R3', type: 'resistor', nodes: ['5', '3'], params: { resistance: 47e3 } },
        { id: 'R4', type: 'resistor', nodes: ['3', '0'], params: { resistance: 10e3 } },
        { id: 'RC', type: 'resistor', nodes: ['5', '6'], params: { resistance: 2200 } },
        { id: 'RE', type: 'resistor', nodes: ['7', '0'], params: { resistance: 1000 } },
        { id: 'CE', type: 'capacitor', nodes: ['7', '0'], params: { capacitance: 1e-4 } },
        { id: 'Q1', type: 'npn', nodes: { b: '3', c: '6', e: '7' } },
        { id: 'VCC', type: 'dc-voltage', nodes: ['5', '0'], params: { voltage: 12 } },
      ]),
      analysis: { kind: 'ac-sweep', source: 'V1', fStart: 10, fStop: 1e6, points: 51 },
    },
    map: {
      m2: { readout: 'magnitude.v2' },
      p2: { readout: 'phase.v2' },
      m6: { readout: 'magnitude.v6' },
      p6: { readout: 'phase.v6' },
      m8: { readout: 'magnitude.v8' },
      p8: { readout: 'phase.v8' },
    },
  },
  {
    name: 'chave-bobina',
    doc: netlist(
      'chave-bobina',
      [
        {
          id: 'V1',
          type: 'ac-voltage',
          nodes: ['1', '0'],
          params: { amplitude: 5, frequency: 50 },
        },
        { id: 'RB', type: 'resistor', nodes: ['1', '2'], params: { resistance: 4700 } },
        { id: 'Q1', type: 'npn', nodes: { b: '2', c: '3', e: '0' } },
        { id: 'VCC', type: 'dc-voltage', nodes: ['4', '0'], params: { voltage: 12 } },
        { id: 'RL', type: 'resistor', nodes: ['4', '5'], params: { resistance: 120 } },
        { id: 'L1', type: 'inductor', nodes: ['5', '3'], params: { inductance: 0.2 } },
        { id: 'D1', type: 'diode', nodes: ['3', '4'], params: { model: 'rectifier' } },
      ],
      { kind: 'transient', dt: 5e-6 },
    ),
    map: {
      'v(3)': { readout: 'v3' },
      'i(vcc)': { readout: 'VCC.current', sign: -1 },
      'i(l1)': { readout: 'L1.current' },
    },
  },
];

describe('golden tests against ngspice', () => {
  for (const c of cases) {
    it(c.name, () => {
      const ref = golden(c.name);
      const sim = new Simulator(c.doc);
      const columns = Object.keys(c.map).map((vec) => {
        const col = ref.header.indexOf(vec);
        expect(col, `${vec} in ${c.name}.csv`).toBeGreaterThan(0);
        return { vec, col, ...c.map[vec] };
      });

      if (ref.header[0] === 'frequency') {
        // AC sweep: gain within 0,1 % and phase within 0,1° at every frequency.
        sim.refresh();
        const sweep = sim.frame().sweep!;
        expect(sweep.f.length).toBe(ref.rows.length);
        for (const { vec, col, readout } of columns) {
          const [kind, probe] = readout.split('.') as ['magnitude' | 'phase', string];
          ref.rows.forEach((row, k) => {
            expect(sweep.f[k] / row[0]).toBeCloseTo(1, 6);
            const actual = sweep[kind][probe][k];
            const tol = kind === 'magnitude' ? 1e-3 * Math.abs(row[col]) + 1e-9 : 0.1;
            expect(Math.abs(actual - row[col]), `${vec} at ${row[0]} Hz: ${actual}`).toBeLessThan(
              tol,
            );
          });
        }
        return;
      }

      if (ref.header[0] === 'op') {
        sim.refresh();
        const { readouts } = sim.frame();
        for (const { vec, col, readout, sign = 1 } of columns) {
          const expected = ref.rows[0][col];
          const actual = (readouts[readout] as number) * sign;
          expect(
            Math.abs(actual - expected),
            `${vec}: ${actual} vs ${expected}`,
          ).toBeLessThanOrEqual(1e-3 * Math.abs(expected) + 1e-9);
        }
        return;
      }

      // Transient: our fixed-step samples, interpolated at the reference times.
      const tEnd = ref.rows.at(-1)![0];
      const times: number[] = [0];
      const series = columns.map(() => [] as number[]);
      sim.refresh();
      const first = sim.frame().readouts;
      columns.forEach((c, k) => series[k].push((first[c.readout] as number) * (c.sign ?? 1)));
      while (sim.t < tEnd - 1e-12) {
        sim.step();
        const { readouts } = sim.frame({ samples: false });
        times.push(sim.t);
        columns.forEach((c, k) => series[k].push((readouts[c.readout] as number) * (c.sign ?? 1)));
      }
      columns.forEach(({ vec, col }, k) => {
        const peak = Math.max(...ref.rows.map((r) => Math.abs(r[col])));
        let worst = 0;
        let worstAt = 0;
        // Skip t = 0: ngspice and the engine disagree on what the instant of the step is.
        for (const row of ref.rows.slice(1)) {
          const actual = interpolate(times, series[k], row[0]);
          const err = Math.abs(actual - row[col]);
          if (err > worst) {
            worst = err;
            worstAt = row[0];
          }
        }
        expect(worst / peak, `${vec}: worst error at t = ${worstAt}`).toBeLessThanOrEqual(0.01);
      });
    });
  }
});

function interpolate(ts: number[], ys: number[], t: number): number {
  let lo = 0;
  let hi = ts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  const span = ts[hi] - ts[lo];
  if (span <= 0) return ys[lo];
  return ys[lo] + ((ys[hi] - ys[lo]) * (t - ts[lo])) / span;
}
