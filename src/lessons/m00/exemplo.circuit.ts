import { defineCircuit } from '../../engine';

/** Example lesson (m00-comece-aqui/00-exemplo): the battery and resistor of the text, plus a capacitor. */
export default defineCircuit({
  id: 'm00/exemplo',
  title: 'Bateria, resistor e capacitor',
  description:
    'Uma bateria de 12 V carrega um capacitor de 1 µF através de um resistor de 4,7 kΩ quando a chave está fechada. No início a corrente é 12 V ÷ 4,7 kΩ ≈ 2,55 mA e cai à medida que o capacitor carrega.',
  analysis: { kind: 'transient', dt: 5e-5, speed: 0.02, tStop: 0.05 },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 10], params: { voltage: 12, resistance: 0 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [4, 0],
      b: [10, 0],
      params: { closed: true },
      control: { param: 'closed', label: 'Chave S1', kind: 'toggle' },
    },
    { id: 'R1', type: 'resistor', a: [10, 0], b: [18, 0], params: { resistance: 4700 } },
    { id: 'C1', type: 'capacitor', a: [18, 0], b: [18, 10], params: { capacitance: 1e-6 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [18, 10],
        [0, 10],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 10] },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Tensão no capacitor' },
    { id: 'IR', kind: 'current', element: 'R1', label: 'Corrente no resistor' },
  ],
});
