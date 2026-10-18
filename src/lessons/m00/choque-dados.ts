/**
 * Typical resistances of the body model in lesson 0.2 (safety), shared by the
 * circuit (choque.circuit.ts) and the calculator (CalculadoraChoque.tsx) so
 * both show the same currents. They are teaching values to compare orders of
 * magnitude, not values of a standard: dry skin 100 kΩ, wet skin 1 kΩ and
 * 500 Ω inside the body are the figures usually quoted in safety training
 * (e.g. OSHA); real values vary a lot from person to person.
 */

export interface Option {
  value: number;
  label: string;
}

/** Touch voltage (V): what a faulty appliance or a bare wire may have. */
export const VOLTAGES: Option[] = [
  { value: 12, label: '12 V (bateria de carro, fonte de LED)' },
  { value: 127, label: '127 V (tomada comum)' },
  { value: 220, label: '220 V (chuveiro, ar-condicionado)' },
];

/** Contact resistance of the hand that touches (Ω). */
export const HAND: Option[] = [
  { value: 100_000, label: 'Mão seca' },
  { value: 10_000, label: 'Mão suada' },
  { value: 1_000, label: 'Mão molhada' },
];

/** Inside the body, from one hand to the feet or to the other hand (Ω). */
export const BODY = 500;

/** Where the current leaves the body (Ω). */
export const EXIT: (Option & { earth: boolean })[] = [
  { value: 100, label: 'Descalço no piso molhado', earth: true },
  { value: 10_000, label: 'Descalço no piso seco', earth: true },
  { value: 1_000_000, label: 'Chinelo de borracha seco', earth: true },
  { value: 1_000, label: 'A outra mão, molhada, no neutro', earth: false },
];

/** Sensitivity of the residual-current device used in homes (A). */
export const RCD_TRIP = 0.03;
