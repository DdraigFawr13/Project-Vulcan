// The engine's one public surface. The engine is pure: same seed, content and commands, same
// ledger, tick for tick (DECISIONS V-002, V-006). The worker is the only place it is run.
// Each system's index.ts is passed on whole; a new system adds an export and a SYSTEMS entry.
import { annalsSystem } from './annals/index.ts';
import { beesSystem } from './bees/index.ts';
import { buildSystem } from './build/index.ts';
import { calendarSystem } from './calendar/index.ts';
import { fireSystem } from './fire/index.ts';
import { flockSystem } from './flock/index.ts';
import { goodsSystem } from './goods/index.ts';
import { healthSystem } from './health/index.ts';
import { keepSystem } from './keep/index.ts';
import { lampSystem } from './lamp/index.ts';
import { lawSystem } from './law/index.ts';
import { mapSystem } from './map/index.ts';
import { mineSystem } from './mine/index.ts';
import { needsSystem } from './needs/index.ts';
import { peopleSystem, strangersSystem } from './people/index.ts';
import { regionSystem } from './region/index.ts';
import { selfSystem } from './self/index.ts';
import { colonySystem } from './colony/index.ts';
import { defySystem } from './defy/index.ts';
import { familySystem } from './family/index.ts';
import { faithSystem } from './faith/index.ts';
import { innSystem } from './inn/index.ts';
import { lordSystem } from './lord/index.ts';
import { talesSystem } from './tales/index.ts';
import { teachSystem } from './teach/index.ts';
import { callingSystem } from './calling/index.ts';
import { weatherSystem } from './weather/index.ts';
import { wildSystem } from './wild/index.ts';
import type { EngineContent } from './core/index.ts';
import { createSim as createSimWith, type Sim, type System } from './sim/index.ts';

export * from './core/index.ts';
export * from './log/index.ts';
export * from './entity/index.ts';
export { applyDue, createWorld, replay, step, submitCommand } from './sim/index.ts';
export type { Cadence, Sim, SimHooks, System, SystemContext } from './sim/index.ts';
export * from './annals/index.ts';
export * from './bees/index.ts';
export * from './build/index.ts';
export * from './calendar/index.ts';
export * from './fire/index.ts';
export * from './flock/index.ts';
export * from './goods/index.ts';
export * from './health/index.ts';
export * from './keep/index.ts';
export * from './lamp/index.ts';
export * from './law/index.ts';
export * from './map/index.ts';
export * from './mine/index.ts';
export * from './needs/index.ts';
export * from './people/index.ts';
export * from './region/index.ts';
export * from './self/index.ts';
export * from './colony/index.ts';
export * from './defy/index.ts';
export * from './family/index.ts';
export * from './faith/index.ts';
export * from './inn/index.ts';
export * from './lord/index.ts';
export * from './tales/index.ts';
export * from './teach/index.ts';
export * from './calling/index.ts';
export * from './weather/index.ts';
export * from './wild/index.ts';
// Two names more than one system exports: the engine's surface takes these.
export { placeOf } from './fire/index.ts';
export { childJobs, toolWaits } from './band/index.ts';
export type { Hours } from './core/index.ts';

/** The test-mode tools (V-041): direct orders on a tile, never levers. The worker refuses them
 * unless the page opened in test mode. */
export const TEST_TOOLS: readonly string[] = [
  'placeBuilding',
  'deconstruct',
  'cutStairs',
  'sinkShaft',
  'findSeam',
  'markFell',
  'markStore',
  'hurt',
  'sicken',
];

/** The game's systems in tick order. Later milestones add theirs here. */
export const SYSTEMS: readonly System[] = [
  regionSystem,
  mapSystem,
  peopleSystem,
  strangersSystem,
  healthSystem,
  goodsSystem,
  buildSystem,
  mineSystem,
  fireSystem,
  lampSystem,
  needsSystem,
  selfSystem,
  lawSystem,
  colonySystem,
  defySystem,
  talesSystem,
  familySystem,
  faithSystem,
  teachSystem,
  callingSystem,
  innSystem,
  lordSystem,
  calendarSystem,
  weatherSystem,
  wildSystem,
  flockSystem,
  beesSystem,
  keepSystem,
  annalsSystem,
];

/** A simulation over `content` with the game's systems, or the given ones (tests add fixtures). */
export const createSim = (
  content: EngineContent,
  systems: readonly System[] = SYSTEMS,
  recentDays?: number,
): Sim => createSimWith(content, systems, recentDays);
