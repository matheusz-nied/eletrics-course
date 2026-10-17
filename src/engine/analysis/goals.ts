import type { GoalDoc, SimFrame } from '../contract';

/** Whether a goal holds in a frame ("acenda o LED com 10 mA"). Unknown readouts never hold. */
export function checkGoal(goal: GoalDoc, frame: SimFrame): boolean {
  const actual = frame.readouts[goal.check.readout];
  const { op, value } = goal.check;
  if (actual === undefined) return false;
  if (op === '==') {
    if (typeof actual === 'number' && typeof value === 'number') {
      return Math.abs(actual - value) <= 1e-9 + 1e-6 * Math.abs(value);
    }
    return actual === value;
  }
  if (typeof actual !== 'number') return false;
  if (op === 'between') {
    if (!Array.isArray(value)) return false;
    const [lo, hi] = value[0] <= value[1] ? value : [value[1], value[0]];
    return actual >= lo && actual <= hi;
  }
  if (typeof value !== 'number') return false;
  switch (op) {
    case '<':
      return actual < value;
    case '<=':
      return actual <= value;
    case '>':
      return actual > value;
    case '>=':
      return actual >= value;
  }
}
