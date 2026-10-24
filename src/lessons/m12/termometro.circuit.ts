import { defineCircuit } from '../../engine';

/**
 * 12.3: a thermometer with an NTC (firmware m12/termometro). A 10 kΩ
 * resistor from 5 V and a 10 kΩ NTC (B = 3950 K) to GND make a divider read
 * on A0; the program computes the temperature and switches the fan output
 * (here an LED) on at 30 °C and off at 28 °C. The values the lesson quotes
 * are checked in ./circuitos.test.ts.
 */
export default defineCircuit({
  id: 'm12/termometro',
  title: 'Termômetro com NTC',
  description:
    'Um resistor de 10 kΩ, ligado aos 5 V, e um termistor NTC de 10 kΩ a 25 °C, ligado ao negativo, formam um divisor de tensão. O ponto do meio vai à entrada analógica A0 do microcontrolador. Quanto mais quente, menor a resistência do NTC e menor a tensão em A0. O programa converte a leitura em resistência e a resistência em temperatura, e liga a saída do ventilador, aqui um LED, a partir de 30 °C; ela só desliga quando a temperatura cai a 28 °C. A temperatura do ambiente em volta do NTC é ajustável. A entrada do receptor de rádio não é usada e fica ligada ao negativo.',
  analysis: { kind: 'transient', dt: 0.001, speed: 1 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 4],
      b: [0, 22],
      label: '5 V',
      params: { voltage: 5 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 4],
        [12, 4],
        [26, 4],
        [26, 10],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [12, 4],
      b: [12, 12],
      params: { resistance: 10000 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 12],
        [20, 12],
      ],
    },
    {
      id: 'TH1',
      type: 'ntc',
      a: [12, 12],
      b: [12, 22],
      label: 'NTC',
      params: { r25: 10000, beta: 3950, temperature: 25, thermalTime: 3 },
      control: {
        param: 'temperature',
        label: 'Temperatura em volta do NTC',
        kind: 'slider',
        min: 0,
        max: 60,
        step: 0.5,
        unit: '°C',
      },
    },
    {
      id: 'U1',
      type: 'mcu',
      at: [26, 13],
      label: 'Micro',
      params: { firmware: 'm12/termometro', pinsLeft: 'A0,RF', pinsRight: 'VENT' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, 14],
        [18, 14],
        [18, 22],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [26, 16],
        [26, 22],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [32, 12],
      b: [38, 12],
      params: { resistance: 220 },
    },
    {
      id: 'D1',
      type: 'led',
      a: [38, 12],
      b: [43, 12],
      label: 'Ventilador',
      params: { color: 'blue' },
    },
    { id: 'G2', type: 'ground', at: [43, 12] },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [0, 22],
        [12, 22],
        [18, 22],
        [26, 22],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 22] },
  ],
  probes: [{ id: 'VA0', kind: 'voltage', plus: 'U1.A0', minus: 'GND', label: 'Tensão em A0' }],
  goals: [
    {
      id: 'ambiente',
      description: 'A 25 °C, o programa mostra cerca de 25 °C e o ventilador fica desligado.',
      check: { readout: 'U1.temperature', op: 'between', value: [24, 26] },
      at: 0.5,
    },
    {
      id: 'quente',
      description: 'Esquente o NTC até 32 °C: o ventilador liga.',
      check: { readout: 'U1.ventilador', op: '==', value: true },
      solution: { 'TH1.temperature': 32 },
      at: 0.5,
    },
  ],
});
