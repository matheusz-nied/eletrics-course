import { defineCircuit, type ElementDoc } from '../../engine';

/**
 * 08.3: a 1 CV three-phase motor (220/380 V nameplate) on a 127/220 V
 * network, with a fan-like load on the shaft. The connection in the terminal
 * box changes between delta (220 V on each winding, the right one for this
 * network) and star (127 V on each, a third of the current and of the
 * torque), and a switch opens line L3 to show the missing phase.
 */
const source = (id: string, y: number, phase: number): ElementDoc => ({
  id,
  type: 'ac-voltage',
  a: [10, y],
  b: [2, y],
  label: `Fase ${id.replace('V', 'L')}`,
  params: { amplitude: 179.6, frequency: 60, phase },
});

export default defineCircuit({
  id: 'm08/estrela-triangulo',
  title: 'Motor trifásico em estrela e em triângulo',
  description:
    'Uma rede trifásica de 127/220 V (três fases de 127 V até o neutro, 220 V entre duas fases) alimenta um motor trifásico de 1 CV com placa 220/380 V, que move uma carga no eixo. A ligação na caixa de ligação pode ser triângulo, com 220 V em cada bobina, ou estrela, com 127 V em cada bobina. Uma chave abre a fase L3 para mostrar a falta de fase. Os amperímetros medem a corrente de cada linha.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.01 },
  elements: [
    source('V1', 2, 0),
    source('V2', 9, -120),
    source('V3', 16, 120),
    // Neutral: the star point of the network, on ground.
    {
      id: 'WN',
      type: 'wire',
      points: [
        [2, 2],
        [2, 9],
        [2, 16],
        [2, 19],
      ],
    },
    { id: 'G', type: 'ground', at: [2, 19] },
    {
      id: 'WL1',
      type: 'wire',
      points: [
        [10, 2],
        [36, 2],
        [36, 21],
      ],
    },
    {
      id: 'WL2',
      type: 'wire',
      points: [
        [10, 9],
        [34, 9],
        [34, 21],
      ],
    },
    {
      id: 'WL3',
      type: 'wire',
      points: [
        [10, 16],
        [18, 16],
      ],
    },
    {
      id: 'S3',
      type: 'switch',
      a: [18, 16],
      b: [22, 16],
      label: 'Fase L3',
      params: { closed: true },
      control: { param: 'closed', label: 'Fase L3 ligada', kind: 'toggle' },
    },
    {
      id: 'WM3',
      type: 'wire',
      points: [
        [22, 16],
        [32, 16],
        [32, 21],
      ],
    },
    // Flipped so u (L1) is on the right: u (36,21), v (34,21), w (32,21).
    {
      id: 'M1',
      type: 'ac-motor-3ph',
      at: [34, 24],
      flip: true,
      label: 'Motor',
      params: { power: 750, voltage: 220, connection: 'triangulo', inertia: 0.04, load: 2 },
      control: [
        {
          param: 'connection',
          label: 'Ligação na caixa',
          kind: 'select',
          options: [
            { value: 'triangulo', label: 'Triângulo (Δ): 220 V em cada bobina' },
            { value: 'estrela', label: 'Estrela (Y): 127 V em cada bobina' },
          ],
        },
        {
          param: 'load',
          label: 'Carga no eixo',
          kind: 'slider',
          min: 0,
          max: 6,
          step: 0.25,
          unit: 'N·m',
        },
      ],
    },
  ],
  probes: [
    { id: 'I1', kind: 'current', element: 'WL1', label: 'Corrente na linha L1' },
    { id: 'I2', kind: 'current', element: 'WL2', label: 'Corrente na linha L2' },
    { id: 'I3', kind: 'current', element: 'WM3', label: 'Corrente na linha L3' },
  ],
  goals: [
    {
      id: 'triangulo',
      description: 'Em triângulo, com a carga leve, o motor gira perto de 1.770 rpm.',
      check: { readout: 'M1.rpm', op: 'between', value: [1750, 1790] },
      at: 3,
    },
    {
      id: 'partida',
      description: 'Na partida direta em triângulo, a corrente passa de 15 A.',
      check: { readout: 'M1.current', op: '>', value: 15 },
      at: 0.02,
    },
    {
      id: 'estrela-partida',
      description: 'Em estrela, a corrente de partida cai para um terço, perto de 6,4 A.',
      check: { readout: 'M1.current', op: 'between', value: [5.8, 7] },
      at: 0.02,
      solution: { 'M1.connection': 'estrela' },
    },
    {
      id: 'estrela-carga-cheia',
      description:
        'Em estrela, com 4,25 N·m no eixo, pouco acima da carga nominal, o motor nem sai do lugar.',
      check: { readout: 'M1.rpm', op: '<', value: 50 },
      at: 3,
      solution: { 'M1.connection': 'estrela', 'M1.load': 4.25 },
    },
    {
      id: 'falta-fase',
      description: 'Sem a fase L3, o motor parado só ronca.',
      check: { readout: 'M1.humming', op: '==', value: true },
      at: 2,
      solution: { 'S3.closed': false },
    },
  ],
});
