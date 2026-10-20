import { defineConfig, devices } from '@playwright/test';

const local = !process.env.CI;

export default defineConfig({
  testDir: './e2e',
  testMatch: process.env.SHOTS ? /\.shots\.ts$/ : /\.spec\.ts$/,
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Safari's engine. CI runs it; set PW_WEBKIT=1 to run it locally.
    ...(local && !process.env.PW_WEBKIT ? [] : [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]),
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: local,
    timeout: 120_000,
  },
});
