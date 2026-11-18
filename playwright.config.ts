import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  // Two workers since the smoke stopped timing the clock (audit 2026-11-18): 1.9 to 1.5 min locally.
  workers: 2,
  // No retries: a test that passes only on retry is not green (VER-04).
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
  // Chromium only (the smoke, the phone sheets and three bug checks). Add engines only for a
  // concrete compatibility need.
  // PLAYWRIGHT_CHROMIUM_PATH (set by .claude/hooks/session-start.sh in cloud sessions) points at
  // a preinstalled Chromium when the pinned build is missing; CI leaves it unset.
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
});
