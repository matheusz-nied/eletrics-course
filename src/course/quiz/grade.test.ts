import { describe, expect, it } from 'vitest';
import {
  checkQuestions,
  formatQuantity,
  gradeChoice,
  gradeMatch,
  gradeOrder,
  isClose,
  parseAnswer,
  parsePlain,
  quizKey,
  shuffledOrder,
  splitUnit,
  type QuizQuestion,
} from './grade';

describe('parsePlain', () => {
  it.each([
    ['0,5', 0.5],
    ['0.5', 0.5],
    [',5', 0.5],
    ['1.000', 1000],
    ['12.500', 12500],
    ['1.234,5', 1234.5],
    ['1,234.5', 1234.5],
    ['1,000,000', 1000000],
    ['-2,5', -2.5],
    ['2,5e3', 2500],
    ['2x10^-3', 0.002],
    ['2×10^3', 2000],
    ['127', 127],
  ])('reads %s', (text, value) => {
    expect(parsePlain(text)).toBeCloseTo(value, 12);
  });

  it.each(['', 'abc', '1,2,3', '1.2.3', '12.34,5', '1,2.3,4', '.', '--1'])('rejects %j', (text) => {
    expect(parsePlain(text)).toBeUndefined();
  });
});

describe('splitUnit', () => {
  it('separates the SI prefix from the symbol', () => {
    expect(splitUnit('A')).toEqual({ symbol: 'A', factor: 1 });
    expect(splitUnit('mA')).toEqual({ symbol: 'A', factor: 1e-3 });
    expect(splitUnit('kΩ')).toEqual({ symbol: 'Ω', factor: 1e3 });
    expect(splitUnit('kohm')).toEqual({ symbol: 'Ω', factor: 1e3 });
    expect(splitUnit('µF')).toEqual({ symbol: 'F', factor: 1e-6 });
    expect(splitUnit('kWh')).toEqual({ symbol: 'Wh', factor: 1e3 });
    expect(splitUnit('kVA')).toEqual({ symbol: 'VA', factor: 1e3 });
    expect(splitUnit('kHz')).toEqual({ symbol: 'Hz', factor: 1e3 });
  });

  it('leaves units without prefixes alone', () => {
    expect(splitUnit('%')).toBeUndefined();
    expect(splitUnit('°C')).toBeUndefined();
    expect(splitUnit('mm²')).toBeUndefined();
  });
});

describe('parseAnswer', () => {
  it('takes a bare number in the question unit', () => {
    expect(parseAnswer('0,5', 'A')).toBe(0.5);
    expect(parseAnswer('20', 'mA')).toBe(20);
    expect(parseAnswer(' 4,7 ', 'kΩ')).toBe(4.7);
  });

  it('converts other prefixes and accepts the symbol in any case', () => {
    expect(parseAnswer('500 mA', 'A')).toBeCloseTo(0.5);
    expect(parseAnswer('0,02 A', 'mA')).toBeCloseTo(20);
    expect(parseAnswer('20m', 'mA')).toBeCloseTo(20);
    expect(parseAnswer('0,5a', 'A')).toBe(0.5);
    expect(parseAnswer('12v', 'V')).toBe(12);
    expect(parseAnswer('2,5 kW', 'W')).toBe(2500);
    expect(parseAnswer('1.000 W', 'W')).toBe(1000);
    expect(parseAnswer('100nF', 'µF')).toBeCloseTo(0.1);
    expect(parseAnswer('100 μF', 'µF')).toBe(100);
  });

  it('reads resistor notation', () => {
    expect(parseAnswer('4k7', 'Ω')).toBe(4700);
    expect(parseAnswer('4k7', 'kΩ')).toBeCloseTo(4.7);
    expect(parseAnswer('4R7', 'Ω')).toBeCloseTo(4.7);
    expect(parseAnswer('470R', 'Ω')).toBe(470);
    expect(parseAnswer('2M2', 'Ω')).toBe(2200000);
    expect(parseAnswer('4700 ohms', 'kΩ')).toBeCloseTo(4.7);
    expect(parseAnswer('4,7 kΩ', 'Ω')).toBe(4700);
  });

  it('works without a unit and with units that take no prefix', () => {
    expect(parseAnswer('4k7')).toBe(4700);
    expect(parseAnswer('3')).toBe(3);
    expect(parseAnswer('80 %', '%')).toBe(80);
    expect(parseAnswer('25°C', '°C')).toBe(25);
  });

  it('rejects text that is not a number', () => {
    expect(parseAnswer('', 'A')).toBeUndefined();
    expect(parseAnswer('meio ampère', 'A')).toBeUndefined();
    expect(parseAnswer('mA', 'A')).toBeUndefined();
  });
});

describe('isClose', () => {
  it('uses a relative margin, 1 % by default', () => {
    expect(isClose(0.505, 0.5)).toBe(true);
    expect(isClose(0.506, 0.5)).toBe(false);
    expect(isClose(0.51, 0.5, 0.02)).toBe(true);
    expect(isClose(0.52, 0.5, 0.02)).toBe(false);
    expect(isClose(-12.1, -12)).toBe(true);
  });

  it('uses an absolute margin when the answer is zero', () => {
    expect(isClose(0.005, 0)).toBe(true);
    expect(isClose(0.02, 0)).toBe(false);
    expect(isClose(0, 0, 0)).toBe(true);
  });

  it('accepts exact answers with tolerance zero', () => {
    expect(isClose(127 / 254, 0.5, 0)).toBe(true);
    expect(isClose(0.1 + 0.2, 0.3, 0)).toBe(true);
  });
});

describe('formatQuantity', () => {
  it('writes numbers the Brazilian way', () => {
    expect(formatQuantity(0.5, 'A')).toBe('0,5 A');
    expect(formatQuantity(1000, 'W')).toBe('1.000 W');
    expect(formatQuantity(17.9)).toBe('17,9');
  });
});

describe('grading', () => {
  it('multiple choice needs exactly the correct options', () => {
    const options = [{ correct: true }, {}, { correct: true }];
    expect(gradeChoice(options, [0, 2])).toBe(true);
    expect(gradeChoice(options, [0])).toBe(false);
    expect(gradeChoice(options, [0, 1, 2])).toBe(false);
  });

  it('order and matching', () => {
    expect(gradeOrder([0, 1, 2])).toBe(true);
    expect(gradeOrder([1, 0, 2])).toBe(false);
    const pairs: [string, string][] = [
      ['Tensão', 'volt'],
      ['Corrente', 'ampère'],
      ['Também tensão', 'volt'],
    ];
    expect(gradeMatch(pairs, [0, 1, 0])).toEqual([true, true, true]);
    expect(gradeMatch(pairs, [1, undefined, 2])).toEqual([false, false, true]);
  });
});

describe('order and keys', () => {
  it('shuffles the same way for the same seed', () => {
    expect(shuffledOrder(6, 42)).toEqual(shuffledOrder(6, 42));
    expect(shuffledOrder(6, 42).toSorted()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('never keeps the original order when asked', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(gradeOrder(shuffledOrder(2, seed, true))).toBe(false);
      expect(gradeOrder(shuffledOrder(3, seed, true))).toBe(false);
    }
  });

  it('gives each quiz a stable key', () => {
    const a: QuizQuestion[] = [{ type: 'vf', prompt: 'A', answer: true }];
    const b: QuizQuestion[] = [{ type: 'vf', prompt: 'B', answer: true }];
    expect(quizKey(a)).toBe(quizKey([{ type: 'vf', prompt: 'A', answer: false }]));
    expect(quizKey(a)).not.toBe(quizKey(b));
    expect(quizKey(a)).toMatch(/^q[0-9a-z]+$/);
  });
});

describe('checkQuestions', () => {
  it('accepts the content guide example', () => {
    expect(
      checkQuestions([
        { type: 'numerica', prompt: 'Qual a corrente?', answer: 0.5, tolerance: 0.02, unit: 'A' },
      ]),
    ).toEqual([]);
  });

  it('explains what is wrong, in Portuguese', () => {
    const errors = checkQuestions([
      { type: 'multipla', prompt: 'X', options: [{ text: 'a' }, { text: 'b' }] },
      { type: 'ordenar', prompt: 'Y', items: ['a'] },
      {
        type: 'associar',
        prompt: 'Z',
        pairs: [
          ['a', '1'],
          ['a', '2'],
        ],
      },
      { type: 'numerica', prompt: '', answer: 1, tolerance: -1 },
    ]);
    expect(errors).toEqual([
      'questão 1 (multipla): nenhuma alternativa tem correct: true.',
      'questão 2 (ordenar): precisa de pelo menos 2 itens.',
      'questão 3 (associar): há itens repetidos na coluna da esquerda.',
      'questão 4 (numerica): falta o enunciado (prompt).',
      'questão 4 (numerica): tolerance precisa ser zero ou positiva (0.02 = ±2 %).',
    ]);
    expect(checkQuestions([])).toEqual(['o quiz não tem questões.']);
  });
});
