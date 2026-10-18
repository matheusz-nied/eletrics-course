import { defineCircuit } from '../../engine';

/** 03.2: the outlet is a 60 Hz sine; 127 V is its RMS value, the peak is 179,6 V. */
export default defineCircuit({
  id: 'm03/tomada-127',
  title: 'A tensão da tomada',
  description:
    'Uma tomada de 127 V alimenta uma lâmpada incandescente de 127 V e 60 W. A tensão da tomada é uma senoide de 60 Hz que sobe até 179,6 V, desce até −179,6 V e passa por zero 120 vezes por segundo. O multímetro em CA mostra o valor eficaz, 127 V; em CC, mostra a média, que é praticamente zero. A rede pode ser trocada para 220 V, com pico de 311 V: a lâmpada de 127 V recebe três vezes a potência e queima.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.05 },
  elements: [
    {
      id: 'T1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 14],
      label: 'Tomada',
      params: { amplitude: 179.6, frequency: 60 },
      control: {
        param: 'amplitude',
        label: 'Tensão da rede',
        kind: 'select',
        options: [
          { value: 179.6, label: '127 V (pico de 179,6 V)' },
          { value: 311.1, label: '220 V (pico de 311,1 V)' },
        ],
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [14, 0],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [14, 0],
      b: [14, 14],
      label: 'Lâmpada 127 V 60 W',
      params: { voltage: 127, power: 60 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'VT', kind: 'voltage', plus: 'T1.a', minus: 'T1.b', label: 'Tensão da tomada' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' },
  ],
  // Only readouts that stay still over a cycle: the checklist is read a few times a second.
  goals: [
    {
      id: 'acesa',
      description: 'Ligada em 127 V, a lâmpada acende normalmente.',
      check: { readout: 'L1.brightness', op: '>', value: 0.9 },
    },
    {
      id: 'resistencia',
      description:
        'Acesa, o filamento tem cerca de 269 Ω: 127 V ÷ 269 Ω ≈ 0,47 A, a corrente eficaz da lâmpada.',
      check: { readout: 'L1.resistance', op: 'between', value: [265, 272] },
    },
    {
      id: 'queima',
      description: 'Troque a rede para 220 V e veja o que acontece com a lâmpada de 127 V.',
      check: { readout: 'L1.burned', op: '==', value: true },
      solution: { 'T1.amplitude': 311.1 },
    },
  ],
});
