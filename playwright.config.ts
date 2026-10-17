import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// The tests run against the production build served by `astro preview`,
// under the same base path as GitHub Pages.
if (!existsSync('dist/index.html')) {
  throw new Error('dist/ not found: run `pnpm build` before `pnpm test:e2e`.');
}

const PORT = 4329;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/eletrics-course/`,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm exec astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/eletrics-course/`,
    reuseExistingServer: !process.env.CI,
  },
});
