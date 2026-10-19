import { defineCircuit } from '../../engine';

/**
 * 04.2: two sensors that are resistors. An NTC of 10 kΩ (B = 3950 K) on top
 * of a 10 kΩ resistor, so the output rises with the temperature; and an LDR
 * under a 10 kΩ resistor, so the output rises in the dark (as in the night
 * light of lesson 2.6). The NTC follows the room temperature in about 10 s.
 */
export default defineCircuit({
  id: 'm04/sensores',
  title: 'Sensores resistivos: NTC e LDR',
  description:
    'Uma fonte de 5 V alimenta dois divisores de tensão. No da esquerda, um termistor NTC de 10 kΩ (a 25 °C) fica em cima de um resistor de 10 kΩ: quanto mais quente, menor a resistência do NTC e maior a tensão de saída, que vale cerca de 2,5 V a 25 °C e 3,7 V a 50 °C. O NTC leva alguns segundos para acompanhar a temperatura. No da direita, um LDR fica embaixo de um resistor de 10 kΩ: com luz forte a saída fica perto de 0,4 V e no escuro passa de 4,5 V.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 16],
      label: 'Fonte 5 V',
      params: { voltage: 5 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [12, 0],
        [28, 0],
      ],
    },
    {
      id: 'NTC',
      type: 'ntc',
      a: [12, 0],
      b: [12, 8],
      label: 'NTC',
      params: { r25: 10000, beta: 3950, temperature: 25 },
      control: {
        param: 'temperature',
        label: 'Temperatura em volta do NTC',
        kind: 'slider',
        min: -20,
        max: 120,
        step: 1,
        unit: '°C',
      },
    },
    { id: 'R1', type: 'resistor', a: [12, 8], b: [12, 16], params: { resistance: 10000 } },
    { id: 'R2', type: 'resistor', a: [28, 0], b: [28, 8], params: { resistance: 10000 } },
    {
      id: 'LDR',
      type: 'ldr',
      a: [28, 8],
      b: [28, 16],
      label: 'LDR',
      params: { lux: 100 },
      control: {
        param: 'lux',
        label: 'Luz sobre o LDR',
        kind: 'slider',
        min: 0.1,
        max: 100000,
        log: true,
        unit: 'lx',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [28, 16],
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
        [19, 8],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [28, 8],
        [35, 8],
      ],
    },
  ],
  probes: [
    { id: 'VT', kind: 'voltage', plus: 'R1.a', minus: 'GND', label: 'Saída do NTC (temperatura)' },
    { id: 'VL', kind: 'voltage', plus: 'LDR.a', minus: 'GND', label: 'Saída do LDR (luz)' },
  ],
  goals: [
    {
      id: 'ntc-25',
      description: 'A 25 °C, o NTC vale 10 kΩ e a saída dele fica perto de 2,5 V.',
      check: { readout: 'VT', op: 'between', value: [2.48, 2.53] },
      at: 30,
    },
    {
      id: 'ntc-50',
      description: 'Esquente o NTC até 50 °C e espere: a saída sobe para cerca de 3,7 V.',
      check: { readout: 'VT', op: 'between', value: [3.65, 3.72] },
      at: 60,
      solution: { 'NTC.temperature': 50 },
    },
    {
      id: 'ntc-0',
      description: 'Esfrie até 0 °C: a saída cai para cerca de 1,15 V.',
      check: { readout: 'VT', op: 'between', value: [1.12, 1.18] },
      at: 60,
      solution: { 'NTC.temperature': 0 },
    },
    {
      id: 'ldr-claro',
      description:
        'Ponha 1.000 lx no LDR (uma sala bem iluminada): a saída cai para perto de 0,4 V.',
      check: { readout: 'VL', op: 'between', value: [0.35, 0.39] },
      solution: { 'LDR.lux': 1000 },
    },
    {
      id: 'ldr-escuro',
      description: 'Apague a luz (1 lx ou menos): a saída do LDR passa de 4,5 V.',
      check: { readout: 'VL', op: '>', value: 4.5 },
      solution: { 'LDR.lux': 1 },
    },
  ],
});
