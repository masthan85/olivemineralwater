// Playwright tests for the OLIVE website.
//
// They run against the live site by default. To test another copy, such as a
// staging site, set BASE_URL:  BASE_URL=https://example.wpcomstaging.com npm test
//
// The phone project sets a phone-sized screen but keeps the desktop browser
// identity: WordPress.com shows a "Checking your browser" page to automated
// browsers that claim to be phones.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://olivemineralwater.co.uk',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
  ],
});
