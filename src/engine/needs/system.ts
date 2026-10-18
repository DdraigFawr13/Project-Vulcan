// The needs system (P2.2): owns the need and mood tables. Rows are laid out when the band
// arrives; each hour the needs move and crossings are written (needs.ts).
import type { System } from '../sim/index.ts';
import { NEEDS_TABLES, runNeeds, seedNeeds } from './needs.ts';

export const needsSystem: System = {
  id: 'needs',
  every: 'hour',
  emits: ['need.low', 'need.met', 'mood.changed'],
  tables: NEEDS_TABLES,
  init: (ctx) => seedNeeds(ctx.world, ctx.content),
  run: runNeeds,
};
