import { defineCircuit } from '../../engine';

/**
 * 08.4: a 1/3 CV single-phase motor with a permanent capacitor on 127 V,
 * like the one in a sliding gate operator. A changeover switch puts the
 * phase on one winding or the other (the direction), the capacitor can be
 * swapped for a smaller or larger one or given a fault, and the load on the
 * shaft is adjustable. The numbers the lesson quotes are checked in
 * motores-ca.test.ts.
 */
export default defineCircuit({
  id: 'm08/motor-capacitor',
  title: 'Motor monofásico com capacitor',
  description:
    'A rede de 127 V alimenta, por um interruptor, uma chave de sentido. A chave põe a fase direto num dos dois enrolamentos do motor; o outro enrolamento recebe a corrente pelo capacitor, ligado entre as duas pontas. O comum do motor vai ao neutro. É possível trocar o capacitor, simular um capacitor aberto, fraco ou em curto e mudar a carga no eixo. O amperímetro mede a corrente no comum do motor.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.01 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [2, 4],
      b: [2, 21],
      label: 'Rede 127 V',
      params: { amplitude: 179.6, frequency: 60 },
    },
    {
      id: 'WF',
      type: 'wire',
      points: [
        [2, 4],
        [2, 2],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [2, 2],
      b: [6, 2],
      label: 'Interruptor',
      params: { closed: true },
      control: { param: 'closed', label: 'Motor ligado', kind: 'toggle' },
    },
    {
      id: 'WS',
      type: 'wire',
      points: [
        [6, 2],
        [8, 2],
      ],
    },
    // com (8,2), nc (14,0), no (14,4)
    {
      id: 'K1',
      type: 'switch-spdt',
      at: [11, 2],
      label: 'Chave de sentido',
      params: { actuated: false },
      control: { param: 'actuated', label: 'Chave de sentido invertida', kind: 'toggle' },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [14, 0],
        [26, 0],
        [26, 6],
        [26, 13],
      ],
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 4],
        [22, 4],
        [22, 6],
        [22, 13],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [22, 6],
      b: [26, 6],
      label: 'Capacitor',
      params: { capacitance: 25e-6, voltage: 250, acRated: true, fault: 'none' },
      control: [
        {
          param: 'capacitance',
          label: 'Capacitor',
          kind: 'select',
          options: [
            { value: 10e-6, label: '10 µF (pequeno demais)' },
            { value: 25e-6, label: '25 µF (o da placa)' },
            { value: 50e-6, label: '50 µF (grande demais)' },
          ],
        },
        {
          param: 'fault',
          label: 'Estado do capacitor',
          kind: 'select',
          options: [
            { value: 'none', label: 'Bom' },
            { value: 'weak', label: 'Fraco (perdeu 70 %)' },
            { value: 'open', label: 'Aberto' },
            { value: 'short', label: 'Em curto' },
          ],
        },
      ],
    },
    // Flipped so winding 1 is on the right: w1 (26,13), w2 (22,13), common (24,19).
    {
      id: 'M1',
      type: 'ac-motor-1ph-cap',
      at: [24, 16],
      flip: true,
      label: 'Motor',
      params: { power: 250, voltage: 127, inertia: 0.005, load: 0.3 },
      control: {
        param: 'load',
        label: 'Carga no eixo',
        kind: 'slider',
        min: 0,
        max: 2,
        step: 0.05,
        unit: 'N·m',
      },
    },
    {
      id: 'WN',
      type: 'wire',
      points: [
        [24, 19],
        [24, 21],
        [2, 21],
      ],
    },
    { id: 'G', type: 'ground', at: [2, 21] },
  ],
  probes: [
    { id: 'IM', kind: 'current', element: 'M1', label: 'Corrente no comum do motor' },
    { id: 'IC', kind: 'current', element: 'C1', label: 'Corrente no capacitor' },
  ],
  goals: [
    {
      id: 'frente',
      description: 'Com a chave em repouso, o motor gira para a frente, perto de 1.700 rpm.',
      check: { readout: 'M1.rpm', op: 'between', value: [1600, 1780] },
      at: 3,
    },
    {
      id: 're',
      description: 'Com a chave de sentido invertida, ele gira para o outro lado.',
      check: { readout: 'M1.rpm', op: '<', value: -1600 },
      at: 3,
      solution: { 'K1.actuated': true },
    },
    {
      id: 'sem-capacitor',
      description: 'Com o capacitor aberto, o motor parado só zumbe.',
      check: { readout: 'M1.humming', op: '==', value: true },
      at: 2,
      solution: { 'C1.fault': 'open' },
    },
    {
      id: 'protetor',
      description: 'Zumbindo sem capacitor, o protetor térmico acaba abrindo.',
      check: { readout: 'M1.protector', op: '==', value: true },
      at: 120,
      solution: { 'C1.fault': 'open' },
    },
  ],
});
