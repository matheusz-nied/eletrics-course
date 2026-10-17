import type { ControlDoc, ParamValue } from '../../engine/contract';
import { formatSI } from '../format';

export const isOn = (v: ParamValue | undefined) => v === true || v === 'true' || v === 1;

export function sliderRange(c: ControlDoc): { min: number; max: number } {
  const min = c.min ?? 0;
  const max = c.max ?? (c.unit === '%' ? 100 : 1);
  return { min, max: max > min ? max : min + 1 };
}

/** Value ↔ fraction 0…1 along the slider (logarithmic when `log`). */
export function toFraction(c: ControlDoc, value: number): number {
  const { min, max } = sliderRange(c);
  if (c.log && min > 0) return Math.log(value / min) / Math.log(max / min);
  return (value - min) / (max - min);
}

export function fromFraction(c: ControlDoc, f: number): number {
  const { min, max } = sliderRange(c);
  const t = Math.min(1, Math.max(0, f));
  let v = c.log && min > 0 ? min * (max / min) ** t : min + (max - min) * t;
  if (c.step && !c.log) v = Math.round(v / c.step) * c.step;
  return Math.min(max, Math.max(min, v));
}

/** One keyboard step: `step`, or 1 % of the range (log: 1 % of the decades). */
export function nudge(c: ControlDoc, value: number, steps: number): number {
  if (c.step && !c.log) return fromFraction(c, toFraction(c, value + steps * c.step));
  return fromFraction(c, toFraction(c, value) + steps * 0.01);
}

export function formatControlValue(c: ControlDoc, value: ParamValue | undefined): string {
  if (c.kind === 'select')
    return c.options?.find((o) => o.value === value)?.label ?? String(value ?? '');
  if (c.kind === 'toggle' || c.kind === 'momentary') return isOn(value) ? 'ligado' : 'desligado';
  const n = typeof value === 'number' ? value : Number(value);
  if (c.unit === '%') return formatSI(n, '%');
  if (!c.unit && sliderRange(c).max === 1 && sliderRange(c).min === 0)
    return formatSI(n * 100, '%');
  return formatSI(n, c.unit ?? '');
}

/** The control drawn on the symbol itself (the first that is not a list). */
export function primaryControl(controls: ControlDoc[]): ControlDoc | undefined {
  return controls.find((c) => c.kind !== 'select') ?? controls[0];
}
