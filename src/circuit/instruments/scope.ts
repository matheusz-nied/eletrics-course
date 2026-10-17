/**
 * Signal maths of the oscilloscope: trigger search, measurements and the
 * automatic setup ("Autoajuste"), on the sample history.
 */
import type { CircuitDoc } from '../../engine/contract';
import type { History } from '../runtime/history';
import { sequence125, stepAtLeast } from './chart';

export type Slope = 'rise' | 'fall';

/** Time base steps (s/div) and vertical steps (unit/div). */
export const TIME_DIVS = sequence125(1e-6, 5);
export const AMPLITUDE_DIVS = sequence125(1e-6, 500);

/** The screen: 10 horizontal and 8 vertical divisions. */
export const H_DIVS = 10;
export const V_DIVS = 8;

/**
 * Time of the latest crossing of `level` with the given slope between tMin
 * and tMax (linear interpolation between samples), or null.
 */
export function findTrigger(
  h: History,
  key: string,
  level: number,
  slope: Slope,
  tMin: number,
  tMax: number,
): number | null {
  const lo = Math.max(1, h.lowerBound(tMin));
  let i = Math.min(h.length - 1, h.lowerBound(tMax));
  for (; i >= lo; i--) {
    const v0 = h.valueAt(key, i - 1);
    const v1 = h.valueAt(key, i);
    const crosses = slope === 'rise' ? v0 < level && v1 >= level : v0 > level && v1 <= level;
    if (!crosses) continue;
    const t0 = h.timeAt(i - 1);
    const t1 = h.timeAt(i);
    const f = v1 === v0 ? 1 : (level - v0) / (v1 - v0);
    const t = t0 + (t1 - t0) * f;
    if (t <= tMax) return t;
  }
  return null;
}

export interface Measurement {
  min: number;
  max: number;
  /** Peak to peak. */
  pp: number;
  mean: number;
  /** True RMS (includes the DC part), like a scope's "Vrms". */
  rms: number;
  /** Hz, NaN when the signal does not repeat on screen. */
  freq: number;
}

/** Measurements over samples (time-weighted, so uneven steps are fine). */
export function measure(t: number[], v: number[]): Measurement {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let area = 0;
  let area2 = 0;
  let span = 0;
  let count = 0;
  for (let i = 0; i < v.length; i++) {
    const x = v[i]!;
    if (!Number.isFinite(x)) continue;
    count++;
    if (x < min) min = x;
    if (x > max) max = x;
    if (i > 0 && Number.isFinite(v[i - 1]!)) {
      const dt = t[i]! - t[i - 1]!;
      const a = v[i - 1]!;
      area += ((a + x) / 2) * dt;
      area2 += ((a * a + x * x) / 2) * dt;
      span += dt;
    }
  }
  if (count === 0) {
    const nan = Number.NaN;
    return { min: nan, max: nan, pp: nan, mean: nan, rms: nan, freq: nan };
  }
  const mean = span > 0 ? area / span : (min + max) / 2;
  const rms = span > 0 ? Math.sqrt(Math.max(0, area2 / span)) : Math.abs(mean);
  const pp = max - min;
  return { min, max, pp, mean, rms, freq: frequency(t, v, mean, pp) };
}

/** Frequency from rising crossings of the mean, with 10 % hysteresis. */
function frequency(t: number[], v: number[], mean: number, pp: number): number {
  if (!(pp > 1e-12)) return Number.NaN;
  const hi = mean + pp * 0.1;
  const lo = mean - pp * 0.1;
  let armed = false;
  let first = Number.NaN;
  let last = Number.NaN;
  let n = 0;
  for (let i = 1; i < v.length; i++) {
    const x = v[i]!;
    if (x < lo) armed = true;
    else if (armed && x >= hi) {
      armed = false;
      // time where the signal crossed the mean, between the samples around it
      let j = i;
      while (j > 0 && v[j - 1]! >= mean) j--;
      const a = v[j - 1] ?? x;
      const b = v[j]!;
      const tc =
        j > 0 && b !== a ? t[j - 1]! + ((mean - a) / (b - a)) * (t[j]! - t[j - 1]!) : t[j]!;
      if (n === 0) first = tc;
      last = tc;
      n++;
    }
  }
  return n >= 2 && last > first ? (n - 1) / (last - first) : Number.NaN;
}

export interface ChannelSetup {
  /** Index in AMPLITUDE_DIVS. */
  div: number;
  /** Vertical position of 0, in divisions from the centre. */
  offset: number;
}

/** Vertical setup that fits a signal in about six of the eight divisions. */
export function autoVertical(m: Measurement): ChannelSetup {
  if (!Number.isFinite(m.pp)) return { div: stepAtLeast(AMPLITUDE_DIVS, 1), offset: 0 };
  if (m.pp < Math.max(Math.abs(m.mean) * 1e-3, 1e-9)) {
    // Constant: keep 0 on the centre line and the level within three divisions.
    return { div: stepAtLeast(AMPLITUDE_DIVS, Math.max(Math.abs(m.mean) / 3, 1e-6)), offset: 0 };
  }
  const ac = m.pp / 2 > Math.abs(m.mean) * 0.2;
  if (ac && Math.abs(m.mean) < m.pp) {
    // Mostly alternating: centre on 0 so the zero line stays meaningful.
    const peak = Math.max(Math.abs(m.max), Math.abs(m.min));
    return { div: stepAtLeast(AMPLITUDE_DIVS, peak / 3.5), offset: 0 };
  }
  // Riding on a DC level: the smallest scale that keeps the whole signal on
  // screen with the position control (±3 divisions for the centre).
  const centre = (m.max + m.min) / 2;
  const div = stepAtLeast(AMPLITUDE_DIVS, Math.max(m.pp / 6, Math.abs(centre) / 3));
  const size = AMPLITUDE_DIVS[div]!;
  const offset = Math.max(-4, Math.min(4, Math.round((-centre / size) * 2) / 2));
  return { div, offset };
}

/** Time base showing about three periods, or the whole run when nothing repeats. */
export function autoTime(freq: number, extent: number): number {
  if (Number.isFinite(freq) && freq > 0) return stepAtLeast(TIME_DIVS, 3 / freq / H_DIVS);
  return stepAtLeast(TIME_DIVS, Math.max(extent, 1e-5) / H_DIVS);
}

/** Frequency of the first AC source of a circuit, if any. */
export function sourceFrequency(doc: CircuitDoc): number {
  if (doc.analysis.kind === 'quasi-static') return doc.analysis.frequency;
  for (const el of doc.elements) {
    if (el.type === 'ac-voltage' || el.type === 'mains') {
      const f = el.params?.frequency;
      return typeof f === 'number' ? f : 60;
    }
  }
  return Number.NaN;
}

/** Time base before the first automatic setup, from what the circuit declares. */
export function defaultTimeDiv(doc: CircuitDoc): number {
  const a = doc.analysis;
  const f = sourceFrequency(doc);
  if (Number.isFinite(f)) return autoTime(f, 0);
  if (a.kind === 'transient') return autoTime(Number.NaN, a.tStop ?? a.dt * 1000);
  return autoTime(Number.NaN, 0.01);
}
