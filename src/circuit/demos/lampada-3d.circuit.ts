import { defineCircuit } from '../engine';

/** Lamp and switch linked to a 3D scene (scene3d.bindings), for the "esquema+3d" layout. */
export default defineCircuit({
  id: 'demo/lampada-3d',
  title: 'Lâmpada ligada a uma cena 3D',
  description:
    'Uma bateria de 12 V acende uma lâmpada quando a chave fecha. O brilho e a posição da chave são enviados para a cena 3D.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 10], params: { voltage: 12 } },
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
      control: { param: 'closed', label: 'Interruptor', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 0],
        [14, 0],
      ],
    },
    { id: 'L1', type: 'lamp', a: [14, 0], b: [14, 10], params: { voltage: 12, power: 5 } },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [14, 10],
        [0, 10],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 10] },
  ],
  probes: [{ id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' }],
  scene3d: {
    scene: 'bancada-lampada',
    bindings: { 'lamp.brightness': 'L1.brightness', switchClosed: 'S1.closed' },
  },
});
