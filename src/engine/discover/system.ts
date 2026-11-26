// The discovery system (6C Slice 5, V-142, V-218): colonists at a trade begin to puzzle over a new
// way of working, gather hints from long work, failures, strangers, books, tales, luck and dreams,
// and at the last hint find it. Nobody is picked to puzzle (V-041): the levers are the Work
// sheet's priorities, which decide who works a trade.
import { clockAt } from '../core/index.ts';
import type { System } from '../sim/index.ts';
import { nightHour } from './night.ts';
import { readLines, readTales } from './reads.ts';
import { lossHour, SPREAD_TABLES, spreadHour } from './spread.ts';
import { DISCOVER_TABLES } from './tables.ts';
import { sampleHour, startPuzzles } from './trade.ts';

export const discoverSystem: System = {
  id: 'discover',
  every: 'hour',
  stream: 'discover',
  emits: [
    'discover.puzzle',
    'discover.hint',
    'discover.found',
    'discover.beaten',
    'discover.dropped',
    'discover.resumed',
    'discover.mishap',
    'discover.learned',
    'discover.brought',
    'discover.lost',
  ],
  initialState: { seen: 0, tales: 0 },
  tables: { ...DISCOVER_TABLES, ...SPREAD_TABLES },
  run(ctx) {
    if (clockAt(ctx.world.tick, ctx.content.calendar).hour === 0) {
      nightHour(ctx);
      startPuzzles(ctx);
    }
    sampleHour(ctx);
    spreadHour(ctx);
    readLines(ctx);
    readTales(ctx);
    lossHour(ctx);
  },
};
