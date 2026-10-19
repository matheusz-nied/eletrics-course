/**
 * Lesson 8.5: the logic behind the stepper and servo widgets. A two-phase
 * stepper driven in wave (one phase at a time), full step (two phases) or
 * half step; and a hobby servo commanded by the width of a pulse repeated
 * every 20 ms. Pure, unit-tested in passo-servo.test.ts.
 */

export type StepMode = 'onda' | 'completo' | 'meio';

/** Current in coil A and coil B (−1, 0 or +1) at each state of the sequence. */
const SEQUENCES: Record<StepMode, [number, number][]> = {
  onda: [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ],
  completo: [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ],
  meio: [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ],
};

export function sequence(mode: StepMode): readonly [number, number][] {
  return SEQUENCES[mode];
}

const mod = (k: number, n: number) => ((k % n) + n) % n;

/** Coil currents [A, B] after `steps` steps (negative is backwards). */
export function coilState(mode: StepMode, steps: number): [number, number] {
  const seq = SEQUENCES[mode];
  return seq[mod(steps, seq.length)]!;
}

/** Index of the current row of the sequence table. */
export function sequenceIndex(mode: StepMode, steps: number): number {
  return mod(steps, SEQUENCES[mode].length);
}

/**
 * Direction of the stator field (degrees, A at 0°, B at 90°) in the simple
 * drawing, where the rotor is a two-pole magnet that lines up with it.
 */
export function fieldAngle(mode: StepMode, steps: number): number {
  const [a, b] = coilState(mode, steps);
  const d = (Math.atan2(b, a) * 180) / Math.PI;
  return mod(d, 360);
}

/** Holding torque relative to one coil on: two coils on give √2. */
export function relativeTorque(mode: StepMode, steps: number): number {
  const [a, b] = coilState(mode, steps);
  return Math.hypot(a, b);
}

/** Full steps per turn of the common hybrid stepper (1,8° per step). */
export const FULL_STEPS = 200;

/** Shaft angle of a real 200-step motor after `steps` steps (degrees). */
export function shaftAngle(mode: StepMode, steps: number): number {
  const per = mode === 'meio' ? 360 / (2 * FULL_STEPS) : 360 / FULL_STEPS;
  return steps * per;
}

/** Hobby servo: 1 ms is 0°, 2 ms is 180°, one pulse every 20 ms (50 Hz). */
export const SERVO = { minPulse: 1, maxPulse: 2, period: 20, range: 180, speed: 600 } as const;

/** Angle the servo goes to for a pulse of `ms` milliseconds (clamped). */
export function servoAngle(ms: number): number {
  const f = (ms - SERVO.minPulse) / (SERVO.maxPulse - SERVO.minPulse);
  return Math.min(1, Math.max(0, f)) * SERVO.range;
}

/** Duty cycle of the servo signal (0 to 1). */
export function servoDuty(ms: number): number {
  return ms / SERVO.period;
}

/**
 * The horn moves toward the target at the servo's top speed (°/s; a 9 g
 * servo does about 60° in 0,1 s), and stops there.
 */
export function servoMove(current: number, target: number, dt: number): number {
  const max = SERVO.speed * dt;
  const d = target - current;
  return Math.abs(d) <= max ? target : current + Math.sign(d) * max;
}
