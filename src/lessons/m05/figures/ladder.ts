/*
 * Path builders for the vertical ladder diagrams of lesson 05.6. Every
 * contact runs from a top terminal (y1) down to a bottom terminal (y2) on
 * the line x; the moving blade hinges at the bottom.
 */

/** Normally open contact: blade tilted to the left, away from the top lead. */
export function contactNo(x: number, y1: number, y2: number): string {
  return `M${x} ${y1} V${y1 + 8} M${x} ${y2} V${y2 - 8} L${x - 12} ${y1 + 11}`;
}

/** Normally closed contact: blade resting on a stub to the right of the top lead. */
export function contactNf(x: number, y1: number, y2: number): string {
  return `M${x} ${y1} V${y1 + 8} H${x + 9} M${x} ${y2} V${y2 - 8} L${x + 11} ${y1 + 6}`;
}

/** Push-button actuator: dashed rod from the blade to a T head on the left. */
export function pushRod(x: number, y1: number, y2: number, closed: boolean): string {
  const my = (y1 + y2) / 2 + 1;
  const from = closed ? x + 5 : x - 6;
  return `M${from} ${my} H${x - 24}`;
}

export function pushHead(x: number, y1: number, y2: number): string {
  const my = (y1 + y2) / 2 + 1;
  return `M${x - 24} ${my - 6} V${my + 6}`;
}

/** Thermal actuator of the overload relay contact: rod plus a small square wave. */
export function thermalRod(x: number, y1: number, y2: number): string {
  const my = (y1 + y2) / 2 + 1;
  return `M${x + 5} ${my} H${x - 18}`;
}

export function thermalHead(x: number, y1: number, y2: number): string {
  const my = (y1 + y2) / 2 + 1;
  return `M${x - 18} ${my} V${my - 5} H${x - 24} V${my + 5} H${x - 30} V${my}`;
}

/** Heater of the overload relay in a power line, between y1 and y2. */
export function heater(x: number, y1: number, y2: number, w = 6): string {
  const a = y1 + 6;
  const b = (y1 + y2) / 2;
  const c = y2 - 6;
  return `M${x} ${y1} V${a} H${x - w} V${b} H${x + w} V${c} H${x} V${y2}`;
}
