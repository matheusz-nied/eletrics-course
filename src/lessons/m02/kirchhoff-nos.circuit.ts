import { defineCircuit } from '../../engine';
import { KIRCHHOFF_ELEMENTS } from './kirchhoff-base';

/** 02.5: node law. Ammeters on the three branches that meet at node A. */
export default defineCircuit({
  id: 'm02/kirchhoff-nos',
  title: 'Lei dos nós: as correntes no nó A',
  description:
    'Duas fontes, V1 = 12 V à esquerda e V2 = 9 V à direita, ligadas ao nó A por R1 = 100 Ω e R2 = 100 Ω; R3 = 1 kΩ vai do nó A ao negativo. Três amperímetros medem as correntes: 20 mA chegam por R1, 10 mA saem por R3 e 10 mA saem por R2 em direção à fonte V2. A tensão de V2 pode ser ajustada.',
  analysis: { kind: 'dc' },
  elements: KIRCHHOFF_ELEMENTS.map((el) => ({ ...el })),
  probes: [
    { id: 'I1', kind: 'current', element: 'R1', label: 'I1: chega ao nó A por R1' },
    { id: 'I2', kind: 'current', element: 'R2', label: 'I2: sai do nó A por R2' },
    { id: 'I3', kind: 'current', element: 'R3', label: 'I3: sai do nó A por R3' },
  ],
  goals: [
    {
      id: 'i1',
      description: 'Confira I1: chegam 20 mA ao nó A.',
      check: { readout: 'I1', op: 'between', value: [0.0199, 0.0201] },
    },
    {
      id: 'i2',
      description: 'Confira I2: saem 10 mA por R2, entrando na fonte V2.',
      check: { readout: 'I2', op: 'between', value: [0.0099, 0.0101] },
    },
    {
      id: 'i3',
      description: 'Confira I3: saem 10 mA por R3. Some I2 + I3 e compare com I1.',
      check: { readout: 'I3', op: 'between', value: [0.0099, 0.0101] },
    },
    {
      id: 'inverte',
      description:
        'Suba V2 para 12 V: I2 fica negativa (cerca de −5,7 mA), porque a corrente inverteu o sentido.',
      check: { readout: 'I2', op: 'between', value: [-0.0058, -0.0056] },
      solution: { 'V2.voltage': 12 },
    },
  ],
});
