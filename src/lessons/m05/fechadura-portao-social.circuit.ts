import { defineCircuit } from '../../engine';

/**
 * 05.2: the electric lock of a pedestrian gate, fed by the door phone's 12 V
 * supply through the cable that runs from the house to the gate. The lock
 * (12 V, 12 Ω, 1 A) releases above 60 % of its rated current. The cable is
 * one resistor for both conductors (out and back), with real cables to pick:
 * 1,5 mm² copper ≈ 0,0121 Ω/m and interphone cable with 0,40 mm conductors
 * (0,126 mm²) ≈ 0,137 Ω/m, per conductor.
 */
const CCI = 0.137;
const PP = 0.0121;
const roundTrip = (metres: number, ohmsPerMetre: number, pairs = 1) =>
  Number(((2 * metres * ohmsPerMetre) / pairs).toFixed(2));

export const CABLES = {
  grosso: roundTrip(30, PP),
  curto: roundTrip(10, CCI),
  longo: roundTrip(40, CCI),
  dobrado: roundTrip(40, CCI, 2),
};

export default defineCircuit({
  id: 'm05/fechadura-portao-social',
  title: 'Fechadura elétrica do portão social',
  description: `A fonte de 12 V do porteiro eletrônico, dentro de casa, alimenta a fechadura elétrica do portão através do botão do porteiro e do cabo que vai até o portão. O cabo aparece como um resistor só, somando o fio de ida e o de volta, e pode ser trocado: cabo de 1,5 mm² com 30 m (${CABLES.grosso.toLocaleString('pt-BR')} Ω), cabo de interfone de 0,40 mm com 10 m (${CABLES.curto.toLocaleString('pt-BR')} Ω), com 40 m (${CABLES.longo.toLocaleString('pt-BR')} Ω) ou com 40 m usando dois pares em paralelo (${CABLES.dobrado.toLocaleString('pt-BR')} Ω). A fechadura tem 12 Ω e só destrava com pelo menos 0,6 A. Com o cabo grosso, chegam cerca de 11,3 V e passam 0,94 A: abre. Com 40 m de cabo de interfone, a corrente cai para cerca de 0,52 A, chegam só 6,3 V e ela não abre. Com dois pares, a corrente sobe para cerca de 0,69 A e ela abre de novo.`,
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 12],
      label: 'Fonte do porteiro',
      params: { voltage: 12 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [6, 0],
      ],
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [6, 0],
      b: [12, 0],
      label: 'Botão do porteiro',
      control: { param: 'pressed', label: 'Botão do porteiro', kind: 'momentary' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 0],
        [18, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [18, 0],
      b: [30, 0],
      label: 'Cabo (ida e volta)',
      params: { resistance: CABLES.grosso, watts: 50 },
      control: {
        param: 'resistance',
        label: 'Cabo da casa até o portão',
        kind: 'select',
        options: [
          { value: CABLES.grosso, label: 'Cabo de 1,5 mm², 30 m' },
          { value: CABLES.curto, label: 'Cabo de interfone (0,40 mm), 10 m' },
          { value: CABLES.longo, label: 'Cabo de interfone (0,40 mm), 40 m' },
          { value: CABLES.dobrado, label: 'Cabo de interfone, 40 m, dois pares juntos' },
        ],
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [30, 0],
        [36, 0],
      ],
    },
    {
      id: 'FE1',
      type: 'electric-lock',
      a: [36, 0],
      b: [36, 12],
      label: 'Fechadura',
      params: { voltage: 12, resistance: 12 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [36, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'VF', kind: 'voltage', plus: 'FE1.a', minus: 'FE1.b', label: 'Tensão na fechadura' },
    { id: 'IF', kind: 'current', element: 'FE1', label: 'Corrente na fechadura' },
  ],
  goals: [
    {
      id: 'abre',
      description:
        'Aperte o botão do porteiro: com o cabo de 1,5 mm², passam cerca de 0,94 A e a fechadura destrava.',
      check: { readout: 'IF', op: 'between', value: [0.93, 0.955] },
      solution: { 'S1.pressed': true },
    },
    {
      id: 'curto',
      description: 'Com 10 m de cabo de interfone, ainda passam cerca de 0,81 A: a fechadura abre.',
      check: { readout: 'IF', op: 'between', value: [0.8, 0.83] },
      solution: { 'S1.pressed': true, 'R1.resistance': CABLES.curto },
    },
    {
      id: 'corrente-baixa',
      description:
        'Com 40 m de cabo de interfone, a corrente cai para cerca de 0,52 A, abaixo dos 0,6 A de que a fechadura precisa.',
      check: { readout: 'IF', op: 'between', value: [0.51, 0.535] },
      solution: { 'S1.pressed': true, 'R1.resistance': CABLES.longo },
    },
    {
      id: 'tensao-baixa',
      description: 'Nesse cabo longo, chegam só cerca de 6,3 V à fechadura.',
      check: { readout: 'VF', op: 'between', value: [6.15, 6.45] },
      solution: { 'S1.pressed': true, 'R1.resistance': CABLES.longo },
    },
    {
      id: 'dois-pares',
      description:
        'Use dois pares do cabo em paralelo: a corrente sobe para cerca de 0,69 A e a fechadura abre de novo.',
      check: { readout: 'IF', op: 'between', value: [0.675, 0.7] },
      solution: { 'S1.pressed': true, 'R1.resistance': CABLES.dobrado },
    },
  ],
});
