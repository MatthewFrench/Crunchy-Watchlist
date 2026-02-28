import { defineConfig } from '@playwright/test';

const fixtureServerPort = Math.max(1, Number.parseInt(process.env.PW_FIXTURE_SERVER_PORT || '4173', 10) || 4173);
const fixtureServerUrl = `http://127.0.0.1:${fixtureServerPort}/watchlist`;

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/*.spec.ts'],
  timeout: 45000,
  fullyParallel: false,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
  webServer: {
    command: 'tsx tests/Server.ts',
    url: fixtureServerUrl,
    timeout: 20000,
    reuseExistingServer: !process.env.CI,
  },
});
