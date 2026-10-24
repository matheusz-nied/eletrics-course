import { defineCircuit } from '../../engine';
import type { ElementDoc } from '../../engine/contract';

/**
 * 11.4: a 4-bit binary counter. A square wave clock feeds a counter whose
 * outputs light four LEDs, Q3 (worth 8) on the left and Q0 (worth 1) on
 * the right, so the LEDs read as the binary number. Each output runs right
 * and then down to its 220 Ω resistor and LED; the outputs higher up go
 * further right, so no wires cross. Checked in ./flip-flops.test.ts.
 */
const OUTPUTS = [
  { pin: 'q3', y: 13, x: 47, weight: 8 },
  { pin: 'q2', y: 11, x: 57, weight: 4 },
  { pin: 'q1', y: 9, x: 67, weight: 2 },
  { pin: 'q0', y: 7, x: 77, weight: 1 },
];
/** Where the resistors start, the LEDs start and the grounds are. */
const R_Y = 16;
const LED_Y = 22;
const GND_Y = 30;

const leds: ElementDoc[] = OUTPUTS.flatMap(({ pin, y, x, weight }, k): ElementDoc[] => {
  const n = 4 - k;
  return [
    {
      id: `WL${n}`,
      type: 'wire',
      points: [
        [41, y],
        [x, y],
        [x, R_Y],
      ],
    },
    {
      id: `R${n}`,
      type: 'resistor',
      a: [x, R_Y],
      b: [x, LED_Y],
      label: `R${n}`,
      params: { resistance: 220 },
    },
    {
      id: `D${n}`,
      type: 'led',
      a: [x, LED_Y],
      b: [x, GND_Y],
      label: `${pin.toUpperCase()} · ${weight}`,
      params: { color: 'red' },
    },
    { id: `GL${n}`, type: 'ground', at: [x, GND_Y] },
  ];
});

export default defineCircuit({
  id: 'm11/contador',
  title: 'Contador binário de 4 bits',
  description:
    'Uma fonte de onda quadrada de 5 V é o clock de um contador binário de 4 bits, com o reset ligado ao GND. Cada saída do contador acende um LED vermelho por 220 Ω. Da esquerda para a direita, os LEDs mostram Q3 (vale 8), Q2 (vale 4), Q1 (vale 2) e Q0 (vale 1): lidos juntos, são a contagem em binário. A frequência do clock pode ser escolhida.',
  analysis: { kind: 'transient', dt: 1e-3 },
  elements: [
    {
      id: 'CK',
      type: 'square-voltage',
      a: [24, 8],
      b: [24, 18],
      label: 'Clock',
      params: { high: 5, low: 0, frequency: 1, duty: 0.5 },
      control: {
        param: 'frequency',
        label: 'Frequência do clock',
        kind: 'select',
        options: [
          { value: 1, label: '1 Hz' },
          { value: 2, label: '2 Hz' },
          { value: 5, label: '5 Hz' },
        ],
      },
    },
    { id: 'G1', type: 'ground', at: [24, 18] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [24, 8],
        [33, 8],
      ],
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [33, 12],
        [31, 12],
        [31, 18],
      ],
    },
    { id: 'GR', type: 'ground', at: [31, 18] },
    { id: 'U1', type: 'counter-4bit', at: [37, 10], label: 'Contador' },
    ...leds,
  ],
});
