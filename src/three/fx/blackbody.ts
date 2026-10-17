/**
 * Colour and brightness of a hot body (filaments, overloaded resistors,
 * soldering iron tips). Pure functions, unit-tested.
 */
import { Color } from 'three';

/**
 * Approximate sRGB colour of a black body at `kelvin` (1000–40000 K),
 * from Tanner Helland's fit of the CIE 1964 data. Below ~700 K nothing glows.
 */
export function blackbodyRGB(kelvin: number): [number, number, number] {
  const t = Math.min(Math.max(kelvin, 1000), 40000) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const clamp = (v: number) => Math.min(Math.max(v, 0), 255) / 255;
  return [clamp(r), clamp(g), clamp(b)];
}

/** Black-body colour as a three Color (sRGB input, converted to linear). */
export function blackbodyColor(kelvin: number, target = new Color()): Color {
  const [r, g, b] = blackbodyRGB(kelvin);
  return target.setRGB(r, g, b, 'srgb');
}

/**
 * Relative glow of a body at `kelvin` for rendering: 0 below 750 K (no
 * visible glow), a dull red from ~800 K, 1 at 2700 K (incandescent filament)
 * and the T⁴ growth above. The real luminance spans many orders of
 * magnitude; this curve is perceptual, so a dull red glow is still visible
 * next to a lit scene.
 */
export function glowIntensity(kelvin: number): number {
  if (kelvin <= 750) return 0;
  if (kelvin <= 2700) return Math.pow((kelvin - 750) / 1950, 1.5);
  return Math.min(Math.pow(kelvin / 2700, 4), 20);
}

export const celsiusToKelvin = (c: number) => c + 273.15;
