// Public surface of the needs system.
export { needsSystem } from './system.ts';
export {
  addMemories,
  addMemory,
  bandOf,
  goesAt,
  heldMemoriesOf,
  memoriesOf,
  warmLineOf,
  type Band,
} from './memory.ts';
export { tasted } from './diet.ts';
export { memoryName, strongestFirst, thoughtOf, type Thought } from './thought.ts';
export {
  changeNeed,
  coldOutdoors,
  crossed,
  feltAt,
  moodOf,
  needOf,
  NEEDS_TABLES,
  seedPerson,
} from './needs.ts';
export { sees, seenBy } from './sight.ts';
