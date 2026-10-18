/**
 * Lesson 1.6: rounds of the "jogo das grandezas" (JogoGrandezas.tsx). All
 * values are typical or approximate, chosen to compare orders of magnitude.
 * Pure, unit-tested in grandezas.test.ts.
 */

export interface Magnitude {
  id: string;
  label: string;
  /** In base units (A, V, W, Ω). */
  value: number;
  /** The value as the lesson writes it, with "cerca de" when approximate. */
  text: string;
}

export interface Round {
  id: string;
  title: string;
  question: string;
  /** In the order the student first sees them (never already sorted). */
  items: Magnitude[];
}

export const ROUNDS: Round[] = [
  {
    id: 'correntes',
    title: 'Correntes',
    question: 'Ordene da menor para a maior corrente.',
    items: [
      { id: 'chuveiro', label: 'Chuveiro de 5.500 W no inverno', value: 25, text: '25 A' },
      {
        id: 'relogio',
        label: 'Relógio de pulso de ponteiros',
        value: 1e-6,
        text: 'cerca de 1 µA',
      },
      { id: 'raio', label: 'Raio', value: 30_000, text: 'cerca de 30.000 A (30 kA)' },
      { id: 'led', label: 'LED indicador aceso', value: 0.01, text: 'cerca de 10 mA' },
    ],
  },
  {
    id: 'tensoes',
    title: 'Tensões',
    question: 'Ordene da menor para a maior tensão.',
    items: [
      { id: 'tomada', label: 'Tomada comum', value: 127, text: '127 V' },
      {
        id: 'rede-rua',
        label: 'Fios de cima do poste (média tensão)',
        value: 13_800,
        text: 'cerca de 13.800 V (13,8 kV)',
      },
      { id: 'pilha', label: 'Pilha AA', value: 1.5, text: '1,5 V' },
      {
        id: 'microfone',
        label: 'Sinal de um microfone',
        value: 0.005,
        text: 'alguns milivolts (cerca de 5 mV)',
      },
    ],
  },
  {
    id: 'potencias',
    title: 'Potências',
    question: 'Ordene da menor para a maior potência.',
    items: [
      { id: 'micro-ondas', label: 'Micro-ondas', value: 1200, text: 'cerca de 1.200 W' },
      { id: 'lampada', label: 'Lâmpada LED', value: 9, text: '9 W' },
      {
        id: 'itaipu',
        label: 'Usina de Itaipu inteira',
        value: 14e9,
        text: '14.000 MW (14 GW) de capacidade instalada',
      },
      {
        id: 'relogio',
        label: 'Relógio de pulso de ponteiros',
        value: 1.5e-6,
        text: 'cerca de 1,5 µW',
      },
    ],
  },
  {
    id: 'resistencias',
    title: 'Resistências',
    question: 'Ordene da menor para a maior resistência.',
    items: [
      {
        id: 'pele',
        label: 'Pele seca, da mão até o fio',
        value: 100_000,
        text: 'cerca de 100 kΩ',
      },
      {
        id: 'fio',
        label: '1 metro de fio de cobre de 2,5 mm²',
        value: 0.0069,
        text: 'cerca de 7 mΩ',
      },
      {
        id: 'isolacao',
        label: 'Isolação de um fio em bom estado',
        value: 1e9,
        text: 'mais de 1.000 MΩ (1 GΩ)',
      },
      {
        id: 'chuveiro',
        label: 'Resistência do chuveiro no inverno',
        value: 8.8,
        text: '8,8 Ω',
      },
    ],
  },
];

/** True when the ids are in increasing order of value. */
export function isSorted(round: Round, order: readonly string[]): boolean {
  const values = order.map((id) => round.items.find((item) => item.id === id)?.value ?? NaN);
  return values.every((v, i) => i === 0 || v > values[i - 1]!);
}

/** The ids of the round in the right order. */
export function solution(round: Round): string[] {
  return [...round.items].sort((a, b) => a.value - b.value).map((item) => item.id);
}

/** Orders of magnitude (powers of ten) between the smallest and the largest value. */
export function decadesSpanned(round: Round): number {
  const values = round.items.map((item) => item.value);
  return Math.round(Math.log10(Math.max(...values) / Math.min(...values)));
}

/** Moves the item at `index` by `delta` positions, returning a new array. */
export function move<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return [...list];
  const out = [...list];
  const [item] = out.splice(index, 1);
  out.splice(target, 0, item!);
  return out;
}
