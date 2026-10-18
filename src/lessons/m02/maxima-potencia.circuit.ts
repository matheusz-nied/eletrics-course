import { defineCircuit } from '../../engine';

/** 02.9: a 12 V source with 4 Ω of internal resistance and a variable load. */
export default defineCircuit({
  id: 'm02/maxima-potencia',
  title: 'Potência na carga × resistência da carga',
  description:
    'Uma fonte de 12 V com resistência interna de 4 Ω (desenhada como o resistor r) alimenta uma carga variável RL. A potência na carga é máxima, 9 W, quando RL também vale 4 Ω; nesse ponto a resistência interna desperdiça outros 9 W e a eficiência é de 50 %.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 14], params: { voltage: 12 } },
    {
      id: 'r',
      type: 'resistor',
      a: [0, 0],
      b: [10, 0],
      label: 'r (interna)',
      params: { resistance: 4, watts: 50 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [10, 0],
        [20, 0],
      ],
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [20, 0],
      b: [20, 14],
      params: { resistance: 1, watts: 50 },
      control: {
        param: 'resistance',
        label: 'Carga RL',
        kind: 'slider',
        min: 0.1,
        max: 100,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [20, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'PL', kind: 'power', element: 'RL', label: 'Potência na carga' },
    { id: 'PR', kind: 'power', element: 'r', label: 'Potência perdida na fonte' },
    { id: 'PT', kind: 'power', element: 'V1', label: 'Potência total da fonte' },
    { id: 'VL', kind: 'voltage', plus: 'RL.a', minus: 'RL.b', label: 'Tensão na carga' },
  ],
  goals: [
    {
      id: 'inicio',
      description: 'Com RL = 1 Ω, a carga recebe só 5,76 W.',
      check: { readout: 'PL', op: 'between', value: [5.75, 5.77] },
    },
    {
      id: 'pico',
      description: 'Ajuste RL para 4 Ω, igual à resistência interna: a carga recebe o máximo, 9 W.',
      check: { readout: 'PL', op: 'between', value: [8.99, 9.01] },
      solution: { 'RL.resistance': 4 },
    },
    {
      id: 'metade',
      description: 'No pico, a fonte desperdiça os mesmos 9 W dentro dela: eficiência de 50 %.',
      check: { readout: 'PR', op: 'between', value: [8.99, 9.01] },
      solution: { 'RL.resistance': 4 },
    },
    {
      id: 'oito',
      description: 'Com RL = 8 Ω, a carga recebe 8 W, menos que no pico.',
      check: { readout: 'PL', op: 'between', value: [7.99, 8.01] },
      solution: { 'RL.resistance': 8 },
    },
    {
      id: 'eficiente',
      description: 'Com RL = 40 Ω, a fonte perde menos de 0,3 W: eficiência acima de 90 %.',
      check: { readout: 'PR', op: '<', value: 0.3 },
      solution: { 'RL.resistance': 40 },
    },
  ],
});
