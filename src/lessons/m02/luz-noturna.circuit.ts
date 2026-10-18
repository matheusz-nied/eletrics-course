import { defineCircuit } from '../../engine';

/**
 * 02.6, real case: the sensing half of an automatic night light, with the
 * light level on the LDR as a log slider.
 */
export default defineCircuit({
  id: 'm02/luz-noturna',
  title: 'Sensor da luz noturna automática',
  description:
    'Um resistor fixo de 10 kΩ e um LDR formam um divisor de tensão ligado a 5 V. O LDR fica embaixo, entre a saída e o negativo. Com muita luz, a resistência do LDR cai para algumas centenas de ohms e a saída fica perto de 0 V; no escuro, ela sobe para centenas de quilo-ohms e a saída se aproxima de 5 V. Um circuito de comando acende a lâmpada quando a saída passa de 2,5 V.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 16], params: { voltage: 5 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [12, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [12, 0], b: [12, 8], params: { resistance: 10000 } },
    {
      id: 'LDR',
      type: 'ldr',
      a: [12, 8],
      b: [12, 16],
      label: 'LDR',
      params: { lux: 2000 },
      control: {
        param: 'lux',
        label: 'Luz sobre o LDR',
        kind: 'slider',
        min: 0.01,
        max: 100000,
        log: true,
        unit: 'lx',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [12, 8],
        [22, 8],
      ],
    },
  ],
  probes: [
    { id: 'VS', kind: 'voltage', plus: 'LDR.a', minus: 'GND', label: 'Tensão no ponto do meio' },
  ],
  goals: [
    {
      id: 'dia',
      description:
        'De dia (2.000 lx, LDR perto de 500 Ω), a saída fica em cerca de 0,23 V: lâmpada apagada.',
      check: { readout: 'VS', op: 'between', value: [0.22, 0.25] },
    },
    {
      id: 'limiar',
      description:
        'Diminua a luz até a saída chegar a 2,5 V, o ponto de acender. Quanto vale o LDR nesse ponto?',
      check: { readout: 'VS', op: 'between', value: [2.45, 2.55] },
      solution: { 'LDR.lux': 26.9 },
    },
    {
      id: 'noite',
      description: 'No escuro (luz no mínimo, LDR em 1 MΩ), a saída passa de 4,9 V.',
      check: { readout: 'VS', op: '>', value: 4.9 },
      solution: { 'LDR.lux': 0.01 },
    },
  ],
});
