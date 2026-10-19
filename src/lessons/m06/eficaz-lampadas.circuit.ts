import { defineCircuit } from '../../engine';

/**
 * 06.2: three identical 127 V 100 W lamps. The first on 127 V DC, the second
 * on an AC source of 127 V RMS (179,6 V peak), the third on an AC source whose
 * PEAK is 127 V (89,8 V RMS). The first two glow alike: that is what the RMS
 * value means. The third gets about 59 W (a fixed resistor would get half,
 * but the cooler filament has less resistance). Values checked in
 * ./lampadas-ca.test.ts.
 */
export default defineCircuit({
  id: 'm06/eficaz-lampadas',
  title: 'O que quer dizer 127 V eficazes',
  description:
    'Três lâmpadas iguais, de 127 V e 100 W, cada uma com a sua fonte. A primeira está numa fonte contínua de 127 V. A segunda está numa fonte alternada de 60 Hz com 127 V eficazes, ou seja, 179,6 V de pico, como a tomada. A terceira está numa fonte alternada cujo pico é 127 V, o que dá só 89,8 V eficazes. As duas primeiras brilham igual e esquentam igual. A terceira recebe só uns 59 W e fica bem mais fraca.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.05 },
  elements: [
    {
      id: 'E1',
      type: 'dc-voltage',
      a: [0, 2],
      b: [0, 12],
      label: 'CC 127 V',
      params: { voltage: 127 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 2],
        [6, 2],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [6, 2],
      b: [6, 12],
      label: 'L1',
      params: { voltage: 127, power: 100 },
    },
    {
      id: 'E2',
      type: 'ac-voltage',
      a: [12, 2],
      b: [12, 12],
      label: 'CA 127 V eficazes',
      params: { amplitude: 179.6, frequency: 60 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 2],
        [18, 2],
      ],
    },
    {
      id: 'L2',
      type: 'lamp',
      a: [18, 2],
      b: [18, 12],
      label: 'L2',
      params: { voltage: 127, power: 100 },
    },
    {
      id: 'E3',
      type: 'ac-voltage',
      a: [24, 2],
      b: [24, 12],
      label: 'CA 127 V de pico',
      params: { amplitude: 127, frequency: 60 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [24, 2],
        [30, 2],
      ],
    },
    {
      id: 'L3',
      type: 'lamp',
      a: [30, 2],
      b: [30, 12],
      label: 'L3',
      params: { voltage: 127, power: 100 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [0, 12],
        [6, 12],
        [12, 12],
        [18, 12],
        [24, 12],
        [30, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'V1', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'L1 (CC 127 V)' },
    { id: 'V2', kind: 'voltage', plus: 'L2.a', minus: 'L2.b', label: 'L2 (CA 127 V eficazes)' },
    { id: 'V3', kind: 'voltage', plus: 'L3.a', minus: 'L3.b', label: 'L3 (CA 127 V de pico)' },
  ],
  // Brightness follows the filament temperature, which barely ripples over a cycle.
  goals: [
    {
      id: 'igual',
      description: 'L2, com 127 V eficazes de CA, brilha como L1, com 127 V de CC.',
      check: { readout: 'L2.brightness', op: 'between', value: [0.95, 1.05] },
    },
    {
      id: 'fraca',
      description: 'L3, com só 127 V de pico, fica bem mais fraca.',
      check: { readout: 'L3.brightness', op: '<', value: 0.4 },
    },
  ],
});
