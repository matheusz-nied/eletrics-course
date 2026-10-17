import type { CircuitDoc, ElementDoc } from './contract';

/**
 * Benchmark circuit: a ladder with `nodes` nodes (AC source, resistors,
 * capacitors, inductors and switches), the size the plan budgets for
 * (docs/plano/02-arquitetura.md, section 5.4). `nonlinear` swaps some series
 * resistors for diodes and some shunt resistors for LEDs, so every step runs
 * Newton-Raphson. Used by the performance test and by /dev/motor/.
 */
export function ladderCircuit(nodes = 50, nonlinear = false): CircuitDoc {
  const elements: ElementDoc[] = [
    { id: 'G', type: 'ground', at: [0, 10] },
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 10],
      params: { amplitude: 10, frequency: 60 },
    },
  ];
  for (let k = 1; k < nodes; k++) {
    const x0 = (k - 1) * 10;
    const x1 = k * 10;
    const a: [number, number] = [x0, 0];
    const b: [number, number] = [x1, 0];
    elements.push(
      k % 7 === 0
        ? { id: `L${k}`, type: 'inductor', a, b, params: { inductance: 1e-3, resistance: 1 } }
        : k % 11 === 0
          ? { id: `S${k}`, type: 'switch', a, b, params: { closed: true } }
          : nonlinear && k % 5 === 0
            ? { id: `D${k}`, type: 'diode', a, b }
            : { id: `R${k}`, type: 'resistor', a, b, params: { resistance: 100, watts: 100 } },
    );
    const c: [number, number] = [x1, 10];
    elements.push(
      k % 3 === 0
        ? { id: `C${k}`, type: 'capacitor', a: b, b: c, params: { capacitance: 1e-6 } }
        : nonlinear && k % 4 === 1
          ? { id: `LED${k}`, type: 'led', a: b, b: c }
          : {
              id: `Rg${k}`,
              type: 'resistor',
              a: b,
              b: c,
              params: { resistance: 1000, watts: 100 },
            },
    );
    elements.push({
      id: `Wg${k}`,
      type: 'wire',
      points: [
        [x0, 10],
        [x1, 10],
      ],
    });
  }
  const kind = nonlinear ? ' com diodos e LEDs' : '';
  return {
    id: nonlinear ? 'dev/escada-diodos' : 'dev/escada',
    title: `Escada de ${nodes} nós${kind}`,
    description: `Circuito de teste de desempenho com ${nodes} nós${kind}.`,
    elements,
    analysis: { kind: 'transient', dt: 1e-5 },
  };
}
