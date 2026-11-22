import { defineConfig, devices } from '@playwright/test';

// PLAYWRIGHT_CHROMIUM_PATH (set by .claude/hooks/session-start.sh in cloud sessions) points at a
// preinstalled Chromium when the pinned build is missing; CI leaves it unset.
const chromium = {
  ...devices['Desktop Chrome'],
  ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
    : {}),
};

/** Specs whose jumps run weeks of play at once: they run on their own, after the rest. */
const ALONE = /hunger\.spec\.ts$/;

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
  // Two lanes. `chromium` holds every spec but the long jumps, two at a time. A jump runs as fast as
  // the device allows (src/worker/pace.ts), so a long one's time is the runner's free CPU: the
  // hunger spec's first Next event runs about 77 days in 13.7 s alone here and missed
  // `skipOnce`'s 30 s beside another worker in CI (PR #186). `alone` runs such specs after
  // `chromium` has finished, one at a time (VER-11). A failure in `chromium` skips them, and
  // naming one of these specs runs all of `chromium` first unless `--no-deps` is passed.
  projects: [
    { name: 'chromium', use: chromium, testIgnore: ALONE },
    { name: 'alone', use: chromium, testMatch: ALONE, dependencies: ['chromium'] },
  ],
});
