import { defineCircuit } from '../../engine';

/**
 * 9.4: two segments of a 12 V LED strip. Each segment is a 150 Ω resistor
 * and three white LEDs in series; the strip is these segments in parallel.
 * The supply slider goes up to the 14,4 V of a car with the engine running.
 */
const SEGMENTS = [4, 14];
const LED_X = [14, 20, 26, 32];

export default defineCircuit({
  id: 'm09/fita-led',
  title: 'Dois segmentos de uma fita de LED de 12 V',
  description:
    'Uma fonte ajustável de 10 V a 14,4 V alimenta dois segmentos de fita de LED em paralelo. Cada segmento tem um resistor de 150 Ω e três LEDs brancos em série. Com 12 V, cada segmento consome cerca de 18 mA. Com 14,4 V, a tensão de um carro com o motor ligado, a corrente passa de 30 mA e os LEDs trabalham acima do máximo; com 10 V, eles quase apagam.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 4],
      b: [0, 24],
      label: 'Fonte',
      params: { voltage: 12 },
      control: {
        param: 'voltage',
        label: 'Tensão da fonte',
        kind: 'slider',
        min: 10,
        max: 14.4,
        step: 0.1,
        unit: 'V',
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 4],
        [6, 4],
        [6, 14],
      ],
    },
    ...SEGMENTS.flatMap((y, s) => [
      {
        id: `R${s + 1}`,
        type: 'resistor',
        a: [6, y] as [number, number],
        b: [14, y] as [number, number],
        params: { resistance: 150 },
      },
      ...LED_X.slice(0, 3).map((x, k) => ({
        id: `D${3 * s + k + 1}`,
        type: 'led',
        a: [x, y] as [number, number],
        b: [LED_X[k + 1]!, y] as [number, number],
        params: { color: 'white' },
      })),
    ]),
    {
      id: 'W2',
      type: 'wire',
      points: [
        [32, 4],
        [38, 4],
        [38, 14],
        [38, 24],
        [0, 24],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [32, 14],
        [38, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 24] },
  ],
  probes: [
    { id: 'I1', kind: 'current', element: 'R1', label: 'Corrente no segmento 1' },
    { id: 'VD1', kind: 'voltage', plus: 'D1.a', minus: 'D1.b', label: 'Tensão em cada LED' },
    { id: 'VR1', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'Tensão no resistor' },
    { id: 'PF', kind: 'power', element: 'V1', label: 'Potência da fonte' },
  ],
  goals: [
    {
      id: 'doze',
      description: 'Com 12 V, confira que cada segmento consome cerca de 18 mA.',
      check: { readout: 'I1', op: 'between', value: [0.018, 0.019] },
    },
    {
      id: 'carro',
      description:
        'Suba a fonte para 14,4 V, a tensão de um carro com o motor ligado: a corrente passa de 30 mA.',
      check: { readout: 'I1', op: '>', value: 0.03 },
      solution: { 'V1.voltage': 14.4 },
    },
    {
      id: 'dez',
      description: 'Baixe a fonte para 10 V: o brilho cai para menos da metade.',
      check: { readout: 'D1.brightness', op: '<', value: 0.5 },
      solution: { 'V1.voltage': 10 },
    },
  ],
});
