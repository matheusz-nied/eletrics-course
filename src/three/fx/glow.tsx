/**
 * Light-emitting surfaces (LED dies, filaments, neon, displays).
 *
 * Convention: a surface that *emits light* uses `emissiveIntensity` around
 * `GLOW` × brightness. Only values that high pass the bloom threshold of the
 * stage, so reflections never bloom and lit LEDs always do. Surfaces that
 * only look tinted by light (an LED's epoxy lens) stay below ~5.
 *
 * Without bloom (lowest quality), `<GlowSprite>` draws a soft additive halo.
 */
import { useMemo } from 'react';
import { AdditiveBlending, CanvasTexture, Color, type ColorRepresentation } from 'three';
import { QUALITY, useQuality } from '../core/quality';
import type { Vec3 } from '../types';

export const GLOW = 120;

let haloTexture: CanvasTexture | null = null;

function getHaloTexture(): CanvasTexture {
  if (haloTexture) return haloTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  haloTexture = new CanvasTexture(canvas);
  return haloTexture;
}

export interface GlowSpriteProps {
  color: ColorRepresentation;
  /** 0..1 */
  intensity: number;
  /** Diameter of the halo (mm). */
  size: number;
  position?: Vec3;
  /** Draw even when bloom is on (e.g. very dim glows bloom does not catch). */
  always?: boolean;
}

/** Soft halo facing the camera, used where bloom is off. */
export function GlowSprite({ color, intensity, size, position, always = false }: GlowSpriteProps) {
  const bloom = useQuality((s) => QUALITY[s.level].bloom);
  const tint = useMemo(() => new Color(color), [color]);
  if ((bloom && !always) || intensity <= 0.01) return null;
  return (
    <sprite position={position} scale={[size, size, size]}>
      <spriteMaterial
        map={getHaloTexture()}
        color={tint}
        opacity={Math.min(intensity, 1)}
        blending={AdditiveBlending}
        depthWrite={false}
        transparent
        toneMapped={false}
      />
    </sprite>
  );
}

/** Emissive colour and intensity for a surface glowing at `brightness` (0..1+). */
export function emission(color: ColorRepresentation, brightness: number, scale = GLOW) {
  const level = Math.max(brightness, 0);
  return {
    emissive: level > 0 ? new Color(color) : new Color('#000000'),
    emissiveIntensity: level * scale,
  };
}
