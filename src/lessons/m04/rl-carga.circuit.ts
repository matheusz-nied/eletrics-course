import { defineCircuit } from '../../engine';

/**
 * 04.5: the current in an RL circuit grows and falls with τ = L/R. A
 * changeover switch puts the battery on the resistor and the coil, or takes it
 * out and closes the loop, so the current falls through the same R.
 */
export default defineCircuit({
  id: 'm04/rl-carga',
  title: 'Corrente num circuito RL',
  description:
    'Uma bateria de 12 V, uma chave de duas posições, um resistor de 100 Ω e uma bobina de 1 H em série. Com a chave na bateria, a corrente não salta: sobe aos poucos até 120 mA, chegando a 63 % (cerca de 76 mA) depois de uma constante de tempo, τ = L/R = 10 ms. Com a chave no negativo, a bateria sai do circuito e a corrente cai pelo mesmo caminho, também com τ = 10 ms. A resistência e a indutância são ajustáveis.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.05 },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 16],
      params: { voltage: 12, resistance: 0 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [7, 0],
        [7, 4],
      ],
    },
    {
      id: 'S1',
      type: 'switch-spdt',
      at: [10, 6],
      rot: 180,
      label: 'Chave',
      params: { actuated: false },
      control: {
        param: 'actuated',
        label: 'Chave S1',
        kind: 'select',
        options: [
          { value: false, label: 'No negativo (bateria fora, laço fechado)' },
          { value: true, label: 'Na bateria (liga a bobina)' },
        ],
      },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [13, 6],
      b: [24, 6],
      params: { resistance: 100, watts: 2 },
      control: {
        param: 'resistance',
        label: 'Resistência R1',
        kind: 'slider',
        min: 50,
        max: 500,
        step: 10,
        unit: 'Ω',
      },
    },
    {
      id: 'L1',
      type: 'inductor',
      a: [24, 6],
      b: [24, 16],
      label: 'Bobina',
      params: { inductance: 1, resistance: 0 },
      control: {
        param: 'inductance',
        label: 'Indutância L1',
        kind: 'slider',
        min: 0.1,
        max: 2,
        step: 0.1,
        unit: 'H',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [7, 8],
        [7, 16],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [24, 16],
        [7, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na bobina' },
    { id: 'VL', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão na bobina' },
  ],
  goals: [
    {
      id: 'final',
      description: 'Ponha a chave na bateria e espere: a corrente para de subir em 120 mA.',
      check: { readout: 'IL', op: 'between', value: [0.119, 0.121] },
      at: 0.1,
      solution: { 'S1.actuated': true },
    },
    {
      id: 'tau',
      description: 'Depois de uma constante de tempo (10 ms), a corrente está em 63 %: uns 76 mA.',
      check: { readout: 'IL', op: 'between', value: [0.074, 0.078] },
      at: 0.01,
      solution: { 'S1.actuated': true },
    },
    {
      id: 'tensao-inicio',
      description: 'No primeiro instante, a bobina segura quase toda a tensão da bateria.',
      check: { readout: 'VL', op: '>', value: 11.3 },
      at: 0.0005,
      solution: { 'S1.actuated': true },
    },
    {
      id: 'dobro-r',
      description:
        'Dobre R1 para 200 Ω: a corrente final cai para 60 mA, e em 5 ms já está em 63 % (uns 38 mA).',
      check: { readout: 'IL', op: 'between', value: [0.037, 0.039] },
      at: 0.005,
      solution: { 'S1.actuated': true, 'R1.resistance': 200 },
    },
  ],
});
