/** Numeric constants shared by the solver and the devices. */

/** Conductance from every node to ground, so floating nodes stay solvable (S). */
export const GMIN = 1e-12;
/** Series resistance of ideal voltage sources and inductors, so a short is finite (Ω). */
export const R_SERIES_MIN = 1e-6;
/** Closed contact (switches, buttons) (Ω). */
export const R_CLOSED = 1e-4;
/** Open contact, burned resistor, blown fuse (Ω). */
export const R_OPEN = 1e9;
/** Ambient temperature (°C). */
export const AMBIENT_C = 25;
/** 0 °C in kelvin. */
export const KELVIN = 273.15;
