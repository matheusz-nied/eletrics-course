import type { Vector3 } from 'three';

/** What the stage needs from the orbit controls (drei's OrbitControls). */
export interface OrbitControlsLike {
  target: Vector3;
  minDistance: number;
  maxDistance: number;
  update(): void;
  addEventListener(type: 'start' | 'end' | 'change', listener: () => void): void;
  removeEventListener(type: 'start' | 'end' | 'change', listener: () => void): void;
}
