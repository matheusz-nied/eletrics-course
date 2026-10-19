import { defineCircuit } from '../../engine';

/**
 * 06.1: the same 12 V lamp fed by a battery (DC) or by a generator (AC, 12 V
 * RMS), with the generator frequency adjustable from 0,5 Hz to 120 Hz. At
 * 60 Hz the filament cannot cool between half cycles and the lamp looks
 * steady; at 1 Hz it flickers twice per cycle. Values checked in
 * ./lampadas-ca.test.ts.
 */
export default defineCircuit({
  id: 'm06/cc-ca-lampada',
  title: 'A mesma lâmpada em CC e em CA',
  description:
    'Uma chave de duas posições liga uma lâmpada de 12 V e 5 W a uma bateria de 12 V (corrente contínua) ou a um gerador de corrente alternada de 12 V eficazes, com pico de 17 V. A frequência do gerador vai de 0,5 Hz a 120 Hz e começa em 60 Hz. Na bateria, a tensão na lâmpada é uma linha reta. No gerador, é uma senoide que troca de sinal a cada meio ciclo, e a corrente acompanha a tensão. Em 60 Hz a lâmpada brilha igual à da bateria e parece acesa sem parar; em 1 Hz ela pisca duas vezes por ciclo, porque o filamento tem tempo de esfriar quando a tensão passa por zero.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.25 },
  elements: [
    {
      id: 'G1',
      type: 'ac-voltage',
      a: [0, 2],
      b: [0, 14],
      label: 'Gerador CA 12 V',
      params: { amplitude: 16.97, frequency: 60 },
      control: {
        param: 'frequency',
        label: 'Frequência do gerador',
        kind: 'slider',
        min: 0.5,
        max: 120,
        step: 0.5,
        log: true,
        unit: 'Hz',
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 2],
        [11, 2],
      ],
    },
    {
      id: 'B1',
      type: 'dc-voltage',
      a: [6, 6],
      b: [6, 14],
      label: 'Bateria 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [6, 6],
        [11, 6],
      ],
    },
    {
      id: 'S1',
      type: 'switch-spdt',
      at: [14, 4],
      rot: 180,
      label: 'Chave',
      params: { actuated: true },
      control: {
        param: 'actuated',
        label: 'A lâmpada está ligada',
        kind: 'select',
        options: [
          { value: false, label: 'Na bateria (CC)' },
          { value: true, label: 'No gerador (CA)' },
        ],
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [17, 4],
        [24, 4],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [24, 4],
      b: [24, 14],
      label: 'Lâmpada 12 V 5 W',
      params: { voltage: 12, power: 5 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [0, 14],
        [6, 14],
        [24, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'VL', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão na lâmpada' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' },
  ],
});
