import { defineConfig, devices } from '@playwright/test';

const API_PORT = 3101;
const WEB_PORT = 4174;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-dark', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
  ],
  webServer: [
    {
      command: 'node e2e/start-server.js',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { E2E_API_PORT: String(API_PORT), E2E_WEB_ORIGIN: `http://localhost:${WEB_PORT}` },
      reuseExistingServer: false,
    },
    {
      command: `npm run build && npx vite preview --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
