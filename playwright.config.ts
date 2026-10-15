import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4391);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}/`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  // Tests run against the production build (same artefact as GitHub Pages) unless E2E_BASE_URL points elsewhere.
  webServer: process.env.E2E_BASE_URL ? undefined : { command: `npx vite preview --port ${PORT} --strictPort`, url: BASE_URL, reuseExistingServer: false, timeout: 60_000 },
});
