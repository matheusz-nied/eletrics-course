/**
 * Stages of the reduction shown in lesson 02.4 (<ReductionSteps>), for the
 * circuit of m02/circuito-misto: 12 V, R1 = 150 Ω in series with
 * R2 = 300 Ω ∥ (R3 = 100 Ω + R4 = 200 Ω). Drawing units are SVG px (360 × 220).
 */
import type { ReductionItem, ReductionStage } from './ReductionSteps';

const TOP = 40;
const BOTTOM = 180;
const SRC_X = 60;
const A_X = 210;
const RIGHT_X = 300;

const source: ReductionItem = {
  kind: 'source',
  a: [SRC_X, TOP],
  b: [SRC_X, BOTTOM],
  label: '12 V',
};
const nodes: ReductionItem[] = [
  { kind: 'node', at: [A_X, TOP], label: 'A' },
  { kind: 'node', at: [A_X, BOTTOM], label: 'B' },
];

function r1(hl = false): ReductionItem[] {
  return [
    {
      kind: 'wire',
      points: [
        [SRC_X, TOP],
        [90, TOP],
      ],
    },
    { kind: 'resistor', a: [90, TOP], b: [160, TOP], name: 'R1', value: '150 Ω', hl },
  ];
}

/** R1, the parallel group drawn by `group`, and the return wire. */
function circuit(group: ReductionItem[], hlR1 = false, rightBranch = true): ReductionItem[] {
  const right = rightBranch ? RIGHT_X : A_X;
  return [
    source,
    ...r1(hlR1),
    {
      kind: 'wire',
      points: [
        [160, TOP],
        [A_X, TOP],
        [right, TOP],
      ],
    },
    {
      kind: 'wire',
      points: [
        [right, BOTTOM],
        [A_X, BOTTOM],
        [SRC_X, BOTTOM],
      ],
    },
    ...group,
    ...nodes,
  ];
}

function original(hl34 = false): ReductionItem[] {
  return circuit([
    { kind: 'resistor', a: [A_X, TOP], b: [A_X, BOTTOM], name: 'R2', value: '300 Ω' },
    {
      kind: 'resistor',
      a: [RIGHT_X, TOP],
      b: [RIGHT_X, 110],
      name: 'R3',
      value: '100 Ω',
      hl: hl34,
    },
    {
      kind: 'resistor',
      a: [RIGHT_X, 110],
      b: [RIGHT_X, BOTTOM],
      name: 'R4',
      value: '200 Ω',
      hl: hl34,
    },
  ]);
}

function withRp(hl: boolean): ReductionItem[] {
  return circuit(
    [
      {
        kind: 'resistor',
        a: [A_X, TOP],
        b: [A_X, BOTTOM],
        name: 'RP',
        value: '150 Ω',
        hl,
      },
    ],
    hl,
    false,
  );
}

export const MIXED_STAGES: ReductionStage[] = [
  {
    title: 'O circuito original',
    text: 'Quatro resistores e uma fonte de 12 V. Para achar a corrente que sai da fonte, você vai trocar grupos simples por um único resistor equivalente, um grupo de cada vez, começando pelo ponto mais longe da fonte.',
    items: original(),
  },
  {
    title: 'R3 e R4 estão em série',
    text: 'R3 e R4 ficam no mesmo ramo, um depois do outro, e nada mais sai do ponto entre eles. A mesma corrente atravessa os dois, então as resistências se somam.',
    formula: 'R34 = R3 + R4 = 100 Ω + 200 Ω = 300 Ω',
    items: original(true),
  },
  {
    title: 'R2 e R34 estão em paralelo',
    text: 'O ramo da direita virou um resistor só, R34. Ele e R2 ligam os mesmos dois pontos, A e B, e recebem a mesma tensão. Para dois resistores em paralelo, use o produto dividido pela soma.',
    formula: 'RP = (300 × 300) ÷ (300 + 300) = 150 Ω',
    items: circuit([
      { kind: 'resistor', a: [A_X, TOP], b: [A_X, BOTTOM], name: 'R2', value: '300 Ω', hl: true },
      {
        kind: 'resistor',
        a: [RIGHT_X, TOP],
        b: [RIGHT_X, BOTTOM],
        name: 'R34',
        value: '300 Ω',
        hl: true,
        fresh: true,
      },
    ]),
  },
  {
    title: 'R1 e RP estão em série',
    text: 'O grupo paralelo virou RP, de 150 Ω, menor que cada um dos dois ramos. Agora toda a corrente da fonte passa por R1 e depois por RP: série de novo.',
    formula: 'Req = R1 + RP = 150 Ω + 150 Ω = 300 Ω',
    items: withRp(true),
  },
  {
    title: 'A corrente total',
    text: 'Para a fonte, os quatro resistores se comportam como um único resistor de 300 Ω. Pela Lei de Ohm, a corrente que sai da fonte é:',
    formula: 'I = 12 V ÷ 300 Ω = 0,04 A = 40 mA',
    items: [
      source,
      {
        kind: 'wire',
        points: [
          [SRC_X, TOP],
          [A_X, TOP],
        ],
      },
      {
        kind: 'wire',
        points: [
          [A_X, BOTTOM],
          [SRC_X, BOTTOM],
        ],
      },
      {
        kind: 'resistor',
        a: [A_X, TOP],
        b: [A_X, BOTTOM],
        name: 'Req',
        value: '300 Ω',
        fresh: true,
      },
      { kind: 'note', at: [135, TOP - 8], text: 'I = 40 mA →' },
    ],
  },
  {
    title: 'Voltando: a tensão em cada parte',
    text: 'Agora você faz o caminho de volta. Os 40 mA passam por R1 e por RP. Cada um fica com a sua parte da tensão, e as duas partes somam os 12 V da fonte.',
    formula: 'V(R1) = 150 Ω × 40 mA = 6 V; V(RP) = 150 Ω × 40 mA = 6 V',
    items: [
      ...withRp(false),
      { kind: 'note', at: [A_X - 7, TOP + 17], text: '40 mA →', anchor: 'end' },
      { kind: 'note', at: [125, 84], text: '6 V', tone: 'voltage' },
      { kind: 'note', at: [A_X + 13, 148], text: '6 V', anchor: 'start', tone: 'voltage' },
    ],
  },
  {
    title: 'Voltando: a corrente em cada ramo',
    text: 'Os 6 V de RP são a tensão entre A e B: a mesma em R2 e no ramo de R3 e R4. Cada ramo puxa a sua corrente, e as duas somam os 40 mA que chegam ao ponto A. No ramo da direita, os 6 V se dividem entre R3 e R4.',
    formula:
      'I(R2) = 6 V ÷ 300 Ω = 20 mA; I(R3 e R4) = 6 V ÷ 300 Ω = 20 mA; V(R3) = 2 V; V(R4) = 4 V',
    items: [
      ...original(),
      { kind: 'note', at: [A_X - 7, TOP + 17], text: '40 mA →', anchor: 'end' },
      { kind: 'note', at: [255, TOP - 8], text: '20 mA →' },
      { kind: 'note', at: [A_X - 13, 150], text: '20 mA ↓', anchor: 'end' },
      { kind: 'note', at: [RIGHT_X - 12, 80], text: '2 V', anchor: 'end', tone: 'voltage' },
      { kind: 'note', at: [RIGHT_X - 12, 150], text: '4 V', anchor: 'end', tone: 'voltage' },
    ],
  },
];
