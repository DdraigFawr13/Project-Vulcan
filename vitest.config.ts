import { defineConfig } from 'vitest/config';

// Tests sit next to the code they test (RULES.md VR-49). A test over 2 s is flagged as slow (VR-46).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tools/tests/**/*.test.ts'],
    environment: 'node',
    slowTestThreshold: 2000,
    // Colony tests step days of the full simulation; with fires (P3.6) the longest take 5 to 6 s
    // under load, so the 5 s default timed them out. Slow tests are still flagged at 2 s (VR-46).
    testTimeout: 15000,
    // The Story Generator package ships TypeScript source (V-031), so Vite transforms it.
    server: { deps: { inline: ['story-generator'] } },
  },
});
