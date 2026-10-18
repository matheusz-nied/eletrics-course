/**
 * Lesson 9.2: the parts of the live I×V curve (CurvaDiodo.tsx) and the
 * numbers it draws. The curves are the engine's own diode and LED models,
 * from diodo-modelo.ts; curva-diodo.test.ts checks the values the lesson quotes.
 */
import { DIODES, ledParams, operatingPoint, type DiodeParams } from './diodo-modelo';

export type CurvePartId = '1n4148' | '1n4007' | '1n5819' | 'led-vermelho' | 'led-azul';

export interface CurvePart {
  id: CurvePartId;
  /** Name on the choice buttons. */
  label: string;
  /** Name next to the curve. */
  short: string;
  params: DiodeParams;
  /** Voltage of the constant-drop model: 0,7 V for silicon, 0,3 V for Schottky, Vf for LEDs. */
  drop: number;
}

export const CURVE_PARTS: CurvePart[] = [
  { id: '1n4148', label: '1N4148 (sinal)', short: '1N4148', params: DIODES.signal, drop: 0.7 },
  {
    id: '1n4007',
    label: '1N4007 (retificador)',
    short: '1N4007',
    params: DIODES.rectifier,
    drop: 0.7,
  },
  {
    id: '1n5819',
    label: '1N5819 (Schottky)',
    short: '1N5819',
    params: DIODES.schottky,
    drop: 0.3,
  },
  {
    id: 'led-vermelho',
    label: 'LED vermelho',
    short: 'LED vermelho',
    params: ledParams('red'),
    drop: 2.0,
  },
  { id: 'led-azul', label: 'LED azul', short: 'LED azul', params: ledParams('blue'), drop: 3.1 },
];

export function curvePart(id: CurvePartId): CurvePart {
  return CURVE_PARTS.find((p) => p.id === id)!;
}

/** Current of the constant-drop model: the diode is a fixed voltage once it conducts (A). */
export function constantDropCurrent(source: number, ohms: number, drop: number): number {
  return source > drop ? (source - drop) / ohms : 0;
}

/** Operating point of the source, the resistor and the part, plus the diode's power. */
export function solve(source: number, ohms: number, part: CurvePart) {
  const { current, voltage } = operatingPoint(source, ohms, part.params);
  return { current, voltage, power: current * voltage };
}

/** Smallest of 1, 2 and 5 × 10ⁿ at or above `x` (the top of the current axis). */
export function niceCeil(x: number): number {
  const exp = Math.floor(Math.log10(x));
  for (const m of [1, 2, 5, 10]) {
    const v = m * 10 ** exp;
    if (v >= x * (1 - 1e-9)) return v;
  }
  return 10 ** (exp + 1);
}
