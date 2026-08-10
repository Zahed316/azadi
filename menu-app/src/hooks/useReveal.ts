import { useEffect, useRef } from 'react';

/**
 * Attaches IntersectionObserver to the returned ref element.
 * Children with `.reveal` class get `.revealed` when visible.
 * Respects `prefers-reduced-motion`.
 */
export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip animation entirely for reduced-motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el.querySelectorAll('.reveal').forEach((r) => r.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );

    el.querySelectorAll('.reveal').forEach((r) => observer.observe(r));

    return () => observer.disconnect();
  }, []);

  return ref;
}
