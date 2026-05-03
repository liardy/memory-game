import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    port: 4174,
    reuseExistingServer: true,
    timeout: 120000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    headless: true,
    viewport: { width: 1600, height: 1000 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
