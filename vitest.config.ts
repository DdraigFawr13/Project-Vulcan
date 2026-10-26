import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

// Year-long and month-long colony runs (RULES.md VR-67). The quick `npm run check` leaves these
// files out so it stays under 30 s; `npm run check:full` and CI's core job run every file. Direct
// runs (`npx vitest run <file>`, `npm run test:related`) always include them.
const slowFiles = [
  // The lamp (P5.13): two eight-day runs with dusk at 15:00.
  'src/engine/lamp/lamp.test.ts',
  // The chandler (V-135): colonies of six and twelve days (the hearth is lit from day 3 or 4).
  'src/engine/people/chandle.test.ts',
  // The skeps (P5.13): two runs of a few days from the first field to the first honey.
  'src/engine/bees/bees.test.ts',
  // The mill and harvest home (5B Bundle 4): a 240-day run on anvil.
  'src/engine/build/mill.test.ts',
  'src/engine/build/fields.test.ts',
  // Tan pits (5B Bundle 5): a short run to pits built and leather tanned.
  'src/engine/build/pits.test.ts',
  'src/engine/build/walls.test.ts',
  'src/engine/people/cook.test.ts',
  'src/worker/furniture.test.ts',
  'src/engine/build/furniture.test.ts',
  'src/engine/build/houses.test.ts',
  'src/engine/fire/fire.test.ts',
  'src/engine/wild/wild.test.ts',
  'src/engine/people/wild.test.ts',
  'src/engine/flock/flock.test.ts',
  'src/engine/people/herd.test.ts',
  'src/engine/map/map.test.ts',
  'src/engine/mine/mine.test.ts',
  'src/engine/needs/winter.test.ts',
  'src/engine/people/forage.test.ts',
  'src/engine/people/jobs.test.ts',
  'src/engine/sim/skip.test.ts',
  'src/worker/save.test.ts',
  // A 136-day run (Bundle 1's field views): 15 s of the quick tier's 37 s (P4.9).
  'src/worker/fields.test.ts',
  // Injury and death (P5.6, P5.8): a 20-day run to the first cottage, and a burial.
  'src/engine/health/health.test.ts',
  // Strangers and homes (P5.9, P5.14): three runs of two to three weeks on a valley seed.
  'src/engine/people/strangers.test.ts',
  // The same words on the page's side (P5.9, P5.14): one run of about 25 days on anvil/1.
  'src/worker/strangers.test.ts',
  // Worn paths and roads (P5.10): a run to the first cottage, then a road laid.
  'src/engine/build/roads.test.ts',
  // The 5A review: each held the quick tier past its 40 s (12.7 s of tool and smithy runs, 11.8 s
  // laying out every seed's levels).
  'src/engine/people/tools.test.ts',
  'src/engine/map/levels.test.ts',
  // Stores by kind (5B Bundle 1): a run to the first store built and filled.
  'src/engine/build/stores.test.ts',
  // Salt and the cellar (5B Bundle 3): runs of 20 to 60 days with miners digging.
  'src/engine/mine/salt.test.ts',
  'src/engine/keep/cellar.test.ts',
];

// Tests sit next to the code they test (RULES.md VR-49). A test over 2 s is flagged as slow (VR-46).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tools/tests/**/*.test.ts'],
    exclude: process.env.VULCAN_TESTS === 'quick' ? slowFiles : [],
    environment: 'node',
    slowTestThreshold: 2000,
    // One worker a core. Vitest's default leaves one core for itself, which on CI's two-core
    // runner ran every file one after another (the 5A review: 238 s on two cores, 148 s with two
    // workers). Tests step the simulation on one thread, so the main thread sits idle.
    maxWorkers: availableParallelism(),
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
