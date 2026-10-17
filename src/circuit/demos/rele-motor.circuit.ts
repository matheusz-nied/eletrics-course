import { defineCircuit } from '../engine';

/** A push-button energizes a relay coil; the relay contact switches a DC motor. */
export default defineCircuit({
  id: 'demo/rele-motor',
  title: 'Relé acionando um motor',
  description:
    'Uma bateria de 12 V alimenta a bobina de um relé quando o botão S1 é apertado. O contato NA do relé liga um motor de corrente contínua. O diodo D1 protege o botão do pico de tensão da bobina.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.25 },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 18], params: { voltage: 12 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [12, 0],
        [32, 0],
      ],
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [12, 0],
      b: [12, 4],
      control: { param: 'pressed', label: 'Botão S1', kind: 'momentary' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 4],
        [12, 5],
        [18, 5],
      ],
    },
    { id: 'D1', type: 'diode', a: [12, 13], b: [12, 5] },
    { id: 'K1', type: 'relay-spdt', at: [22, 9], params: { coilVoltage: 12, coilResistance: 400 } },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [18, 13],
        [12, 13],
        [12, 18],
      ],
    },
    { id: 'M1', type: 'dc-motor', a: [32, 0], b: [32, 5], params: { resistance: 2 } },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [32, 5],
        [26, 5],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [24, 13],
        [24, 18],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [0, 18],
        [12, 18],
        [24, 18],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 18] },
  ],
  probes: [
    { id: 'IM', kind: 'current', element: 'M1', label: 'Corrente no motor' },
    { id: 'VM', kind: 'voltage', plus: 'M1.a', minus: 'M1.b', label: 'Tensão no motor' },
  ],
});
