/**
 * Textures drawn in a <canvas>: printed labels (capacitor sleeves, IC
 * markings, silkscreen, instrument displays) and procedural detail maps.
 * Nothing is downloaded; text uses the site fonts (Inter, JetBrains Mono).
 */
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';

export const FONT_SANS = '"Inter Variable", "Inter", system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';

export type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

export interface CanvasTextureOptions {
  width?: number;
  height?: number;
  /** Colour data (sRGB) or data maps (roughness, bump: linear). */
  color?: boolean;
  repeat?: boolean;
  /** Fonts to wait for before drawing, as CSS font shorthands. */
  fonts?: string[];
}

/**
 * A texture painted by `draw`. `key` must change whenever the drawing should
 * change (it replaces a dependency list).
 */
export function useCanvasTexture(
  draw: Draw,
  key: string,
  {
    width = 512,
    height = 256,
    color = true,
    repeat = false,
    fonts = [],
  }: CanvasTextureOptions = {},
): CanvasTexture {
  const invalidate = useThree((s) => s.invalidate);
  const drawRef = useRef(draw);
  useLayoutEffect(() => {
    drawRef.current = draw;
  });

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const map = new CanvasTexture(canvas);
    map.colorSpace = color ? SRGBColorSpace : LinearSRGBColorSpace;
    map.wrapS = map.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
    map.anisotropy = 8;
    return map;
  }, [width, height, color, repeat]);

  const fontKey = fonts.join('|');
  useLayoutEffect(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const paint = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawRef.current(ctx, canvas.width, canvas.height);
      texture.needsUpdate = true;
      invalidate();
    };
    paint();
    if (!fontKey || typeof document === 'undefined' || !document.fonts) return;
    let alive = true;
    Promise.all(fontKey.split('|').map((f) => document.fonts.load(f)))
      .then(() => alive && paint())
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [texture, key, fontKey, invalidate]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Text that fits a box: shrinks the font until the text fits `maxWidth`. */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  { weight = 600, family = FONT_SANS, align = 'center' as CanvasTextAlign } = {},
) {
  let s = size;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 1;
  } while (ctx.measureText(text).width > maxWidth && s > 6);
  ctx.fillText(text, x, y);
}

let noiseCache: Texture | null = null;

/**
 * Shared tileable value noise (linear), for roughness and bump variation on
 * plastics and metals, so no surface looks perfectly uniform.
 */
export function getNoiseTexture(): Texture {
  if (noiseCache) return noiseCache;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  // Deterministic pseudo-random so every page looks the same.
  let seed = 1234567;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const grid = 16;
  const cells = Array.from({ length: grid * grid }, random);
  const at = (x: number, y: number) => cells[((y + grid) % grid) * grid + ((x + grid) % grid)]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * grid;
      const gy = (y / size) * grid;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const tx = gx - x0;
      const ty = gy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
      const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
      const value = (top * (1 - sy) + bottom * sy) * 0.6 + random() * 0.4;
      const v = Math.round(150 + value * 105);
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const map = new CanvasTexture(canvas);
  map.colorSpace = LinearSRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  noiseCache = map;
  return map;
}
