/**
 * Lesson 8.6: what a gear reducer does to speed, torque and power, and what
 * a pinion on a rack turns that into. The gate preset uses the same drive
 * train as the gate mechanics of module 16 (gate-mechanics: 1:22, 45 %,
 * a 3 cm pinion, on the 1/3 CV gate motor). Pure, tested in reducao.test.ts.
 */

/** 1 CV (cavalo-vapor, metric horsepower) and 1 HP (imperial horsepower), in watts. */
export const CV = 735.5;
export const HP = 745.7;

export const rpmToRadS = (rpm: number) => (2 * Math.PI * rpm) / 60;

export interface Drive {
  /** Mechanical power at the motor shaft (W). */
  power: number;
  /** Motor speed (rpm). */
  rpm: number;
  /** Reduction: turns of the motor per turn of the output. */
  ratio: number;
  /** Efficiency of the reducer, 0 to 1. */
  efficiency: number;
  /** Radius of the pinion on the output (m); 0 for none. */
  pinion: number;
}

export interface DriveResult {
  motorTorque: number;
  outRpm: number;
  outTorque: number;
  outPower: number;
  /** Heat in the reducer (W). */
  loss: number;
  /** Speed of the rack (m/s) and the force on it (N), with a pinion. */
  speed?: number;
  force?: number;
}

export function solveDrive(d: Drive): DriveResult {
  const motorTorque = d.power / rpmToRadS(d.rpm);
  const outRpm = d.rpm / d.ratio;
  const outTorque = motorTorque * d.ratio * d.efficiency;
  const outPower = d.power * d.efficiency;
  const result: DriveResult = {
    motorTorque,
    outRpm,
    outTorque,
    outPower,
    loss: d.power - outPower,
  };
  if (d.pinion > 0) {
    result.speed = rpmToRadS(outRpm) * d.pinion;
    result.force = outTorque / d.pinion;
  }
  return result;
}

/** Ratio of a worm gear: teeth of the wheel over the starts of the worm. */
export const wormRatio = (teeth: number, starts: number) => teeth / starts;

/**
 * Rule of thumb for worm gears: below about 50 % efficiency the wheel
 * cannot drive the worm back, and the reducer holds the load by itself.
 */
export const selfLocking = (efficiency: number) => efficiency < 0.5;

export interface Preset {
  id: string;
  label: string;
  drive: Drive;
}

export const PRESETS: Preset[] = [
  {
    id: 'portao',
    label: 'Portão deslizante (1/3 CV, 1:22)',
    drive: { power: 250, rpm: 1730, ratio: 22, efficiency: 0.45, pinion: 0.03 },
  },
  {
    id: 'industrial',
    label: 'Redutor industrial (1 CV, 1:30)',
    drive: { power: CV, rpm: 1720, ratio: 30, efficiency: 0.7, pinion: 0 },
  },
  {
    id: 'vidro',
    label: 'Vidro elétrico (motor CC, 1:70)',
    drive: { power: 55, rpm: 3500, ratio: 70, efficiency: 0.4, pinion: 0.012 },
  },
];
