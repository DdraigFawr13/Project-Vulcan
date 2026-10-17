// The map's seed list (RULES lean tests): the done-when and `npm run map:stats` run every seed.
// If a generator change makes one fail, fix the generator or add seeds; never drop one quietly.
export const MAP_SEEDS = [
  'smoke',
  'ledger',
  'gwerin',
  'anvil',
  'harrow',
  'cairn',
  'bryn',
  'ashford',
  'tallow',
  'wren',
] as const;
