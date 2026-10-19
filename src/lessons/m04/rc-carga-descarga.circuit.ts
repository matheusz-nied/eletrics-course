import { defineCircuit } from '../../engine';

/**
 * 04.4: charge and discharge of a capacitor through the same resistor, with a
 * changeover switch (battery or ground) and adjustable R and C. With the
 * starting values, τ = 10 kΩ × 100 µF = 1 s. The discharge is checked in
 * ./capacitores.test.ts.
 */
export default defineCircuit({
  id: 'm04/rc-carga-descarga',
  title: 'Carga e descarga de um capacitor',
  description:
    'Uma chave de duas posições liga a entrada de um circuito RC à bateria de 10 V (carregar) ou ao negativo (descarregar). O resistor, ajustável de 1 kΩ a 100 kΩ, começa em 10 kΩ, e o capacitor, que pode ser de 10 µF a 470 µF, começa em 100 µF, então a constante de tempo vale 1 s. Na carga, a tensão no capacitor chega a 6,3 V (63 %) depois de 1 s e passa de 9,9 V depois de 5 s; a corrente começa em 1 mA e cai. Na descarga, a tensão cai a 37 % do valor inicial a cada constante de tempo.',
  analysis: { kind: 'transient', dt: 0.001 },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 16], params: { voltage: 10 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [11, 0],
        [11, 6],
      ],
    },
    {
      id: 'S1',
      type: 'switch-spdt',
      at: [14, 8],
      rot: 180,
      label: 'Chave',
      params: { actuated: false },
      control: {
        param: 'actuated',
        label: 'Chave',
        kind: 'select',
        options: [
          { value: false, label: 'No negativo: descarregar' },
          { value: true, label: 'Na bateria: carregar' },
        ],
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [11, 10],
        [11, 16],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [17, 8],
        [20, 8],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [20, 8],
      b: [28, 8],
      params: { resistance: 10000 },
      control: {
        param: 'resistance',
        label: 'Resistor R',
        kind: 'slider',
        min: 1000,
        max: 100000,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [28, 8],
        [32, 8],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [32, 8],
      b: [32, 16],
      params: { capacitance: 0.0001, voltage: 25, polarized: true },
      control: {
        param: 'capacitance',
        label: 'Capacitor C',
        kind: 'select',
        options: [
          { value: 0.00001, label: '10 µF' },
          { value: 0.000047, label: '47 µF' },
          { value: 0.0001, label: '100 µF' },
          { value: 0.00047, label: '470 µF' },
        ],
      },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [32, 16],
        [11, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Tensão no capacitor' },
    { id: 'IR', kind: 'current', element: 'R1', label: 'Corrente no resistor' },
  ],
  goals: [
    {
      id: 'um-tau',
      description: 'Carregue: depois de 1 s (uma constante de tempo), o capacitor tem 6,3 V.',
      check: { readout: 'VC', op: 'between', value: [6.25, 6.35] },
      solution: { 'S1.actuated': true },
      at: 1,
    },
    {
      id: 'corrente-inicial',
      description: 'No instante em que a chave vai à bateria, a corrente é de 1 mA.',
      check: { readout: 'IR', op: 'between', value: [0.00095, 0.001001] },
      solution: { 'S1.actuated': true },
      at: 0.003,
    },
    {
      id: 'cinco-tau',
      description: 'Espere 5 s (cinco constantes de tempo): o capacitor passa de 9,9 V.',
      check: { readout: 'VC', op: '>', value: 9.9 },
      solution: { 'S1.actuated': true },
      at: 5,
    },
    {
      id: 'dobro-r',
      description: 'Com R em 20 kΩ, a constante de tempo dobra: 6,3 V só depois de 2 s.',
      check: { readout: 'VC', op: 'between', value: [6.25, 6.35] },
      solution: { 'S1.actuated': true, 'R1.resistance': 20000 },
      at: 2,
    },
  ],
});
