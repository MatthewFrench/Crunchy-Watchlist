const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45000,
  fullyParallel: false,
  retries: 0,
  use: {
    browserName: 'webkit',
    headless: true,
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:4173/watchlist',
    timeout: 20000,
    reuseExistingServer: !process.env.CI
  }
});
