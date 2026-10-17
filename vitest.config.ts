import { defineConfig } from 'vitest/config';

// Tests sit next to the code they test (RULES.md VR-49). A test over 2 s is flagged as slow (VR-46).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tools/tests/**/*.test.ts'],
    environment: 'node',
    slowTestThreshold: 2000,
  },
});
