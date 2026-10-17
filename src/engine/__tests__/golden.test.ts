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
