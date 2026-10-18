import { useEffect, useState } from 'react';

/** `prefers-reduced-motion: reduce`: no automatic rotation, instant transitions. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Exponential approach to a target, frame-rate independent. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/**
 * Time step of a transition for one frame. While it runs it follows real time
 * (up to a quarter second), so a slow device does not stretch it over many
 * frames. Its first frame takes 1/60 s, because with on-demand rendering that
 * frame's delta also counts the idle time before it. `running` is whether the
 * previous frame still moved the transition.
 */
export function transitionStep(running: boolean, dt: number): number {
  return running ? Math.min(dt, 0.25) : 1 / 60;
}

/** Smooth ease for 0..1 transitions. */
export function easeInOut(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}
