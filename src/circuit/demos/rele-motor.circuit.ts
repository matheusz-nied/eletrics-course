import { defineCircuit } from '../engine';

/** A push-button energizes a relay coil; the relay contact switches a DC motor. */
export default defineCircuit({
  id: 'demo/rele-motor',
  title: 'Relé acionando um motor',
  description:
    'Uma bateria de 12 V alimenta a bobina de um relé quando o botão S1 é apertado. O contato NA do relé liga um motor de corrente contínua. O diodo D1 protege o botão do pico de tensão da bobina.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.25 },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 14], params: { voltage: 12 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [14, 0],
        [30, 0],
      ],
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [14, 0],
      b: [14, 4],
      control: { param: 'pressed', label: 'Botão S1', kind: 'momentary' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 4],
        [14, 6],
        [18, 6],
      ],
    },
    { id: 'D1', type: 'diode', a: [14, 10], b: [14, 6] },
    { id: 'K1', type: 'relay-spdt', at: [20, 8], params: { coilVoltage: 12, coilResistance: 400 } },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [18, 10],
        [14, 10],
        [14, 14],
      ],
    },
    { id: 'M1', type: 'dc-motor', a: [30, 0], b: [30, 6], params: { resistance: 2 } },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [30, 6],
        [23, 6],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [22, 10],
        [22, 14],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [0, 14],
        [14, 14],
        [22, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'IM', kind: 'current', element: 'M1', label: 'Corrente no motor' },
    { id: 'VM', kind: 'voltage', plus: 'M1.a', minus: 'M1.b', label: 'Tensão no motor' },
  ],
});
