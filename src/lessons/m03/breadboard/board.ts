/**
 * Lesson 3.6: a 30-column breadboard without UI. Which holes share a metal
 * strip (columns of five, the channel in the middle, the power rails, rails
 * split in the middle on some large boards), pt-BR names for every hole and
 * the "find the error" layouts, checked in board.test.ts.
 */

export const COLS = 30;

/** Rows from top to bottom: two rails, a–e, the channel, f–j, two rails. */
export const ROWS = [
  'T-',
  'T+',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'B+',
  'B-',
] as const;
export type Row = (typeof ROWS)[number];

const RAIL_ROWS: readonly Row[] = ['T-', 'T+', 'B+', 'B-'];

/** Rail holes come in groups of five; the wider gap in the middle is where split rails break. */
export const RAIL_COLS = [3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28];
/** Split rails: columns up to here are the left half. */
const SPLIT_AFTER = 13;

export interface Hole {
  id: string;
  row: Row;
  col: number;
}

export function isRail(row: Row): boolean {
  return RAIL_ROWS.includes(row);
}

export function holeId(row: Row, col: number): string {
  return `${row}${col}`;
}

/** Every hole of the board, row by row. */
export const HOLES: Hole[] = ROWS.flatMap((row) =>
  (isRail(row) ? RAIL_COLS : Array.from({ length: COLS }, (_, i) => i + 1)).map((col) => ({
    id: holeId(row, col),
    row,
    col,
  })),
);

const BY_ID = new Map(HOLES.map((h) => [h.id, h]));

export function hole(id: string): Hole {
  const h = BY_ID.get(id);
  if (!h) throw new Error(`Furo desconhecido: ${id}`);
  return h;
}

/** The metal strip a hole belongs to. */
export function netOf(id: string, split: boolean): string {
  const { row, col } = hole(id);
  if (isRail(row)) {
    const half = split ? (col <= SPLIT_AFTER ? ':esq' : ':dir') : '';
    return `trilho${row}${half}`;
  }
  return `col${col}:${'abcde'.includes(row) ? 'cima' : 'baixo'}`;
}

/** Holes on the same strip as `id`, itself included. */
export function connected(id: string, split: boolean): string[] {
  const net = netOf(id, split);
  return HOLES.filter((h) => netOf(h.id, split) === net).map((h) => h.id);
}

export function sameNet(a: string, b: string, split: boolean): boolean {
  return netOf(a, split) === netOf(b, split);
}

const RAIL_NAMES: Record<string, string> = {
  'T-': 'trilho − de cima',
  'T+': 'trilho + de cima',
  'B+': 'trilho + de baixo',
  'B-': 'trilho − de baixo',
};

/** "furo C12", "trilho + de cima, coluna 3". */
export function holeName(id: string): string {
  const { row, col } = hole(id);
  if (isRail(row)) return `${RAIL_NAMES[row]}, coluna ${col}`;
  return `furo ${row.toUpperCase()}${col}`;
}

/** pt-BR description of a strip, for the status line. */
export function stripName(id: string, split: boolean): string {
  const { row, col } = hole(id);
  if (isRail(row)) {
    const which = RAIL_NAMES[row]!;
    if (!split) return `${which}: a linha inteira, de ponta a ponta`;
    return `${which}: só a metade ${col <= SPLIT_AFTER ? 'esquerda' : 'direita'} (trilho dividido)`;
  }
  const rows = 'abcde'.includes(row) ? 'A a E' : 'F a J';
  return `coluna ${col}, furos ${rows}`;
}

/** Arrow-key navigation: the hole reached from `id`, snapping to the nearest rail hole. */
export function move(id: string, dRow: number, dCol: number): string {
  const { row, col } = hole(id);
  if (dCol !== 0) {
    const cols = isRail(row) ? RAIL_COLS : HOLES.filter((h) => h.row === row).map((h) => h.col);
    const i = cols.indexOf(col) + dCol;
    return holeId(row, cols[Math.max(0, Math.min(cols.length - 1, i))]!);
  }
  const r = Math.max(0, Math.min(ROWS.length - 1, ROWS.indexOf(row) + dRow));
  const next = ROWS[r]!;
  if (!isRail(next)) return holeId(next, col);
  const nearest = RAIL_COLS.reduce((best, c) =>
    Math.abs(c - col) < Math.abs(best - col) ? c : best,
  );
  return holeId(next, nearest);
}

// Parts placed on the board for the exercises

export type PartKind = 'resistor' | 'led' | 'jumper' | 'lead+' | 'lead-';

export interface Part {
  id: string;
  kind: PartKind;
  /** pt-BR name: "resistor de 330 Ω". */
  name: string;
  /** Holes of the legs (one for a supply lead). For the LED: anode, cathode. */
  legs: string[];
  /** Jumper color. */
  color?: string;
}

export interface Scenario {
  id: string;
  title: string;
  /** What the student sees happen. */
  symptom: string;
  split: boolean;
  parts: Part[];
  question: string;
  options: { text: string; correct?: boolean; feedback: string }[];
}

const LEADS: Part[] = [
  { id: 'P', kind: 'lead+', name: 'fio + da fonte de 5 V', legs: ['T+3'] },
  { id: 'N', kind: 'lead-', name: 'fio − da fonte de 5 V', legs: ['T-3'] },
];

export const SCENARIOS: Scenario[] = [
  {
    id: 'resistor-mesma-coluna',
    title: 'O LED queimou na hora',
    symptom: 'Ao ligar a fonte de 5 V, o LED deu um brilho forte e apagou para sempre.',
    split: false,
    parts: [
      ...LEADS,
      { id: 'J1', kind: 'jumper', name: 'jumper vermelho', legs: ['T+5', 'a8'], color: '#d63a2c' },
      { id: 'R1', kind: 'resistor', name: 'resistor de 330 Ω', legs: ['b8', 'd8'] },
      { id: 'D1', kind: 'led', name: 'LED', legs: ['e8', 'f8'] },
      { id: 'J2', kind: 'jumper', name: 'jumper preto', legs: ['j8', 'B-7'], color: '#1c1f24' },
      { id: 'J3', kind: 'jumper', name: 'jumper preto', legs: ['T-28', 'B-28'], color: '#1c1f24' },
    ],
    question: 'O que fez o LED queimar?',
    options: [
      {
        text: 'O resistor está com as duas pernas na mesma coluna',
        correct: true,
        feedback:
          'Isso. B8 e D8 estão na mesma trilha de metal, então a corrente passa pela trilha e o resistor fica de enfeite. O LED recebeu os 5 V sem nada para limitar a corrente.',
      },
      {
        text: 'O LED está atravessando o canal do meio',
        feedback:
          'Atravessar o canal é o jeito certo: E8 e F8 ficam em trilhas diferentes, e o LED liga uma à outra. Clique no furo B8 e veja até onde vai a trilha dele.',
      },
      {
        text: 'O jumper preto precisava ir no trilho de cima',
        feedback:
          'O jumper J3 liga o trilho − de cima ao de baixo, então J2 está no negativo da fonte. O problema está antes do LED: clique em B8 e veja que furos estão ligados a ele.',
      },
    ],
  },
  {
    id: 'trilho-dividido',
    title: 'Nada acende, mas a fonte está ligada',
    symptom:
      'A fonte mostra 5 V, o multímetro mede 5 V entre os trilhos do lado esquerdo, mas o LED montado do lado direito não acende.',
    split: true,
    parts: [
      ...LEADS,
      {
        id: 'J1',
        kind: 'jumper',
        name: 'jumper vermelho',
        legs: ['T+20', 'a21'],
        color: '#d63a2c',
      },
      { id: 'R1', kind: 'resistor', name: 'resistor de 330 Ω', legs: ['c21', 'c25'] },
      { id: 'D1', kind: 'led', name: 'LED', legs: ['e25', 'f25'] },
      { id: 'J2', kind: 'jumper', name: 'jumper preto', legs: ['j25', 'B-26'], color: '#1c1f24' },
      { id: 'J3', kind: 'jumper', name: 'jumper preto', legs: ['T-9', 'B-9'], color: '#1c1f24' },
    ],
    question: 'Por que o LED não acende?',
    options: [
      {
        text: 'Os trilhos desta protoboard são divididos no meio',
        correct: true,
        feedback:
          'Isso. Nesta protoboard grande, o trilho + de cima acaba na coluna 13 e recomeça na 18 sem ligação. A fonte está na metade esquerda e o circuito na direita. A solução são dois jumpers unindo as metades, no + e no −.',
      },
      {
        text: 'O resistor deveria estar na vertical',
        feedback:
          'Resistor na horizontal, de C21 a C25, está certo: cada perna fica numa coluna diferente. Clique no furo do trilho onde chega o J1 e veja até onde ele vai.',
      },
      {
        text: 'O LED está ao contrário',
        feedback:
          'O LED está com o ânodo (perna longa) do lado do resistor, o que está certo. E mesmo um LED invertido não explicaria o multímetro: clique no trilho + da direita e veja que ele não chega à fonte.',
      },
    ],
  },
  {
    id: 'jumper-coluna-errada',
    title: 'Funcionava no esquema, não na protoboard',
    symptom: 'O esquema está certo, todas as peças são novas, mas o LED não acende.',
    split: false,
    parts: [
      ...LEADS,
      {
        id: 'J1',
        kind: 'jumper',
        name: 'jumper vermelho',
        legs: ['T+11', 'a14'],
        color: '#d63a2c',
      },
      { id: 'R1', kind: 'resistor', name: 'resistor de 330 Ω', legs: ['b15', 'b19'] },
      { id: 'D1', kind: 'led', name: 'LED', legs: ['e19', 'f19'] },
      { id: 'J2', kind: 'jumper', name: 'jumper preto', legs: ['j19', 'B-20'], color: '#1c1f24' },
      { id: 'J3', kind: 'jumper', name: 'jumper preto', legs: ['T-26', 'B-26'], color: '#1c1f24' },
    ],
    question: 'Onde está o erro?',
    options: [
      {
        text: 'O jumper vermelho caiu na coluna 14, e o resistor começa na 15',
        correct: true,
        feedback:
          'Isso. Uma coluna de diferença basta: a coluna 14 não tem mais nada ligado, e o resistor fica sem a tensão da fonte. É o erro mais comum de todos; confira coluna por coluna.',
      },
      {
        text: 'O resistor e o LED precisam ficar no mesmo lado do canal',
        feedback:
          'O LED atravessa o canal de propósito: a perna de cima fica na coluna 19 com o resistor, e a de baixo vai ao negativo pelo J2. Clique no furo A14 e veja o que mais está ligado a ele.',
      },
      {
        text: 'Falta um jumper ligando o trilho + de cima ao de baixo',
        feedback:
          'O trilho + de baixo não é usado neste circuito, então não faz falta. Clique no furo A14 e veja a que ele está ligado.',
      },
    ],
  },
];

/** Strips a part's legs touch, for the status line ("perna do resistor R1"). */
export function partsOnNet(parts: Part[], net: string, split: boolean): string[] {
  const out: string[] = [];
  for (const p of parts) {
    p.legs.forEach((leg, i) => {
      if (netOf(leg, split) !== net) return;
      if (p.kind === 'lead+' || p.kind === 'lead-') out.push(p.name);
      else if (p.kind === 'led') out.push(i === 0 ? 'ânodo do LED (perna longa)' : 'cátodo do LED');
      else if (p.kind === 'resistor') out.push(`perna do ${p.name}`);
      else out.push(`ponta do ${p.name} ${p.id}`);
    });
  }
  return out;
}
