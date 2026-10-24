import { defineCircuit } from '../../engine';

/**
 * 11.1: the input threshold of a logic gate. A slider sets the level of a
 * signal, and a 60 Hz source in series adds the noise a long wire picks up
 * from the mains. U1 reads it (high above 3 V, low below 2 V: a Schmitt
 * trigger input) and inverts; U2 inverts again, so the LED shows what U1
 * read. The values the lesson quotes are checked in ./digital.test.ts.
 */
export default defineCircuit({
  id: 'm11/limiar-entrada',
  title: 'O limiar de uma entrada digital',
  description:
    'Uma fonte ajustável de 0 a 5 V, o nível do sinal, em série com uma fonte de 60 Hz que faz o papel do ruído captado da rede, alimenta a entrada de uma porta inversora U1 com entrada Schmitt trigger, alimentada com 5 V. A saída de U1 vai a uma segunda inversora, U2, que liga um LED por um resistor de 220 Ω: o LED acende quando U1 lê nível 1. A entrada lê 1 quando o sinal passa de 3 V e só volta a ler 0 quando ele cai abaixo de 2 V. A simulação roda dez vezes mais devagar que o tempo real.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.1 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 12],
      b: [0, 22],
      label: 'Sinal',
      params: { voltage: 1 },
      control: {
        param: 'voltage',
        label: 'Nível do sinal',
        kind: 'slider',
        min: 0,
        max: 5,
        step: 0.05,
        unit: 'V',
      },
    },
    {
      id: 'VN',
      type: 'ac-voltage',
      a: [0, 2],
      b: [0, 12],
      label: 'Ruído',
      params: { amplitude: 0, frequency: 60 },
      control: {
        param: 'amplitude',
        label: 'Ruído de 60 Hz (pico)',
        kind: 'select',
        options: [
          { value: 0, label: 'Sem ruído' },
          { value: 0.4, label: '0,4 V' },
          { value: 0.8, label: '0,8 V' },
        ],
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 2],
        [10, 2],
      ],
    },
    { id: 'U1', type: 'not', at: [12, 2], label: 'U1' },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 2],
        [18, 2],
      ],
    },
    { id: 'U2', type: 'not', at: [20, 2], label: 'U2' },
    {
      id: 'R1',
      type: 'resistor',
      a: [22, 2],
      b: [30, 2],
      label: 'R1',
      params: { resistance: 220 },
    },
    {
      id: 'D1',
      type: 'led',
      a: [30, 2],
      b: [30, 14],
      label: 'Leitura',
      params: { color: 'red' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [30, 14],
        [30, 22],
        [0, 22],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 22] },
  ],
  probes: [
    { id: 'VIN', kind: 'voltage', plus: 'U1.a', minus: 'GND', label: 'Sinal na entrada de U1' },
    { id: 'VOUT', kind: 'voltage', plus: 'U2.y', minus: 'GND', label: 'Leitura (saída de U2)' },
  ],
  goals: [
    {
      id: 'zero',
      description: 'Com o sinal em 1 V, a porta lê 0 e o LED fica apagado.',
      check: { readout: 'D1.brightness', op: '<', value: 0.01 },
      at: 0.05,
    },
    {
      id: 'um',
      description: 'Suba o sinal acima de 3 V: a porta passa a ler 1 e o LED acende.',
      check: { readout: 'D1.brightness', op: '>', value: 0.3 },
      at: 0.05,
      solution: { 'V1.voltage': 3.2 },
    },
  ],
});
