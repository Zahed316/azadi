import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement matchMedia — stub it for hooks that read
// prefers-reduced-motion or similar media queries.
if (!window.matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  window.matchMedia = Object.assign(
    (_query: string) => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    { prototype: {} },
  ) as typeof window.matchMedia;
}

// jsdom doesn't implement IntersectionObserver — stub it for scroll-reveal hooks.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
}

afterEach(() => {
  cleanup();
});
