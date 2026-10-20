import { defineConfig } from 'vitest/config';

// Year-long and month-long colony runs (RULES.md VR-67). The quick `npm run check` leaves these
// files out so it stays under 30 s; `npm run check:full` and CI's core job run every file. Direct
// runs (`npx vitest run <file>`, `npm run test:related`) always include them.
const slowFiles = [
  'src/engine/build/fields.test.ts',
  'src/engine/build/walls.test.ts',
  'src/engine/people/cook.test.ts',
  'src/worker/furniture.test.ts',
  'src/engine/build/furniture.test.ts',
  'src/engine/build/houses.test.ts',
  'src/engine/fire/fire.test.ts',
  'src/engine/wild/wild.test.ts',
  'src/engine/map/map.test.ts',
  'src/engine/mine/mine.test.ts',
  'src/engine/needs/winter.test.ts',
  'src/engine/people/forage.test.ts',
  'src/engine/people/jobs.test.ts',
  'src/engine/sim/skip.test.ts',
  'src/worker/save.test.ts',
  // A 136-day run (Bundle 1's field views): 15 s of the quick tier's 37 s (P4.9).
  'src/worker/fields.test.ts',
];

// Tests sit next to the code they test (RULES.md VR-49). A test over 2 s is flagged as slow (VR-46).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tools/tests/**/*.test.ts'],
    exclude: process.env.VULCAN_TESTS === 'quick' ? slowFiles : [],
    environment: 'node',
    slowTestThreshold: 2000,
    // Colony tests step days of the full simulation; with fires (P3.6) the longest take 5 to 6 s
    // under load, so the 5 s default timed them out. Slow tests are still flagged at 2 s (VR-46).
    testTimeout: 15000,
    // One module graph for all files (phase review): a seed's Story Generator world, about 1.5 s to
    // make, is then made once for the run rather than once per file. Engine caches are derived
    // and keyed by world or content, so files cannot leak state into each other through them.
    isolate: false,
    // The Story Generator package ships TypeScript source (V-031), so Vite transforms it.
    server: { deps: { inline: ['story-generator'] } },
  },
});
