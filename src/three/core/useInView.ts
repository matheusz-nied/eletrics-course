import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether an element is near the viewport. The 3D canvas is created when the
 * view approaches the screen and destroyed some time after it leaves, so a
 * long lesson never holds more WebGL contexts than the browser allows.
 */
export function useInView(
  ref: RefObject<Element | null>,
  { margin = '200px', releaseDelay = 4000 }: { margin?: string; releaseDelay?: number } = {},
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry?.isIntersecting) setInView(true);
        else timer = setTimeout(() => setInView(false), releaseDelay);
      },
      { rootMargin: margin },
    );
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref, margin, releaseDelay]);

  return inView;
}
