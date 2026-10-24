/**
 * True while an element is narrower than `limite` pixels, so a figure can
 * switch to a layout made for phones instead of shrinking its text.
 */
import { useEffect, useState } from 'react';

export function useEstreito(el: Element | null, limite: number): boolean {
  const [estreito, setEstreito] = useState(false);
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setEstreito(e.contentRect.width < limite);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, limite]);
  return estreito;
}

/** Runs `onVisible(true/false)` as the element enters and leaves the screen or the tab hides. */
export function useVisivel(el: Element | null, onVisible: (visible: boolean) => void): void {
  useEffect(() => {
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      onVisible(true);
      return () => onVisible(false);
    }
    let onScreen = false;
    const apply = () => onVisible(onScreen && !document.hidden);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) onScreen = e.isIntersecting;
      apply();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', apply);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', apply);
      onVisible(false);
    };
  }, [el, onVisible]);
}
