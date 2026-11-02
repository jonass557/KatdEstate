import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
    // Windows + large monorepos can make module collection slow; keep generous
    // budgets so a cold first run does not fail spuriously.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 60_000,
  },
});
