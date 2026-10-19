import { defineCircuit } from '../../engine';
import { WINDOW_MOTOR } from './motor-cc.circuit';

/**
 * 8.1, start-up plot: the window motor of ./motor-cc.circuit.ts connected
 * straight to 12 V with the glass load (0,15 N·m). The current starts near
 * the locked value and falls as the back EMF builds up with the speed.
 */
export default defineCircuit({
  id: 'm08/partida-motor-cc',
  title: 'Partida do motor do vidro',
  description:
    'O motor do vidro elétrico é ligado direto a 12 V, com a carga do vidro subindo. No instante da partida, parado, ele puxa perto de 24 A; à medida que acelera, a força contraeletromotriz cresce e a corrente cai até uns 9,3 A, com o motor a uns 3.500 rpm.',
  analysis: { kind: 'transient', dt: 2e-4, tStop: 1.5 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 12],
      label: 'Bateria',
      params: { voltage: 12 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [12, 0],
      ],
    },
    {
      id: 'M1',
      type: 'dc-motor',
      a: [12, 0],
      b: [12, 12],
      label: 'Motor',
      params: { ...WINDOW_MOTOR, load: 0.15 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [{ id: 'IM', kind: 'current', element: 'M1', label: 'Corrente' }],
  goals: [
    {
      id: 'pico',
      description: 'Logo depois de ligar, a corrente passa de 20 A.',
      check: { readout: 'M1.current', op: '>', value: 20 },
      at: 0.01,
    },
    {
      id: 'regime',
      description: 'Em regime, a corrente fica em uns 9,3 A.',
      check: { readout: 'M1.current', op: 'between', value: [9.2, 9.45] },
      at: 1.5,
    },
  ],
});
