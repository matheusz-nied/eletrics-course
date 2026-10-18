import { defineCircuit } from '../../engine';

/**
 * 9.3: the half-wave rectifier. The same mains and 127 V → 12 V transformer
 * as the bridge of ./retificador-ponte.circuit.ts, with a single 1N4007 and a
 * filter capacitor that can be switched in. The values the lesson quotes are
 * checked in ./retificadores.test.ts.
 */
export default defineCircuit({
  id: 'm09/retificador-meia-onda',
  title: 'Retificador de meia onda',
  description:
    'A tomada de 127 V alimenta um transformador de 127 V para 12 V. Um diodo 1N4007 em série com o secundário deixa passar só os semiciclos positivos para a carga de 30 Ω: a saída pulsa 60 vezes por segundo, com picos de cerca de 17 V, e fica em zero durante os semiciclos negativos. Uma chave liga um capacitor de filtro de 3.300 µF em paralelo com a carga. O canal 1 do osciloscópio mostra o secundário e o canal 2, a saída.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.05 },
  elements: [
    { id: 'M', type: 'mains', at: [0, 8], label: 'Tomada 127 V' },
    { id: 'G0', type: 'ground', at: [2, 10] },
    { id: 'W1', type: 'wire', points: [[2, 6], [6, 6]] },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [2, 8],
        [4, 8],
        [4, 10],
        [6, 10],
      ],
    },
    {
      id: 'T1',
      type: 'transformer',
      at: [8, 8],
      label: 'Trafo 127 V → 12 V',
      params: { ratio: 10, power: 20, coupling: 0.9995 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [10, 6],
        [12, 6],
        [12, 2],
        [14, 2],
      ],
    },
    { id: 'D1', type: 'diode', a: [14, 2], b: [22, 2], label: 'D1' },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [22, 2],
        [28, 2],
        [36, 2],
      ],
    },
    {
      id: 'SW1',
      type: 'switch',
      a: [28, 2],
      b: [28, 8],
      label: 'Filtro',
      params: { closed: false },
      control: { param: 'closed', label: 'Capacitor de filtro ligado', kind: 'toggle' },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [28, 8],
      b: [28, 16],
      label: 'C1',
      params: { capacitance: 3300e-6, voltage: 25, polarized: true },
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [36, 2],
      b: [36, 16],
      label: 'Carga',
      params: { resistance: 30, watts: 20 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [10, 10],
        [12, 10],
        [12, 16],
        [20, 16],
        [28, 16],
        [36, 16],
      ],
    },
    { id: 'G1', type: 'ground', at: [20, 16] },
  ],
  probes: [
    { id: 'VSEC', kind: 'voltage', plus: 'T1.s1', minus: 'T1.s2', label: 'Secundário' },
    { id: 'VOUT', kind: 'voltage', plus: 'RL.a', minus: 'GND', label: 'Saída' },
  ],
});
