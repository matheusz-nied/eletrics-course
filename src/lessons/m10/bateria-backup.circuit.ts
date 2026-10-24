import { defineCircuit } from '../../engine';

/**
 * 10.3: the backup battery of a gate controller (or an alarm panel). The
 * 13,8 V supply feeds the load through D1 and float-charges a 12 V 7 Ah
 * sealed battery through a 2,2 Ω resistor; the battery feeds the load
 * through D2 when the mains fails. The battery is a source with internal
 * resistance at a partial charge (12,6 V).
 */
export default defineCircuit({
  id: 'm10/bateria-backup',
  title: 'Bateria de backup da central',
  description:
    'A fonte da central, de 13,8 V, alimenta a carga pelo diodo D1 e, ao mesmo tempo, carrega uma bateria selada de 12 V por um resistor de 2,2 Ω, que limita a corrente de carga. A bateria também chega à carga pelo diodo D2. Com a energia da rede, a fonte alimenta tudo e a bateria recebe corrente. Quando a chave da rede abre, simulando a falta de energia, a bateria assume a carga sozinha, sem interrupção. Dá para escolher a carga: a central em espera ou o motor abrindo o portão.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 2],
      b: [0, 20],
      label: 'Fonte 13,8 V',
      params: { voltage: 13.8 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 2],
        [4, 2],
      ],
    },
    {
      id: 'SW',
      type: 'switch',
      a: [4, 2],
      b: [10, 2],
      label: 'Rede',
      params: { closed: true },
      control: { param: 'closed', label: 'Energia da rede', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 2],
        [16, 2],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [10, 2],
        [10, 8],
      ],
    },
    {
      id: 'D1',
      type: 'diode',
      a: [16, 2],
      b: [26, 2],
      label: 'D1',
      params: { model: 'rectifier', power: 6 },
    },
    {
      id: 'RC',
      type: 'resistor',
      a: [10, 8],
      b: [20, 8],
      label: 'Rc',
      params: { resistance: 2.2, watts: 5 },
    },
    {
      id: 'B1',
      type: 'battery',
      a: [20, 8],
      b: [20, 20],
      label: 'Bateria 12 V 7 Ah',
      params: { voltage: 12.6, resistance: 0.05 },
    },
    {
      id: 'D2',
      type: 'diode',
      a: [20, 8],
      b: [26, 8],
      label: 'D2',
      params: { model: 'rectifier', power: 6 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [26, 8],
        [26, 2],
        [34, 2],
      ],
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [34, 2],
      b: [34, 20],
      label: 'Carga',
      params: { resistance: 216, watts: 60 },
      control: {
        param: 'resistance',
        label: 'Carga',
        kind: 'select',
        options: [
          { value: 216, label: 'Central em espera (cerca de 60 mA)' },
          { value: 4.3, label: 'Motor abrindo o portão (cerca de 3 A)' },
        ],
      },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [0, 20],
        [20, 20],
        [34, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  probes: [
    { id: 'VCARGA', kind: 'voltage', plus: 'RL.a', minus: 'GND', label: 'Tensão na carga' },
    { id: 'IBAT', kind: 'current', element: 'B1', label: 'Corrente da bateria (+ descarregando)' },
    { id: 'IFONTE', kind: 'current', element: 'V1', label: 'Corrente da fonte' },
  ],
  goals: [
    {
      id: 'carregando',
      description: 'Com a rede ligada, a bateria recebe cerca de 0,5 A de carga.',
      check: { readout: 'IBAT', op: 'between', value: [-0.56, -0.48] },
    },
    {
      id: 'rede-caiu',
      description:
        'Abra a chave da rede: a bateria assume a central, com cerca de 11,9 V na carga.',
      check: { readout: 'VCARGA', op: 'between', value: [11.8, 12.1] },
      solution: { 'SW.closed': false },
    },
    {
      id: 'motor-na-bateria',
      description: 'Sem rede e com o motor abrindo, a bateria entrega cerca de 2,7 A.',
      check: { readout: 'IBAT', op: 'between', value: [2.5, 2.9] },
      solution: { 'SW.closed': false, 'RL.resistance': 4.3 },
    },
  ],
});
