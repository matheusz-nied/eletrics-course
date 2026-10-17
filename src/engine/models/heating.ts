import { AMBIENT_C } from './constants';
import { Average, relax } from './filters';

/** Temperature rise of a resistor body at its rated power (K). Typical film resistor. */
const RISE_AT_RATING = 80;
/** Rise at which the body chars and the film opens: about 5× the rated power, sustained. */
const RISE_BURN = 5 * RISE_AT_RATING;

/**
 * Body temperature of a resistive part as a first-order thermal model:
 * the steady rise is proportional to power (80 K at the rating) and the time
 * constant grows with size (about 8 s for a 1/4 W resistor). A typical model
 * for teaching, not a datasheet.
 */
export class ResistiveHeating {
  private rise = 0;
  private warned = false;
  private readonly avg = new Average(0.01);
  burned = false;

  /** `tau` overrides the time constant that follows from the rating (s). */
  constructor(
    private readonly rating: () => number,
    private readonly tau?: number,
  ) {}

  /** Advances by dt with the dissipated power; reports a new warning or burn. */
  step(power: number, dt: number): 'ok' | 'hot' | 'burned' {
    if (dt <= 0) return 'ok';
    const watts = this.rating();
    const tau = this.tau ?? 8 * Math.sqrt(watts / 0.25);
    if (this.burned) {
      this.rise = relax(this.rise, 0, dt, tau);
      return 'ok';
    }
    this.avg.update(power, dt);
    this.rise = relax(this.rise, (Math.abs(power) / watts) * RISE_AT_RATING, dt, tau);
    if (this.rise >= RISE_BURN) {
      this.burned = true;
      return 'burned';
    }
    if (!this.warned && this.rise > 1.05 * RISE_AT_RATING) {
      this.warned = true;
      return 'hot';
    }
    if (this.warned && this.rise < 0.8 * RISE_AT_RATING) this.warned = false;
    return 'ok';
  }

  /** Body temperature (°C). */
  get temperature(): number {
    return AMBIENT_C + this.rise;
  }

  /** Average dissipated power over the last few milliseconds (W). */
  get power(): number {
    return Math.abs(this.avg.value);
  }

  reset(): void {
    this.rise = 0;
    this.warned = false;
    this.burned = false;
    this.avg.reset();
  }
}

/** Highest junction temperature in normal use (°C): above it the part is overloaded. */
const TJ_MAX = 150;
/** Junction temperature at which the die fails (°C). */
const TJ_BURN = 300;

/**
 * Junction temperature of a semiconductor as two thermal time constants in
 * series: the die (fast, 30 % of the thermal resistance) and the package
 * (slow). The thermal resistance is set so that the rated power gives 150 °C,
 * so the part warns above its rating and fails at about 2,2× sustained, or
 * sooner under short heavy pulses. Typical, not a datasheet.
 */
export class JunctionHeating {
  private die = 0;
  private body = 0;
  private warned = false;
  private readonly avg = new Average(0.01);
  burned = false;

  constructor(
    private readonly rating: () => number,
    private readonly tauDie = 0.05,
    private readonly tauBody = 5,
  ) {}

  step(power: number, dt: number): 'ok' | 'hot' | 'burned' {
    if (dt <= 0) return 'ok';
    const rth = (TJ_MAX - AMBIENT_C) / this.rating();
    const p = this.burned ? 0 : Math.abs(power);
    this.avg.update(p, dt);
    this.die = relax(this.die, 0.3 * rth * p, dt, this.tauDie);
    this.body = relax(this.body, 0.7 * rth * p, dt, this.tauBody);
    if (this.burned) return 'ok';
    const tj = this.temperature;
    if (tj >= TJ_BURN) {
      this.burned = true;
      return 'burned';
    }
    if (!this.warned && tj > TJ_MAX + 5) {
      this.warned = true;
      return 'hot';
    }
    if (this.warned && tj < TJ_MAX - 20) this.warned = false;
    return 'ok';
  }

  /** Junction temperature (°C). */
  get temperature(): number {
    return AMBIENT_C + this.die + this.body;
  }

  /** Average dissipated power over the last few milliseconds (W). */
  get power(): number {
    return this.avg.value;
  }

  reset(): void {
    this.die = 0;
    this.body = 0;
    this.warned = false;
    this.burned = false;
    this.avg.reset();
  }
}
