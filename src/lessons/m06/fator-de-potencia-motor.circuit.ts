import { defineCircuit } from '../../engine';

/** The motor model: resistance (work and heat) and inductance (magnetic field). */
export const MOTOR_R = 16;
export const MOTOR_L = 0.042;
/** Correction capacitors the lesson offers (F). 80 µF is about the full correction. */
export const CAPACITORS = [40e-6, 60e-6, 80e-6, 120e-6] as const;

/**
 * 06.5: a single-phase motor on 127 V, modelled as a resistor (the power
 * that becomes work and heat) in series with an inductor (the magnetic
 * field), with a power-factor correction capacitor across it. Typical
 * values for a 1/2 cv water pump: about 500 W and power factor 0,71.
 * The values the lesson quotes are checked in ./fator-de-potencia.test.ts.
 */
export default defineCircuit({
  id: 'm06/fator-de-potencia-motor',
  title: 'Motor com fator de potência baixo e capacitor de correção',
  description:
    'A rede de 127 V alimenta o modelo simplificado de um motor de bomba: um resistor de 16 Ω, que representa a potência que vira trabalho e calor, em série com um indutor de 42 mH, que representa o campo magnético. Uma chave liga um capacitor de correção em paralelo com o motor, com valores de 40 a 120 µF. Sem o capacitor, a rede fornece cerca de 5,6 A para cerca de 500 W, com fator de potência 0,71. Com 80 µF, a corrente da rede cai para cerca de 4 A, a potência continua a mesma e o fator de potência fica perto de 1. Com 120 µF, a correção passa do ponto e a corrente volta a subir.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.01 },
  elements: [
    { id: 'R', type: 'mains', at: [0, 6], label: 'Rede 127 V', params: { voltage: 127 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [2, 4],
        [10, 4],
        [18, 4],
      ],
    },
    {
      id: 'RM',
      type: 'resistor',
      a: [10, 4],
      b: [10, 8],
      label: 'Motor: R',
      params: { resistance: MOTOR_R, watts: 1000 },
    },
    {
      id: 'LM',
      type: 'inductor',
      a: [10, 8],
      b: [10, 12],
      label: 'Motor: L',
      params: { inductance: MOTOR_L },
    },
    {
      id: 'S1',
      type: 'switch',
      a: [18, 4],
      b: [18, 8],
      label: 'Chave',
      params: { closed: false },
      control: { param: 'closed', label: 'Capacitor de correção ligado', kind: 'toggle' },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [18, 8],
      b: [18, 12],
      label: 'Capacitor',
      params: { capacitance: CAPACITORS[0], voltage: 250, acRated: true },
      control: {
        param: 'capacitance',
        label: 'Capacitância de correção',
        kind: 'select',
        options: CAPACITORS.map((c) => ({ value: c, label: `${Math.round(c * 1e6)} µF` })),
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [2, 6],
        [4, 6],
        [4, 12],
        [10, 12],
        [18, 12],
      ],
    },
  ],
  probes: [
    { id: 'IT', kind: 'current', element: 'R', label: 'Corrente da rede' },
    { id: 'IM', kind: 'current', element: 'LM', label: 'Corrente do motor' },
    { id: 'P', kind: 'power', element: 'R', label: 'Potência ativa da rede' },
    { id: 'V', kind: 'voltage', plus: 'RM.a', minus: 'LM.b', label: 'Tensão no motor' },
  ],
});
