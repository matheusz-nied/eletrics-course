/**
 * Lesson 1.4 (Ohm's law), "A extensão que esquenta": a resistive appliance on
 * an extension cord. The same numbers feed CalculadoraExtensao.tsx and match
 * extensao.circuit.ts. Pure, unit-tested in extensao.test.ts.
 */

/** Resistivity of copper at 20 °C (Ω·m). */
export const RHO_COPPER = 1.72e-8;

/** Mains voltage of the example (V). */
export const MAINS = 127;

/** Cross-sections sold for cords and extensions (mm²). */
export const GAUGES = [0.5, 0.75, 1, 1.5, 2.5, 4];

/** Resistance of both conductors of a cord `meters` long (Ω). */
export function cordResistance(mm2: number, meters: number): number {
  return (RHO_COPPER * 2 * meters) / (mm2 * 1e-6);
}

export interface CordResult {
  /** Resistance of the two conductors (Ω). */
  wires: number;
  /** Current in the circuit (A). */
  current: number;
  /** Voltage lost along the cord (V). */
  drop: number;
  /** Voltage left for the appliance (V). */
  appliance: number;
  /** Heat produced in the cord (W). */
  heat: number;
  /** Power the appliance actually gets (W). */
  appliancePower: number;
}

/**
 * A resistive appliance rated `watts` at 127 V (its resistance is V²/P) fed
 * through the cord: the wires and the appliance are in series.
 */
export function cord(mm2: number, meters: number, watts: number): CordResult {
  const wires = cordResistance(mm2, meters);
  const load = MAINS ** 2 / watts;
  const current = MAINS / (wires + load);
  return {
    wires,
    current,
    drop: current * wires,
    appliance: current * load,
    heat: current ** 2 * wires,
    appliancePower: current ** 2 * load,
  };
}
