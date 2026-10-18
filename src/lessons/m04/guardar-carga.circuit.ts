import { defineCircuit } from '../../engine';

/**
 * 04.3: a capacitor stores charge. "Carregar" fills a 1.000 µF capacitor from
 * a 9 V battery; "Descarregar no LED" empties it into an LED, which lights
 * and fades out with no battery in its path. The discharge values the lesson
 * quotes are checked in ./capacitores.test.ts.
 */
export default defineCircuit({
  id: 'm04/guardar-carga',
  title: 'O capacitor guarda carga',
  description:
    'Uma bateria de 9 V carrega um capacitor eletrolítico de 1.000 µF por um resistor de 100 Ω enquanto o botão "Carregar" está apertado. Solto o botão, o capacitor fica isolado e mantém os 9 V: guarda 9 mC de carga e 40,5 mJ de energia. O botão "Descarregar no LED" liga o capacitor a um LED vermelho com um resistor de 470 Ω: o LED acende sem a bateria, com cerca de 15 mA no começo, e vai apagando em pouco mais de um segundo, enquanto a tensão do capacitor cai.',
  analysis: { kind: 'transient', dt: 0.002 },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 16],
      params: { voltage: 9, resistance: 0.5 },
    },
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
      type: 'push-button',
      a: [4, 0],
      b: [10, 0],
      label: 'Carregar',
      control: { param: 'pressed', label: 'Carregar', kind: 'momentary' },
    },
    { id: 'R1', type: 'resistor', a: [10, 0], b: [18, 0], params: { resistance: 100 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [18, 0],
        [22, 0],
        [28, 0],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [22, 0],
      b: [22, 16],
      label: '1.000 µF',
      params: { capacitance: 0.001, voltage: 16, polarized: true },
    },
    {
      id: 'S2',
      type: 'push-button',
      a: [28, 0],
      b: [34, 0],
      label: 'Descarregar',
      control: { param: 'pressed', label: 'Descarregar no LED', kind: 'momentary' },
    },
    { id: 'R2', type: 'resistor', a: [34, 0], b: [42, 0], params: { resistance: 470 } },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [42, 0],
        [44, 0],
        [44, 6],
      ],
    },
    { id: 'D1', type: 'led', a: [44, 6], b: [44, 16], params: { color: 'red' } },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [44, 16],
        [22, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'C1.b', label: 'Tensão no capacitor' },
    { id: 'ILED', kind: 'current', element: 'D1', label: 'Corrente no LED' },
  ],
  goals: [
    {
      id: 'carregar',
      description: 'Segure "Carregar" por um segundo: o capacitor chega a 9 V.',
      check: { readout: 'VC', op: 'between', value: [8.9, 9.05] },
      solution: { 'S1.pressed': true },
    },
    {
      id: 'carga',
      description: 'Abra a tabela de valores: com 9 V, a carga guardada é de 9 mC.',
      check: { readout: 'C1.charge', op: 'between', value: [0.0089, 0.00905] },
      solution: { 'S1.pressed': true },
    },
    {
      id: 'energia',
      description: 'E a energia guardada é de cerca de 40 mJ.',
      check: { readout: 'C1.energy', op: 'between', value: [0.0396, 0.0406] },
      solution: { 'S1.pressed': true },
    },
  ],
});
