import { defineCircuit } from '../../engine';
import { KIRCHHOFF_ELEMENTS } from './kirchhoff-base';

/** 02.5: loop law. Voltmeters on the three resistors of the two loops. */
export default defineCircuit({
  id: 'm02/kirchhoff-malhas',
  title: 'Lei das malhas: as tensões em cada caminho fechado',
  description:
    'O mesmo circuito de duas fontes, agora com voltímetros nos três resistores. Na malha da esquerda, os 12 V de V1 se dividem em 2 V em R1 e 10 V em R3. Na malha da direita, os 10 V de R3 são iguais a 1 V em R2 mais os 9 V de V2. A tensão de V2 pode ser ajustada.',
  analysis: { kind: 'dc' },
  elements: KIRCHHOFF_ELEMENTS.map((el) => ({ ...el })),
  probes: [
    { id: 'VR1', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'Tensão em R1' },
    { id: 'VR3', kind: 'voltage', plus: 'R3.a', minus: 'R3.b', label: 'Tensão em R3' },
    { id: 'VR2', kind: 'voltage', plus: 'R2.a', minus: 'R2.b', label: 'Tensão em R2' },
  ],
  goals: [
    {
      id: 'vr1',
      description: 'Confira os 2 V em R1.',
      check: { readout: 'VR1', op: 'between', value: [1.99, 2.01] },
    },
    {
      id: 'vr3',
      description: 'Confira os 10 V em R3. Na malha da esquerda: 12 − 2 − 10 = 0.',
      check: { readout: 'VR3', op: 'between', value: [9.99, 10.01] },
    },
    {
      id: 'vr2',
      description: 'Confira o 1 V em R2. Na malha da direita: 10 − 1 − 9 = 0.',
      check: { readout: 'VR2', op: 'between', value: [0.99, 1.01] },
    },
    {
      id: 'v2-12',
      description:
        'Suba V2 para 12 V: R3 passa a ter cerca de 11,4 V, e as malhas continuam somando zero.',
      check: { readout: 'VR3', op: 'between', value: [11.4, 11.46] },
      solution: { 'V2.voltage': 12 },
    },
  ],
});
