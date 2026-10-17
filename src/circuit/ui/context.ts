import { createContext, useContext, useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { SimController, SimState } from '../runtime/controller';

export const SimContext = createContext<SimController | null>(null);

export function useSim(): SimController {
  const sim = useContext(SimContext);
  if (!sim) throw new Error('useSim fora de <SimContext.Provider>');
  return sim;
}

export function useSimState<T>(selector: (s: SimState) => T): T {
  return useStore(useSim().store, selector);
}

/** True when the site is in dark mode (follows data-theme on <html>). */
export function useDarkTheme(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.dataset.theme === 'dark');
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return reduced;
}
