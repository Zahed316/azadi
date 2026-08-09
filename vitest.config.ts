import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The router harness dynamically imports the full router module on the
    // first callRouter() per test file; cold-import on a slow device can
    // exceed vitest's default 5000ms per-test timeout. Give it headroom.
    testTimeout: 30000,
  },
});
