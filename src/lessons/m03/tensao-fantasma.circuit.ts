import { defineCircuit } from '../../engine';

/**
 * 03.2: a disconnected wire running next to a live one picks up a "ghost"
 * voltage through the capacitance between them. A 10 MΩ meter reads tens of
 * volts; a low-impedance (LoZ) input of about 3 kΩ drains it to almost zero.
 * No goals: every readout here swings with the sine and the checklist would
 * flicker. The multimeter in CA shows the values the lesson cites (about 76 V
 * with 10 MΩ, about 0,03 V with LoZ).
 */
export default defineCircuit({
  id: 'm03/tensao-fantasma',
  title: 'Tensão fantasma num fio desligado',
  description:
    'Um fio desligado do disjuntor corre dentro do mesmo eletroduto que um fio de fase energizado, de 127 V. Entre os dois fios existe uma capacitância pequena, de cerca de 200 pF, que funciona como uma ligação fraca. O multímetro comum, de 10 MΩ, mede esse fio contra o neutro e mostra perto de 76 V, embora o fio não consiga alimentar nada. No modo de baixa impedância (LoZ), com cerca de 3 kΩ, a tensão fantasma cai para quase zero.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.05 },
  elements: [
    {
      id: 'F1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 16],
      label: 'Fase vizinha (127 V)',
      params: { amplitude: 179.6, frequency: 60 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [10, 0],
      b: [20, 0],
      label: 'Acoplamento entre os fios',
      params: { capacitance: 200e-12 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [20, 0],
        [28, 0],
      ],
    },
    {
      id: 'RM',
      type: 'resistor',
      a: [28, 0],
      b: [28, 16],
      label: 'Multímetro',
      params: { resistance: 1e7 },
      control: {
        param: 'resistance',
        label: 'Entrada do multímetro',
        kind: 'select',
        options: [
          { value: 1e7, label: 'Comum: 10 MΩ' },
          { value: 3000, label: 'Baixa impedância (LoZ): 3 kΩ' },
        ],
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [28, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    {
      id: 'VF',
      kind: 'voltage',
      plus: 'RM.a',
      minus: 'RM.b',
      label: 'Fio desligado contra o neutro',
    },
    { id: 'IF', kind: 'current', element: 'RM', label: 'Corrente que o fio consegue fornecer' },
  ],
});
