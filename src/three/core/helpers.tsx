/** Small pieces of the viewer that live inside the Canvas. */
import { useFrame, useThree } from '@react-three/fiber';
import { Component, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Spherical, Vector3 } from 'three';
import type { OrbitControlsLike } from './controls';
import { useQuality, type QualityLevel } from './quality';

/** Calls `onReady` after the first frame rendered with everything loaded. */
export function ReadySignal({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [invalidate]);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    // One more frame so the poster fades over a finished image.
    requestAnimationFrame(() => onReady());
  });
  return null;
}

/**
 * Steps the quality down when continuous rendering stays below 30 fps, and
 * back up (to `ceiling`) when it stays near 60 fps. Frames rendered on demand
 * (far apart) are not counted.
 */
export function FrameRateMonitor({ ceiling }: { ceiling: QualityLevel }) {
  const samples = useRef<number[]>([]);
  const last = useRef(0);
  const cooldown = useRef(0);
  const decline = useQuality((s) => s.decline);
  const incline = useQuality((s) => s.incline);

  useFrame(() => {
    const now = performance.now();
    const delta = now - last.current;
    last.current = now;
    if (delta <= 0 || delta > 250) return;
    if (now < cooldown.current) return;
    const list = samples.current;
    list.push(delta);
    if (list.length < 45) return;
    const average = list.reduce((a, b) => a + b, 0) / list.length;
    list.length = 0;
    const fps = 1000 / average;
    if (fps < 30) {
      decline();
      cooldown.current = now + 3000;
    } else if (fps > 57) {
      incline(ceiling);
      cooldown.current = now + 6000;
    }
  });
  return null;
}

/** Arrow keys orbit, + and − zoom, 0 re-frames: keyboard access to the 3D view. */
export function KeyboardOrbit({
  element,
  onReset,
}: {
  element: RefObject<HTMLElement | null>;
  onReset: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsLike | null;
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const spherical = new Spherical();
    const offset = new Vector3();
    const onKey = (event: KeyboardEvent) => {
      const target = controls?.target ?? new Vector3();
      offset.copy(camera.position).sub(target);
      spherical.setFromVector3(offset);
      const step = event.shiftKey ? Math.PI / 4 : Math.PI / 12;
      switch (event.key) {
        case 'ArrowLeft':
          spherical.theta -= step;
          break;
        case 'ArrowRight':
          spherical.theta += step;
          break;
        case 'ArrowUp':
          spherical.phi = Math.max(0.05, spherical.phi - step);
          break;
        case 'ArrowDown':
          spherical.phi = Math.min(Math.PI - 0.05, spherical.phi + step);
          break;
        case '+':
        case '=':
          spherical.radius = Math.max(controls?.minDistance ?? 0, spherical.radius / 1.2);
          break;
        case '-':
        case '_':
          spherical.radius = Math.min(controls?.maxDistance ?? Infinity, spherical.radius * 1.2);
          break;
        case '0':
          onReset();
          event.preventDefault();
          return;
        default:
          return;
      }
      event.preventDefault();
      // Tells the stage the student took over the camera (stops auto-framing).
      (
        controls as unknown as { dispatchEvent?: (e: { type: 'start' }) => void } | null
      )?.dispatchEvent?.({ type: 'start' });
      offset.setFromSpherical(spherical);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      controls?.update();
      invalidate();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [element, camera, controls, invalidate, onReset]);

  return null;
}

/** Catches errors of the 3D tree (part code, WebGL) and shows the fallback instead. */
export class ViewerErrorBoundary extends Component<
  { fallback: ReactNode; onError?: (error: Error) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error) {
    console.warn('[3D]', error);
    this.props.onError?.(error);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
