import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Browser-backed integration tests share ports and a Chromium install; keep files serial.
    fileParallelism: false,
    env: {
      // Guarantee the default test suite can never reach a paid provider.
      BUYER_ARENA_OFFLINE: '1',
    },
  },
});
