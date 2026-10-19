/**
 * Lesson 7.4 (fios e cabos): sizing a branch circuit of a house. Pure logic
 * behind CalculadoraCircuito.tsx, unit-tested in circuito.test.ts.
 *
 * Steps, in the order a designer follows them:
 * 1. design current I_B from the power and the voltage;
 * 2. the smallest section whose current-carrying capacity I_Z holds I_B,
 *    never below the minimum section for the kind of circuit;
 * 3. the smallest standard breaker with I_B ≤ I_n ≤ I_Z (the breaker protects
 *    the wire), growing the section if no breaker fits;
 * 4. the voltage drop along the circuit, growing the section until it stays
 *    within the 4 % the NBR 5410 allows for terminal circuits.
 *
 * Capacities: the NBR 5410 table for copper conductors with PVC insulation
 * (70 °C), reference method B1 (insulated conductors in a conduit, e.g.
 * embedded in masonry), ambient temperature 30 °C, without the correction
 * factors for grouping and temperature that a real project applies.
 */

/** Resistivity of copper at 20 °C (Ω·m), as in lesson 1.4 (../m01/extensao.ts). */
export const RHO_COPPER = 1.72e-8;

/** NBR 5410 limit of the voltage drop in terminal circuits (fraction of the nominal voltage). */
export const MAX_DROP = 0.04;

/** Standard ratings of miniature circuit breakers offered by the calculator (A). */
export const BREAKERS = [10, 16, 20, 25, 32, 40, 50, 63] as const;

/** Sections covered by the calculator (mm²) and their capacity with 2 and 3 loaded conductors (A). */
export const CAPACITY: readonly { section: number; two: number; three: number }[] = [
  { section: 1.5, two: 17.5, three: 15.5 },
  { section: 2.5, two: 24, three: 21 },
  { section: 4, two: 32, three: 28 },
  { section: 6, two: 41, three: 36 },
  { section: 10, two: 57, three: 50 },
  { section: 16, two: 76, three: 68 },
];

export type CircuitKind = 'iluminacao' | 'tomadas' | 'especifico';

/** Minimum copper section of the NBR 5410 for each kind of circuit (mm²). */
export const MIN_SECTION: Record<CircuitKind, number> = {
  iluminacao: 1.5,
  tomadas: 2.5,
  especifico: 2.5,
};

export interface CircuitInput {
  /** Power of the load (W); resistive loads, power factor 1. */
  watts: number;
  /**
   * Voltage of the circuit (V): between phase and neutral (or two phases) with
   * 2 loaded conductors; between phases of a balanced three-phase circuit with 3.
   */
  volts: number;
  /** Length of the circuit, one way, from the panel to the load (m). */
  meters: number;
  kind: CircuitKind;
  /** Loaded conductors: 2 (single-phase circuit) or 3 (three-phase circuit). */
  loaded: 2 | 3;
}

export interface DropResult {
  volts: number;
  /** Fraction of the nominal voltage (0,04 = 4 %). */
  fraction: number;
}

export interface CircuitResult {
  /** Design current I_B (A). */
  current: number;
  /** Smallest section whose capacity holds I_B (mm²), or null when none in the table does. */
  byCapacity: number | null;
  /** Minimum section for the kind of circuit (mm²). */
  minimum: number;
  /** Section after capacity, minimum and breaker coordination (mm²), or null. */
  byProtection: number | null;
  /** Final section, also within the voltage drop limit (mm²), or null when out of range. */
  section: number | null;
  /** Capacity I_Z of the final section (A). */
  capacity: number | null;
  /** Suggested breaker I_n (A), or null when the current is beyond the calculator's range. */
  breaker: number | null;
  /** Voltage drop with the final section (or the largest one, when out of range). */
  drop: DropResult;
  /** Voltage drop with the section chosen by capacity and protection alone. */
  dropBeforeGrowing: DropResult | null;
  /** True when the voltage drop forced a larger section. */
  grewForDrop: boolean;
  /** True when the circuit needs more than this calculator covers. */
  outOfRange: boolean;
}

/** Capacity I_Z of a section (A). */
export function capacityOf(section: number, loaded: 2 | 3): number {
  const row = CAPACITY.find((r) => r.section === section);
  if (!row) throw new Error(`seção fora da tabela: ${section} mm²`);
  return loaded === 2 ? row.two : row.three;
}

/** Design current: I = P / V, or P / (√3 · V) in a three-phase circuit (A). */
export function designCurrent(watts: number, volts: number, loaded: 2 | 3): number {
  return loaded === 2 ? watts / volts : watts / (Math.sqrt(3) * volts);
}

/**
 * Voltage drop along the circuit: the current goes and comes back, so two
 * conductors of `meters` each (ΔV = 2·ρ·L·I/S); in a balanced three-phase
 * circuit, the drop between phases is √3·ρ·L·I/S.
 */
export function voltageDrop(
  section: number,
  meters: number,
  current: number,
  volts: number,
  loaded: 2 | 3,
): DropResult {
  const factor = loaded === 2 ? 2 : Math.sqrt(3);
  const v = (factor * RHO_COPPER * meters * current) / (section * 1e-6);
  return { volts: v, fraction: v / volts };
}

/** Sizes the circuit (see the steps at the top of the file). */
export function sizeCircuit(input: CircuitInput): CircuitResult {
  const { watts, volts, meters, kind, loaded } = input;
  const current = designCurrent(watts, volts, loaded);
  const minimum = MIN_SECTION[kind];
  const sections = CAPACITY.map((r) => r.section);
  const largest = sections[sections.length - 1]!;

  const byCapacity = sections.find((s) => capacityOf(s, loaded) >= current) ?? null;
  const breaker = BREAKERS.find((b) => b >= current) ?? null;

  // Capacity, minimum section and coordination I_B ≤ I_n ≤ I_Z.
  const byProtection =
    breaker === null
      ? null
      : (sections.find((s) => s >= minimum && capacityOf(s, loaded) >= breaker) ?? null);

  if (byProtection === null || breaker === null) {
    return {
      current,
      byCapacity,
      minimum,
      byProtection: null,
      section: null,
      capacity: null,
      breaker: null,
      drop: voltageDrop(largest, meters, current, volts, loaded),
      dropBeforeGrowing: null,
      grewForDrop: false,
      outOfRange: true,
    };
  }

  const dropBeforeGrowing = voltageDrop(byProtection, meters, current, volts, loaded);
  const section =
    sections.find(
      (s) =>
        s >= byProtection &&
        voltageDrop(s, meters, current, volts, loaded).fraction <= MAX_DROP + 1e-12,
    ) ?? null;

  if (section === null) {
    return {
      current,
      byCapacity,
      minimum,
      byProtection,
      section: null,
      capacity: null,
      breaker,
      drop: voltageDrop(largest, meters, current, volts, loaded),
      dropBeforeGrowing,
      grewForDrop: true,
      outOfRange: true,
    };
  }

  return {
    current,
    byCapacity,
    minimum,
    byProtection,
    section,
    capacity: capacityOf(section, loaded),
    breaker,
    drop: voltageDrop(section, meters, current, volts, loaded),
    dropBeforeGrowing,
    grewForDrop: section > byProtection,
    outOfRange: false,
  };
}

/**
 * Checks an existing circuit: does the breaker protect the wire? True when
 * I_B ≤ I_n ≤ I_Z (the load does not trip it and the wire holds whatever
 * the breaker lets through).
 */
export function protects(current: number, breaker: number, section: number, loaded: 2 | 3) {
  const capacity = capacityOf(section, loaded);
  return {
    capacity,
    loadFits: current <= breaker,
    wireProtected: breaker <= capacity,
    wireOverloaded: current > capacity,
  };
}
