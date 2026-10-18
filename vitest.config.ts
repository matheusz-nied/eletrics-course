import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    environment: 'node',
    // The persistent module cache keeps the transformed output of files that
    // use `import.meta.glob`, so a file added to an auto-registered folder
    // (devices, symbols, parts, scenes…) would not show up in local runs.
    fsModuleCache: false,
  },
});
